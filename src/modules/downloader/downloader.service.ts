// src/modules/downloader/downloader.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, InlineKeyboard, Bot } from 'grammy';
import { YtdlpService } from './ytdlp.service';
import { QueueService } from './queue.service';
import { CacheService } from '../cache/cache.service';
import { UploaderService } from '../uploader/uploader.service';
import { UserService } from '../user/user.service';
import { VideoInfoDto } from './dto/video-info.dto';
import {
  formatDuration,
  formatNumber,
  formatUploadDate,
  createProgressBar,
} from '../../common/utils/format.utils';
import {
  sanitizeFilename,
  formatFileSize,
} from '../../common/utils/file.utils';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AdvertisementService } from '../advertisement/advertisement.service';
import { VideoSessionService } from './video-session.service';
import { MESSAGES } from 'src/common/constants/messages.constant';

@Injectable()
export class DownloaderService {
  private readonly logger = new Logger(DownloaderService.name);
  private videoDataCache = new Map<string, VideoInfoDto>();
  private activeDownloads = new Map<string, Promise<void>>();
  private readonly downloadsDir: string;
  private readonly yourUsername: string;

  constructor(
    private ytdlpService: YtdlpService,
    private queueService: QueueService,
    private cacheService: CacheService,
    private uploaderService: UploaderService,
    private userService: UserService,
    private config: ConfigService,
    private advertisementService: AdvertisementService,
    private videoSessionService: VideoSessionService,
  ) {
    this.downloadsDir =
      this.config.get<string>('DOWNLOADS_DIR') || './downloads';
    this.yourUsername = this.config.get<string>('YOUR_USERNAME') || '@your_bot';
  }

  async handleUrl(ctx: Context, url: string): Promise<void> {
    if (!ctx.chat) {
      await ctx.reply('Данная команда доступна только в чатах.');
      return;
    }

    const chatId = ctx.chat.id;
    let progressMsg;

    try {
      progressMsg = await ctx.reply('🔍 Анализирую ссылку...');

      const videoInfo = await this.ytdlpService.getVideoInfo(url);

      const sessionId = crypto.randomBytes(8).toString('hex');

      this.videoDataCache.set(sessionId, videoInfo);
      await this.videoSessionService.save(sessionId, videoInfo);

      const keyboard = new InlineKeyboard();

      videoInfo.formats.forEach((format, idx) => {
        const key = `${sessionId}|${format.formatId}|${format.resolution}`;
        const sizeText = format.filesize
          ? formatFileSize(format.filesize)
          : '~ MB';
        const label =
          format.resolution === 'audio'
            ? `🎵 Аудио • ${sizeText}`
            : `${format.resolution}${format.hasAudio ? '' : ' 🔇'} • ${sizeText}`;

        const buttonText = idx === 0 ? `⭐ ${label}` : label;
        keyboard.text(buttonText, `dl|${key}`).row();
      });

      await ctx.api.editMessageText(
        chatId,
        progressMsg.message_id,
        `🎬 *${videoInfo.title}*\n\n` +
          `👁 ${formatNumber(videoInfo.viewCount)} • ` +
          `👍 ${formatNumber(videoInfo.likeCount)}\n` +
          `📥 ${formatUploadDate(videoInfo.uploadDate)} • 🕒 ${formatDuration(videoInfo.duration)}\n` +
          `👤 ${videoInfo.uploader || '—'}\n\n` +
          `*📌 Выберите качество:*`,
        { parse_mode: 'Markdown', reply_markup: keyboard },
      );
    } catch (error) {
      this.logger.error('Ошибка анализа видео', error);
      const errorMsg =
        '❌ Не удалось проанализировать ссылку.\nВозможно, видео недоступно или слишком длинное.';
      if (progressMsg) {
        await ctx.api
          .editMessageText(chatId, progressMsg.message_id, errorMsg)
          .catch(() => {});
      } else {
        await ctx.reply(errorMsg);
      }
    }
  }

  async handleQualitySelection(
    ctx: Context,
    bot: Bot<Context>,
    videoId: string,
    formatId: string,
    resolution: string,
  ): Promise<void> {
    if (!ctx.chat || !ctx.from) return;
    const userId = BigInt(ctx.from.id);

    let videoData = this.videoDataCache.get(videoId);
    if (!videoData) {
      const dbData = await this.videoSessionService.get(videoId);
      if (!dbData) {
        await ctx.answerCallbackQuery({
          text: '❌ Ссылка устарела. Отправьте видео заново.',
        });
        return;
      }
      videoData = dbData;
      this.videoDataCache.set(videoId, videoData);
    }

    const cached = await this.cacheService.get(
      videoData.id,
      formatId,
      resolution,
    );

    if (cached) {
      this.logger.log(`🎯 HIT Cache: ${resolution}`);
      await ctx.answerCallbackQuery(MESSAGES.FROM_CACHE);

      const isAudio = resolution === 'audio';
      const caption = `✅ ${videoData.title}\n\n📥 ${resolution}\n\n📢 ${this.yourUsername}`;

      try {
        if (isAudio) {
          await ctx.replyWithAudio(cached.fileId, {
            caption,
            title: videoData.title,
            // ИСПРАВЛЕНИЕ 1: Добавлено || undefined для совместимости типов
            performer: videoData.uploader || undefined,
          });
        } else {
          await ctx.replyWithVideo(cached.fileId, {
            caption,
            supports_streaming: true,
          });
        }

        await this.cacheService.recordCacheHit(cached.id, userId);
        await this.userService.incrementDownloads(userId);
        this.advertisementService.incrementUserDownloads(userId);
        if (await this.advertisementService.shouldShowAd(userId))
          await this.advertisementService.showAd(ctx);
        return;
      } catch (e) {
        this.logger.warn(`FileID протух, качаем заново...`);
      }
    }

    const downloadKey = `${videoData.id}|${formatId}`;
    if (this.activeDownloads.has(downloadKey)) {
      await ctx.answerCallbackQuery({ text: '⏳ Уже скачивается, ждите...' });
      return;
    }

    await ctx.answerCallbackQuery({ text: '⬇️ Добавлено в очередь...' });

    const downloadPromise = this.queueService.add(() =>
      this.processDownload(ctx, bot, videoData!, formatId, resolution, userId),
    );

    this.activeDownloads.set(downloadKey, downloadPromise);
    downloadPromise.finally(() => this.activeDownloads.delete(downloadKey));
  }

