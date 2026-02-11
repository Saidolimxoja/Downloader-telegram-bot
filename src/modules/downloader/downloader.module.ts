// src/modules/downloader/downloader.module.ts

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DownloaderService } from './downloader.service';
import { YtdlpService } from './ytdlp.service';
import { QueueService } from './queue.service';
import { VideoSessionService } from './video-session.service'; // ← Добавили
import { CacheModule } from '../cache/cache.module';
import { UploaderModule } from '../uploader/uploader.module';
import { UserModule } from '../user/user.module';
import { AdvertisementModule } from '../advertisement/advertisement.module';
import { VideoSessionCleanupService } from './video-session-cleanup.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [CacheModule, UploaderModule, UserModule, AdvertisementModule],
  providers: [
    DownloaderService,
    YtdlpService,
    VideoSessionService,
    VideoSessionCleanupService,
    {
      provide: QueueService,
      useFactory: (config: ConfigService) => {
        const maxParallel = config.get<number>('MAX_PARALLEL_DOWNLOADS') || 3;
        return new QueueService(maxParallel);
      },
      inject: [ConfigService],
    },
  ],
  exports: [DownloaderService],
})
export class DownloaderModule {}