// src/modules/downloader/video-session.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { VideoInfoDto } from './dto/video-info.dto';

@Injectable()
export class VideoSessionService {
  private readonly logger = new Logger(VideoSessionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Сохранить сессию видео
   */
  async save(videoId: string, videoInfo: VideoInfoDto): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней

    await this.prisma.videoSession.create({
      data: {
        id: videoId,
        originalUrl: videoInfo.url || '',
        videoId: videoInfo.id,
        title: videoInfo.title,
        uploader: videoInfo.uploader,
        duration: videoInfo.duration,
        viewCount: videoInfo.viewCount ? BigInt(videoInfo.viewCount) : null,
        likeCount: videoInfo.likeCount ? BigInt(videoInfo.likeCount) : null,
        uploadDate: videoInfo.uploadDate,
        thumbnail: videoInfo.thumbnail,
        formats: JSON.stringify(videoInfo.formats), // Сохраняем как JSON
        expiresAt,
      },
    });

    this.logger.log(`Сохранена сессия видео: ${videoId}`);
  }

  /**
   * Получить сессию видео
   */
  async get(videoId: string): Promise<VideoInfoDto | null> {
    const session = await this.prisma.videoSession.findUnique({
      where: { id: videoId },
    });

    if (!session) {
      return null;
    }

    // Проверяем не истекла ли сессия
    if (new Date() > session.expiresAt) {
      await this.delete(videoId);
      return null;
    }

    // Парсим форматы из JSON
    const formats = JSON.parse(session.formats as string);

    return {
      id: session.videoId,
      url: session.originalUrl,
      title: session.title,
      uploader: session.uploader,
      duration: session.duration,
      viewCount: session.viewCount ? Number(session.viewCount) : null,
      likeCount: session.likeCount ? Number(session.likeCount) : null,
      uploadDate: session.uploadDate,
      thumbnail: session.thumbnail,
      formats,
    };
  }

  /**
   * Удалить сессию
   */
  async delete(videoId: string): Promise<void> {
    await this.prisma.videoSession.delete({
      where: { id: videoId },
    });
  }

  /**
   * Очистить истёкшие сессии
   */
  async cleanExpired(): Promise<number> {
    const result = await this.prisma.videoSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`🗑️ Удалено ${result.count} истёкших видео-сессий`);
    return result.count;
  }
}