// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/prisma.module';
import { BotModule } from './modules/bot/bot.module';
import { UserModule } from './modules/user/user.module';
import { ChannelModule } from './modules/channel/channel.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { DownloaderModule } from './modules/downloader/downloader.module';
import { CacheModule } from './modules/cache/cache.module';
import { UploaderModule } from './modules/uploader/uploader.module';
import { MtprotoModule } from './modules/mtproto/mtproto.module';
import { AdvertisementModule } from './modules/advertisement/advertisement.module';
import { AdminModule } from './modules/admin/admin.module';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UserModule,
    ChannelModule,
    SubscriptionModule,
    CacheModule,
    MtprotoModule,
    UploaderModule,
    DownloaderModule,
    AdvertisementModule,
    AdminModule,
    BotModule,
  ],
})
export class AppModule {}