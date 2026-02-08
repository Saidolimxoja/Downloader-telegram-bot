// src/modules/bot/bot.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { Context } from 'grammy';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  public bot: Bot<Context>;

  constructor(private config: ConfigService) {
    console.log('🔧 BotService: constructor вызван');

    const token = this.config.get<string>('BOT_TOKEN');

    if (!token) {
      throw new Error('❌ BOT_TOKEN не найден в .env');
    }

    console.log(`🔑 BOT_TOKEN: ${token.substring(0, 10)}...`);

    this.bot = new Bot<Context>(token);
    console.log('✅ Grammy Bot создан');
  }

  async onModuleInit() {
    try {
      console.log('🚀 BotService: onModuleInit начат');

      // Проверяем подключение
      const me = await this.bot.api.getMe();
      console.log(`✅ Бот авторизован: @${me.username} (ID: ${me.id})`);

      // Устанавливаем команды
      await this.bot.api.setMyCommands([
        { command: 'start', description: 'Запуск бота' },
        { command: 'help', description: 'Помощь' },
        { command: 'stats', description: 'Статистика' },
        { command: 'channelid', description: 'Получить ID чата' },
        { command: 'checkchannels', description: 'Проверка каналов (админ)' },
        { command: 'admin', description: 'Админ-панель (админ)' }, // ← Добавь
      ]);
      console.log('✅ Команды установлены');

      // Обработка ошибок
      this.bot.catch((err) => {
        console.error('❌ Grammy error:', err);
      });

      // Запускаем бота
      await this.bot.start({
        onStart: (botInfo) => {
          console.log(`\n🦍 ========================================`);
          console.log(`   BOT STARTED: @${botInfo.username}`);
          console.log(`========================================\n`);
        },
      });
    } catch (error) {
      console.error('❌ Ошибка при запуске бота:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    console.log('🛑 Остановка бота...');
    await this.bot.stop();
  }

  getBot(): Bot<Context> {
    return this.bot;
  }
}
