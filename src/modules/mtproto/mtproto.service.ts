import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';

@Injectable()
export class MtprotoService implements OnModuleInit {
  private readonly logger = new Logger(MtprotoService.name);
  private client: TelegramClient;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const apiId = this.config.get<number>('API_ID');
    const apiHash = this.config.get<string>('API_HASH');
    const sessionString = this.config.get<string>('SESSION_STRING') || '';

    if (!apiId || !apiHash) {
      throw new Error('API_ID и API_HASH обязательны для MTProto');
    }

    const stringSession = new StringSession(sessionString);

    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    try {
      await this.client.start({
        botAuthToken: this.config.getOrThrow<string>('BOT_TOKEN'),
      });

      this.logger.log('✅ MTProto клиент подключён');
    } catch (error) {
      this.logger.error(`❌ Ошибка подключения MTProto: ${error}`);
      throw error;
    }
  }

  /**
   * Загрузить файл в канал через MTProto
   */
  async uploadFile(
    channelId: string,
    filepath: string,
    caption: string,
    fileType: 'video' | 'audio',
    metadata: {
      title?: string;
      uploader?: string;
      duration?: number;
    },
    onProgress?: (progress: number) => void,
  ): Promise<{ messageId: number; fileId: string }> {
    this.logger.log(`📤 MTProto загрузка: ${filepath}`);

    try {
      // 1. Форматируем ID. GramJS иногда капризничает с префиксом -100
      let peer: any = channelId;

      // Если ID начинается с -100, GramJS лучше понимает его без этого префикса,
      // но в объекте PeerChannel.
      if (channelId.startsWith('-100')) {
        const cleanId = channelId.replace('-100', '');
        // Пытаемся получить сущность по очищенному ID
        try {
          peer = await this.client.getEntity(cleanId);
        } catch (e) {
          // Если по ID не вышло, пробуем как есть (целиком)
          peer = await this.client.getEntity(channelId);
        }
      } else {
        peer = await this.client.getEntity(channelId);
      }

      this.logger.log(`✅ Канал найден: ${peer.title || 'OK'}`);

      const attributes: any[] = [];

      if (fileType === 'video') {
        attributes.push(
          new Api.DocumentAttributeVideo({
            duration: metadata.duration || 0,
            w: 1920,
            h: 1080,
            supportsStreaming: true,
          }),
        );
      } else {
        attributes.push(
          new Api.DocumentAttributeAudio({
            duration: metadata.duration || 0,
            title: metadata.title || 'Unknown',
            performer: metadata.uploader || 'Unknown',
          }),
        );
      }

      // 2. Используем 'entity' вместо сырого 'channelId'
      const message: any = await this.client.sendFile(peer, {
        file: filepath,
        caption: caption,
        forceDocument: false,
        attributes: attributes,
        progressCallback: onProgress ? (p: number) => onProgress(p) : undefined,
      });

      this.logger.log(
        `✅ MTProto загрузка завершена: message_id=${message.id}`,
      );

      return {
        messageId: message.id,
        fileId: '',
      };
    } catch (error: any) {
      this.logger.error(`❌ Ошибка MTProto загрузки: ${error}`);
      // Если getEntity все равно не находит, возможно бот не в канале
      if (error.message.includes('Could not find the input entity')) {
        this.logger.warn(
          'Попробуйте вручную написать любое сообщение в канал от имени бота или добавить его туда еще раз.',
        );
      }
      throw error;
    }
  }

  getClient(): TelegramClient {
    return this.client;
  }
}
