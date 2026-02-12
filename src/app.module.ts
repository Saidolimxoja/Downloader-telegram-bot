import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/prisma.module';
import { UserModule } from './modules/user/user.module';
import { ChannelModule } from './modules/channel/channel.module';
import { validationSchema } from './config/validation.schema';
import { AdminModule } from './modules/admin/admin.module';
import { AdvertisementModule } from './modules/advertisement/advertisement.module';
import { BotModule } from './modules/bot/bot.module';
import { CacheModule } from './modules/cache/cache.module';
import { DownloaderModule } from './modules/downloader/downloader.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { UploaderModule } from './modules/uploader/uploader.module';
import { MtprotoModule } from './modules/mtproto/mtproto.module';

@Module({
  imports: [
    // 1. Сначала загружаем конфиг
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      envFilePath: '.env',
    }),
    MtprotoModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    UserModule,
    ChannelModule,
    SubscriptionModule,
    CacheModule,
    UploaderModule,
    DownloaderModule,
    AdvertisementModule,
    AdminModule,
    BotModule, // Убедись, что внутри BotModule нет повторного TelegrafModule.forRoot
  ],
})
export class AppModule {}
