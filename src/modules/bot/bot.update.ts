// src/modules/bot/bot.update.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MESSAGES } from '../../common/constants/messages.constant';
import { DownloaderService } from '../downloader/downloader.service';
import { AdminScene } from '../admin/admin.scene';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class BotUpdate implements OnModuleInit {
  constructor(
    private prisma:PrismaService,
    private botService: BotService,
    private userService: UserService,
    private subscriptionService: SubscriptionService,
    private downloaderService: DownloaderService,
    private adminScene: AdminScene, // ← Добавили
  ) {
    console.log('🔧 BotUpdate: constructor вызван');
  }

  async onModuleInit() {
    console.log('🔄 BotUpdate: onModuleInit ВЫЗВАН');
    this.registerHandlers();
    await this.startBot();
  }

  private registerHandlers() {
    const bot = this.botService.getBot();
    console.log('📝 Регистрация обработчиков...');

    bot.command('checkchannels', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      try {
        const isAdmin = await this.userService.isAdmin(BigInt(userId));
        if (!isAdmin) {
          await ctx.reply(MESSAGES.ERROR_NO_ACCESS);
          return;
        }

        const channels =
          await this.subscriptionService['channelService'].getActiveChannels();

        if (channels.length === 0) {
          await ctx.reply('📭 Нет активных каналов');
          return;
        }

        let message = '📢 *Проверка каналов:*\n\n';

        for (const channel of channels) {
          try {
            const chat = await bot.api.getChat(channel.channelId);
            message += `✅ ${channel.channelName}\n`;
            message += `   ID: \`${channel.channelId}\`\n`;
            message += `   Название: ${chat.title}\n`;
            message += `   Тип: ${chat.type}\n\n`;
          } catch (error: any) {
            message += `❌ ${channel.channelName}\n`;
            message += `   ID: \`${channel.channelId}\`\n`;
            message += `   Ошибка: ${error.message}\n\n`;
          }
        }

        await ctx.reply(message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('❌ Ошибка в /checkchannels:', error);
        await ctx.reply('❌ Ошибка проверки');
      }
    });

    // ========== /admin (только админ) ==========
    bot.command('admin', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      try {
        const isAdmin = await this.userService.isAdmin(BigInt(userId));
        if (!isAdmin) {
          await ctx.reply(MESSAGES.ERROR_NO_ACCESS);
          return;
        }

        await this.adminScene.showMainMenu(ctx);
      } catch (error) {
        console.error('❌ Ошибка в /admin:', error);
      }
    });

    // ========== ADMIN CALLBACKS ==========
    bot.callbackQuery('admin:main', async (ctx) => {
      await this.adminScene.showMainMenu(ctx);
      await ctx.answerCallbackQuery();
    });

    bot.callbackQuery('admin:ads', async (ctx) => {
      await this.adminScene.showAdsMenu(ctx);
      await ctx.answerCallbackQuery();
    });

    bot.callbackQuery('admin:channels', async (ctx) => {
      await this.adminScene.showChannelsMenu(ctx);
      await ctx.answerCallbackQuery();
    });

    bot.callbackQuery('admin:stats', async (ctx) => {
      await this.adminScene.showStats(ctx);
      await ctx.answerCallbackQuery();
    });

    // Списки для действий
    bot.callbackQuery(/^admin:ad:list:(edit|delete|toggle)$/, async (ctx) => {
      const action = ctx.match[1] as 'edit' | 'delete' | 'toggle';
      await this.adminScene.showAdsList(ctx, action);
      await ctx.answerCallbackQuery();
    });

    // Переключение активности
    bot.callbackQuery(/^admin:ad:toggle:(\d+)$/, async (ctx) => {
      const adId = parseInt(ctx.match[1]);
      await this.adminScene.toggleAd(ctx, adId);
    });

    // Удаление
    bot.callbackQuery(/^admin:ad:delete:(\d+)$/, async (ctx) => {
      const adId = parseInt(ctx.match[1]);
      await this.adminScene.deleteAd(ctx, adId);
    });

    // ========== /start ==========
    bot.command('start', async (ctx) => {
      console.log(`📥 /start от пользователя ${ctx.from?.id}`);

      const userId = ctx.from?.id;
      if (!userId) return;

      try {
        // Создаём/обновляем пользователя
        await this.userService.createOrUpdate({
          id: BigInt(userId),
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
        });

        // Проверяем бан
        const isBanned = await this.userService.isBanned(BigInt(userId));
        if (isBanned) {
          await ctx.reply(MESSAGES.ERROR_BANNED);
          return;
        }

        // ✅ ПРОВЕРКА ПОДПИСОК
        const hasSubscription = await this.subscriptionService.checkAll(
          userId,
          bot,
        );

        if (!hasSubscription) {
          const keyboard =
            await this.subscriptionService.getSubscriptionKeyboard();
          await ctx.reply(MESSAGES.SUBSCRIBE_REQUIRED, {
            reply_markup: keyboard,
          });
          return;
        }

        // Если всё ок — показываем главное меню
        await ctx.reply(MESSAGES.START, { parse_mode: 'Markdown' });
        console.log(`✅ Ответ отправлен пользователю ${userId}`);
      } catch (error) {
        console.error('❌ Ошибка в /start:', error);
        await ctx.reply('❌ Произошла ошибка');
      }
    });

    // ========== CALLBACK: проверка подписки ==========
    bot.callbackQuery(/^dl\|(.+)$/, async (ctx) => {
      const [videoId, formatId, resolution] = ctx.match[1].split('|');

      console.log(`📥 Выбор качества: ${resolution} от ${ctx.from?.id}`);

      await this.downloaderService.handleQualitySelection(
        ctx,
        bot, // ← Передаём bot
        videoId,
        formatId,
        resolution,
      );
    });

    // ========== /help ==========
    bot.command('help', async (ctx) => {
      console.log(`📥 /help от пользователя ${ctx.from?.id}`);

      try {
        await ctx.reply(
          `📖 *Помощь*\n\n` +
            `1️⃣ Отправь ссылку на видео\n` +
            `2️⃣ Выбери качество\n` +
            `3️⃣ Получи файл\n\n` +
            `⚡ Повторные запросы отправляются из кэша мгновенно!\n\n` +
            `🔗 Поддерживаемые платформы:\n` +
            `• YouTube • Instagram • TikTok\n` +
            `• Twitter/X • Facebook • И другие!`,
          { parse_mode: 'Markdown' },
        );
      } catch (error) {
        console.error('❌ Ошибка в /help:', error);
      }
    });

    // ========== /stats ==========
    bot.command('stats', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      try {
        const isAdmin = await this.userService.isAdmin(BigInt(userId));
        if (!isAdmin) {
          await ctx.reply(MESSAGES.ERROR_NO_ACCESS);
          return;
        }

        const userStats = await this.userService.getStats();
        const downloaderStats = await this.downloaderService.getStats();

        // ✅ Добавляем статистику сессий
        const sessionsCount = await this.prisma.videoSession.count();

        await ctx.reply(
          `📊 *Статистика*\n\n` +
            `👥 Всего пользователей: ${userStats.totalUsers}\n` +
            `🟢 Активных сегодня: ${userStats.activeToday}\n` +
            `💾 Кеш: ${downloaderStats.cacheSize}\n` +
            `🔄 Активно: ${downloaderStats.activeDownloads}\n` +
            `⏳ Очередь: ${downloaderStats.queueSize}\n` +
            `🎬 Видео-сессий: ${sessionsCount}`, // ← Добавили
          { parse_mode: 'Markdown' },
        );
      } catch (error) {
        console.error('❌ Ошибка в /stats:', error);
      }
    });

    // ========== /channelid ==========
    bot.command('channelid', async (ctx) => {
      console.log(`📥 /channelid от пользователя ${ctx.from?.id}`);

      try {
        await ctx.reply(`Chat ID: \`${ctx.chat?.id}\``, {
          parse_mode: 'Markdown',
        });
      } catch (error) {
        console.error('❌ Ошибка в /channelid:', error);
      }
    });

    // ========== Текстовые сообщения (ссылки) ==========
    bot.on('message:text', async (ctx) => {
      const userId = ctx.from?.id;
      const text = ctx.message?.text;

      if (!userId || !text || text.startsWith('/')) {
        return;
      }

      const url = text.trim();
      if (!url.startsWith('http')) {
        return;
      }

      console.log(`📥 Ссылка от пользователя ${userId}: ${url}`);

      try {
        // Проверяем бан
        const isBanned = await this.userService.isBanned(BigInt(userId));
        if (isBanned) {
          await ctx.reply(MESSAGES.ERROR_BANNED);
          return;
        }

        // ✅ ПРОВЕРКА ПОДПИСОК
        const hasSubscription = await this.subscriptionService.checkAll(
          userId,
          bot,
        );
        if (!hasSubscription) {
          const keyboard =
            await this.subscriptionService.getSubscriptionKeyboard();
          await ctx.reply(MESSAGES.SUBSCRIBE_REQUIRED, {
            reply_markup: keyboard,
          });
          return;
        }
        await this.downloaderService.handleUrl(ctx, url);
        // TODO: Передать в DownloaderService
      } catch (error) {
        console.error('❌ Ошибка при обработке ссылки:', error);
        await ctx.reply('❌ Произошла ошибка');
      }
    });

    console.log('✅ Все обработчики зарегистрированы');
  }

  private async startBot() {
    const bot = this.botService.getBot();
    console.log('🚀 Запуск бота...');

    try {
      await bot.start({
        onStart: (botInfo) => {
          console.log('\n🦍 ========================================');
          console.log(`   BOT STARTED: @${botInfo.username}`);
          console.log('========================================\n');
        },
      });
    } catch (error) {
      console.error('❌ Ошибка при запуске бота:', error);
      throw error;
    }
  }
}
