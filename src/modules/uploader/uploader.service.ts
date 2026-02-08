import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InputFile } from 'grammy';
import { MtprotoService } from '../mtproto/mtproto.service';
import * as fs from 'fs/promises';

@Injectable()
export class UploaderService {
  private readonly logger = new Logger(UploaderService.name);
  private readonly channelId: string;

  constructor(
    private config: ConfigService,
    private mtproto: MtprotoService,
  ) {
    this.channelId = this.config.getOrThrow<string>('CHANNEL_ID');
  }

  /**
   * Загрузить файл в канал (автоматический выбор метода)
   */
  async upload(
    bot: Bot<Context>,
    filepath: string,
    fileType: 'video' | 'audio',
    metadata: {
      title: string;
      uploader?: string;
      duration?: number;
      resolution: string;
      formatId: string;
    },
    onProgress?: (progress: number) => void,
  ): Promise<{ messageId: number; fileId: string }> {
    const stats = await fs.stat(filepath);
    const fileSizeMB = stats.size / (1024 * 1024);

    this.logger.log(`📊 Размер файла: ${fileSizeMB.toFixed(1)} MB`);

    const caption = `${metadata.title}\n${metadata.resolution} | ${metadata.formatId}`;

    // Выбираем метод загрузки
    if (fileSizeMB <= 50) {
      return this.uploadViaBotAPI(
        bot,
        filepath,
        fileType,
        caption,
        metadata,
        onProgress,
      );
    } else {
      return this.uploadViaMTProto(
        filepath,
        fileType,
        caption,
        metadata,
        onProgress,
        bot,
      );
    }
  }

  /**
   * Загрузка через Bot API (< 50MB)
   */
  private async uploadViaBotAPI(
    bot: Bot<Context>,
    filepath: string,
    fileType: 'video' | 'audio',
    caption: string,
    metadata: any,
    onProgress?: (progress: number) => void,
  ): Promise<{ messageId: number; fileId: string }> {
    this.logger.log(`📡 Bot API загрузка`);

    try {
      let message: any;

      if (fileType === 'video') {
        message = await bot.api.sendVideo(
          this.channelId,
          new InputFile(filepath),
          {
            caption,
            supports_streaming: true,
          },
        );
      } else {
        message = await bot.api.sendAudio(
          this.channelId,
          new InputFile(filepath),
          {
            caption,
            title: metadata.title,
            performer: metadata.uploader || 'Unknown',
            duration: metadata.duration || 0,
          },
        );
      }

      const fileId = message.video?.file_id || message.audio?.file_id;

      this.logger.log(
        `✅ Bot API загрузка: message_id=${message.message_id}, file_id=${fileId}`,
      );

      return {
        messageId: message.message_id,
        fileId: fileId,
      };
    } catch (error) {
      this.logger.error(`❌ Ошибка Bot API: ${error}`);
      throw error;
    }
  }

  /**
   * Загрузка через MTProto (> 50MB)
   */
  private async uploadViaMTProto(
    filepath: string,
    fileType: 'video' | 'audio',
    caption: string,
    metadata: any,
    onProgress?: (progress: number) => void,
    bot?: Bot<Context>,
  ): Promise<{ messageId: number; fileId: string }> {
    this.logger.log(`📡 MTProto загрузка`);

    let lastProgress = 0;

    // ИСПРАВЛЕНО: GramJS передает 'progress' как число от 0 до 1
    const progressCallback = (progress: number) => {
      const percent = Math.round(progress * 100);

      // Вызываем onProgress только если процент изменился хотя бы на 10%
      if (percent - lastProgress >= 10 || percent === 100) {
        lastProgress = percent;
        onProgress?.(percent);
        this.logger.debug(`Загрузка: ${percent}%`);
      }
    };

    const result = await this.mtproto.uploadFile(
      this.channelId,
      filepath,
      caption,
      fileType,
      metadata,
      progressCallback, // Теперь типы совпадают
    );

    // Получаем file_id через Bot API (пересылаем и удаляем)
    if (bot) {
      try {
        const forwarded: any = await bot.api.forwardMessage(
          this.channelId,
          this.channelId,
          result.messageId,
        );

        const fileId =
          forwarded.video?.file_id ||
          forwarded.audio?.file_id ||
          forwarded.document?.file_id;

        // Удаляем копию
        await bot.api.deleteMessage(this.channelId, forwarded.message_id);

        return {
          messageId: result.messageId,
          fileId: fileId || '',
        };
      } catch (error) {
        this.logger.error(`⚠️ Не удалось получить file_id: ${error}`);
        return result;
      }
    }

    return result;
  }
}
