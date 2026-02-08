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
import { sanitizeFilename } from '../../common/utils/file.utils';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { formatFileSize } from '../../common/utils/file.utils';
import { AdvertisementService } from '../advertisement/advertisement.service';
import { VideoSessionService } from './video-session.service';

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

  /**
   * Handle URL sent by user
   */
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
      const videoId = crypto.randomBytes(8).toString('hex');
      this.videoDataCache.set(videoId, videoInfo);
      await this.videoSessionService.save(videoId, videoInfo);
      const keyboard = new InlineKeyboard();

      videoInfo.formats.forEach((format, idx) => {
        const key = `${videoId}|${format.formatId}|${format.resolution}`;
        const sizeText = format.filesize
          ? formatFileSize(format.filesize)
          : '~? MB';
        const label =
          format.resolution === 'audio'
            ? `🎵 Аудио • ${sizeText}`
            : `${format.resolution}${format.hasAudio ? '' : ' 🔇'} • ${sizeText}`;

        const buttonText = idx === 0 ? `⭐ ${label}` : label;
        keyboard.text(buttonText, `dl|${key}`).row();
      });

      // БЕЗ экранирования — используем обычный Markdown
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
      if (progressMsg) {
        await ctx.api
          .editMessageText(
            chatId,
            progressMsg.message_id,
            '❌ Не удалось проанализировать ссылку.\nПроверьте URL или попробуйте позже.',
          )
          .catch(() => {});
      } else {
        await ctx.reply('❌ Ошибка анализа.');
      }
    }
  }

  /**
   * Handle quality/format selection via callback
   */
  async handleQualitySelection(
    ctx: Context,
    bot: Bot<Context>,
    videoId: string,
    formatId: string,
    resolution: string,
  ): Promise<void> {
    if (!ctx.chat || !ctx.from) {
      await ctx.answerCallbackQuery({
        text: 'Операция недоступна в этом контексте.',
      });
      return;
    }

    const userId = BigInt(ctx.from.id);

    let videoData = this.videoDataCache.get(videoId);

    if (!videoData) {
      this.logger.log(`Видео не в памяти, загружаю из БД: ${videoId}`);
      const dbData = await this.videoSessionService.get(videoId);
      if (!dbData) {
        await ctx.answerCallbackQuery({
          text: '❌ Сессия истекла. Отправьте ссылку заново.',
        });
        return;
      }
      videoData = dbData; // here TS knows it's VideoInfoDto
    }

    this.videoDataCache.set(videoId, videoData);
 // Перед вызовом cacheService.set(...)

    const cached = await this.cacheService.get(
      videoData.id,
      formatId,
      resolution,
    );

    if (cached) {
      this.logger.log(`Отправка из кеша: ${resolution}`);
      await ctx.answerCallbackQuery({ text: '⚡ Из кеша!' });

      const isAudio = resolution === 'audio';
      const caption = `✅ ${videoData.title}\n\n📥 ${resolution}\n\n📢 ${this.yourUsername}`;

      try {
        if (isAudio) {
          await ctx.replyWithAudio(cached.fileId, {
            caption,
            title: videoData.title,
            performer: videoData.uploader || 'Unknown',
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

        if (await this.advertisementService.shouldShowAd(userId)) {
          await this.advertisementService.showAd(ctx);
        }
        return;
      } catch (err) {
        this.logger.error(
          'file_id недействителен, будет скачивание заново',
          err,
        );
        // continue to download
      }
    }

    const downloadKey = `${videoData.id}|${formatId}|${resolution}`;

    if (this.activeDownloads.has(downloadKey)) {
      this.logger.log(`Видео уже в процессе: ${resolution}`);
      await ctx.answerCallbackQuery({
        text: '⏳ Уже загружается, пожалуйста, подождите...',
      });
      return;
    }

    const queueStatus = this.queueService.getStatus();
    const position = queueStatus.queued + 1;

    await ctx.answerCallbackQuery({
      text:
        queueStatus.total > 0
          ? `⏳ Позиция в очереди: ${position}`
          : '⬇️ Начинаю скачивание...',
    });

    const downloadPromise = this.queueService.add(() =>
      this.processDownload(ctx, bot, videoData, formatId, resolution, userId),
    );

    this.activeDownloads.set(downloadKey, downloadPromise);
    downloadPromise.finally(() => this.activeDownloads.delete(downloadKey));
  }

  /**
   * Core download → upload → cache → send logic
   */
  private async processDownload(
    ctx: Context,
    bot: Bot<Context>,
    videoData: VideoInfoDto,
    formatId: string,
    resolution: string,
    userId: bigint,
  ): Promise<void> {
    if (!ctx.chat || !ctx.from) return;

    const chatId = ctx.chat.id;
    let progressMsg;

    try {
      progressMsg = await ctx.reply('⬇️ Скачивание начато...');

      const sanitizedTitle = sanitizeFilename(videoData.title);
      const isAudio = resolution === 'audio';
      const fileExt = isAudio ? 'm4a' : 'mp4';
      const outputPath = path.join(
        this.downloadsDir,
        `${sanitizedTitle}_${resolution}.${fileExt}`,
      );

      // Determine correct source URL
      const sourceUrl =
        typeof videoData.url === 'string' && videoData.url.startsWith('http')
          ? videoData.url
          : `https://www.youtube.com/watch?v=${videoData.id}`;

      const filepath = await this.ytdlpService.downloadVideo(
        sourceUrl,
        formatId,
        outputPath,
        isAudio,
        async (progress) => {
          const bar = createProgressBar(progress);
          try {
            await ctx.api.editMessageText(
              chatId,
              progressMsg.message_id,
              `⬇️ Скачивание\n\n${bar} ${progress.toFixed(0)}%`,
            );
          } catch {
            // silent
          }
        },
      );

      await fs.access(filepath);
      const stats = await fs.stat(filepath);

      // ✅ БЕЗ parse_mode
      await ctx.api.editMessageText(
        chatId,
        progressMsg.message_id,
        '📤 Загрузка в канал...',
      );

      const uploadResult = await this.uploaderService.upload(
        bot,
        filepath,
        isAudio ? 'audio' : 'video',
        {
          title: videoData.title,
          uploader: videoData.uploader || 'Unknown',
          duration: videoData.duration || 0,
          resolution,
          formatId,
        },
        async (progress) => {
          const bar = createProgressBar(progress);
          try {
            await ctx.api.editMessageText(
              chatId,
              progressMsg.message_id,
              `📤 Загрузка\n\n${bar} ${progress}%`,
            );
          } catch {
            // silent
          }
        },
      );

      await this.cacheService.set({
        url: videoData.id,
        formatId,
        resolution,
        fileId: uploadResult.fileId,
        archiveMessageId: uploadResult.messageId,
        title: videoData.title,
        uploader: videoData.uploader || undefined,
        duration: videoData.duration || undefined,
        fileSize: BigInt(stats.size),
        fileType: isAudio ? 'audio' : 'video',
        userId,
      });

      const userCaption = `✅ ${videoData.title}\n\n📥 ${resolution}\n\n📢 ${this.yourUsername}`;

      if (isAudio) {
        await ctx.replyWithAudio(uploadResult.fileId, {
          caption: userCaption,
          title: videoData.title,
          performer: videoData.uploader || 'Unknown',
        });
      } else {
        await ctx.replyWithVideo(uploadResult.fileId, {
          caption: userCaption,
          supports_streaming: true,
        });
      }

      // ✅ БЕЗ parse_mode
      await ctx.api.editMessageText(
        chatId,
        progressMsg.message_id,
        `✅ Готово!\n\n📦 ${videoData.title}\n📥 ${resolution}`,
      );

      await this.userService.incrementDownloads(userId);
      this.advertisementService.incrementUserDownloads(userId);

      if (await this.advertisementService.shouldShowAd(userId)) {
        this.logger.log(`Показ рекламы пользователю ${userId}`);
        await this.advertisementService.showAd(ctx);
      }

      await fs
        .unlink(filepath)
        .catch((err) =>
          this.logger.warn(`Не удалось удалить временный файл: ${err.message}`),
        );
    } catch (error) {
      this.logger.error('Ошибка в процессе скачивания/загрузки', error);

      if (progressMsg) {
        await ctx.api
          .editMessageText(
            chatId,
            progressMsg.message_id,
            `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          )
          .catch(() => {});
      }
    }
  }

  /**
   * Get service statistics
   */
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