  private async processDownload(
    ctx: Context,
    bot: Bot<Context>,
    videoData: VideoInfoDto,
    formatId: string,
    resolution: string,
    userId: bigint,
  ): Promise<void> {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    let progressMsg;

    try {
      progressMsg = await ctx.reply('⬇️ Начинаю загрузку...');

      const sanitizedTitle = sanitizeFilename(videoData.title);
      const isAudio = resolution === 'audio';
      const fileExt = isAudio ? 'm4a' : 'mp4';
      const outputPath = path.join(
        this.downloadsDir,
        `${sanitizedTitle}_${formatId}.${fileExt}`,
      );

      // ИСПРАВЛЕНИЕ 2: Исправлен синтаксис строки
      const sourceUrl =
        videoData.url || `https://www.youtube.com/watch?v=${videoData.id}`;

      const filepath = await this.ytdlpService.downloadVideo(
        sourceUrl,
        formatId,
        outputPath,
        isAudio,
        async (progress) => {
          if (progress % 10 === 0 || progress >= 100) {
            const bar = createProgressBar(progress);
            try {
              await ctx.api.editMessageText(
                chatId,
                progressMsg.message_id,
                `⬇️ Скачивание\n${bar} ${Math.floor(progress)}%`,
              );
            } catch {}
          }
        },
      );

      await ctx.api.editMessageText(
        chatId,
        progressMsg.message_id,
        '📤 Загрузка в Телеграм...',
      );

      const uploadResult = await this.uploaderService.upload(
        bot,
        filepath,
        isAudio ? 'audio' : 'video',
        {
          title: videoData.title,
          // ИСПРАВЛЕНИЕ 3: Добавлено || undefined и недостающие поля
          duration: videoData.duration || undefined,
          resolution: resolution, // Требуется для UploaderService
          formatId: formatId, // Требуется для UploaderService
          uploader: videoData.uploader || undefined,
        },
        async (progress) => {
          if (progress % 10 === 0) {
            const bar = createProgressBar(progress);
            try {
              await ctx.api.editMessageText(
                chatId,
                progressMsg.message_id,
                `📤 Отправка\n${bar} ${progress}%`,
              );
            } catch {}
          }
        },
      );

      // --- СОХРАНЕНИЕ В БАЗУ (КЕШ) ---
      await this.cacheService.set({
        url: videoData.id,
        formatId: formatId,
        resolution: resolution,
        fileId: uploadResult.fileId,
        // ИСПРАВЛЕНИЕ 4: Добавлен обязательный параметр archiveMessageId
        archiveMessageId: uploadResult.messageId,
        fileSize: BigInt((await fs.stat(filepath)).size),
        fileType: isAudio ? 'audio' : 'video',
        userId: userId,
        title: videoData.title,
        duration: videoData.duration || undefined,
        uploader: videoData.uploader || undefined,
      });

      const userCaption = `✅ ${videoData.title}\n\n📥 ${resolution}\n\n📢 ${this.yourUsername}`;
      if (isAudio) {
        await ctx.replyWithAudio(uploadResult.fileId, {
          caption: userCaption,
          title: videoData.title,
          performer: videoData.uploader || undefined,
        });
      } else {
        await ctx.replyWithVideo(uploadResult.fileId, {
          caption: userCaption,
          supports_streaming: true,
        });
      }

      await ctx.api
        .deleteMessage(chatId, progressMsg.message_id)
        .catch(() => {});

      await fs.unlink(filepath).catch(() => {});
      await this.userService.incrementDownloads(userId);
    } catch (error) {
      this.logger.error(`Download failed: ${error}`);
      if (progressMsg) {
        await ctx.api
          .editMessageText(
            chatId,
            progressMsg.message_id,
            `❌ Ошибка при скачивании`,
          )
          .catch(() => {});
      }
    }
  }

  async getStats() {
    const queueStatus = this.queueService.getStatus();
    const cacheStats = await this.cacheService.getStats();
    const userStats = await this.userService.getStats();

    return {
      activeDownloads: queueStatus.active,
      queueSize: queueStatus.queued,
      cacheSize: cacheStats.totalFiles,
      totalUsers: userStats.totalUsers,
    };
  }
}
