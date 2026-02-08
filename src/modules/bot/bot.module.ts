// src/modules/bot/bot.module.ts

import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { UserModule } from '../user/user.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DownloaderModule } from '../downloader/downloader.module';
import { AdminModule } from '../admin/admin.module'; // ← Добавили

@Module({
  imports: [
    UserModule,
    SubscriptionModule,
    DownloaderModule,
    AdminModule, // ← Добавили
  ],
  providers: [BotService, BotUpdate],
  exports: [BotService],
})
export class BotModule {}