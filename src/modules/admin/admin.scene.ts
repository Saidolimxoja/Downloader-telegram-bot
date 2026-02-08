import { Injectable, Logger } from '@nestjs/common';
import { Context, InlineKeyboard } from 'grammy';
import { AdvertisementService } from '../advertisement/advertisement.service';
import { ChannelService } from '../channel/channel.service';
import { UserService } from '../user/user.service';

@Injectable()
export class AdminScene {
  private readonly logger = new Logger(AdminScene.name);
  private readonly adminStates = new Map<number, string>();

  constructor(
    private advertisementService: AdvertisementService,
    private channelService: ChannelService,
    private userService: UserService,
  ) {}

  /**
   * Главное меню админки
   */
  async showMainMenu(ctx: Context): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('📣 Управление рекламой', 'admin:ads')
      .row()
      .text('📢 Управление каналами', 'admin:channels')
      .row()
      .text('📊 Статистика', 'admin:stats');

    await ctx.reply('⚙️ *Админ-панель*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  /**
   * Меню рекламы
   */
  async showAdsMenu(ctx: Context): Promise<void> {
    const ads = await this.advertisementService.getAll();
    const stats = await this.advertisementService.getTotalStats();

    let message = `📣 *Реклама*\n\n`;
    message += `📊 Общая статистика:\n`;
    message += `• Всего объявлений: ${stats.totalAds}\n`;
    message += `• Активных: ${stats.activeAds}\n`;
    message += `• Просмотров: ${stats.totalViews}\n`;
    message += `• Кликов: ${stats.totalClicks}\n`;
    message += `• CTR: ${stats.ctr}\n\n`;

    if (ads.length > 0) {
      message += `*Объявления:*\n\n`;
      for (const ad of ads) {
        const status = ad.isActive ? '✅' : '❌';
        const preview = ad.content.substring(0, 30) + (ad.content.length > 30 ? '...' : '');
        message += `${status} ID:${ad.id} - ${preview}\n`;
        message += `   👁 ${ad.viewCount} | 👆 ${ad.clickCount} | ⏱ каждые ${ad.showInterval}\n\n`;
      }
    } else {
      message += `_Нет объявлений_\n\n`;
    }

    const keyboard = new InlineKeyboard()
      .text('➕ Создать объявление', 'admin:ad:create')
      .row()
      .text('📝 Редактировать', 'admin:ad:list:edit')
      .text('🗑 Удалить', 'admin:ad:list:delete')
      .row()
      .text('🔄 Вкл/Выкл', 'admin:ad:list:toggle')
      .row()
      .text('« Назад', 'admin:main');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  /**
   * Список объявлений для действия
   */
  async showAdsList(ctx: Context, action: 'edit' | 'delete' | 'toggle'): Promise<void> {
    const ads = await this.advertisementService.getAll();

    if (ads.length === 0) {
      await ctx.answerCallbackQuery({ text: 'Нет объявлений' });
      return;
    }

    const keyboard = new InlineKeyboard();

    ads.forEach((ad) => {
      const status = ad.isActive ? '✅' : '❌';
      const preview = ad.content.substring(0, 20);
      keyboard.text(`${status} ${ad.id}: ${preview}`, `admin:ad:${action}:${ad.id}`).row();
    });

    keyboard.text('« Назад', 'admin:ads');

    const actionText = {
      edit: 'редактирования',
      delete: 'удаления',
      toggle: 'переключения',
    }[action];

    await ctx.editMessageText(`Выберите объявление для ${actionText}:`, {
      reply_markup: keyboard,
    });
  }

  /**
   * Переключить активность объявления
   */
  async toggleAd(ctx: Context, adId: number): Promise<void> {
    try {
      const ad = await this.advertisementService.toggleActive(adId);
      const status = ad.isActive ? 'активировано' : 'деактивировано';
      
      await ctx.answerCallbackQuery({ text: `✅ Объявление ${status}` });
      await this.showAdsMenu(ctx);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: '❌ Ошибка' });
    }
  }

  /**
   * Удалить объявление
   */
  async deleteAd(ctx: Context, adId: number): Promise<void> {
    try {
      await this.advertisementService.delete(adId);
      await ctx.answerCallbackQuery({ text: '✅ Объявление удалено' });
      await this.showAdsMenu(ctx);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: '❌ Ошибка' });
    }
  }

  /**
   * Меню каналов
   */
  async showChannelsMenu(ctx: Context): Promise<void> {
    const channels = await this.channelService.getAll();

    let message = `📢 *Обязательные каналы*\n\n`;

    if (channels.length > 0) {
      for (const channel of channels) {
        const status = channel.isActive ? '✅' : '❌';
        message += `${status} ${channel.channelName}\n`;
        message += `   ID: \`${channel.channelId}\`\n`;
        message += `   Приоритет: ${channel.priority}\n\n`;
      }
    } else {
      message += `_Нет каналов_\n\n`;
    }

    const keyboard = new InlineKeyboard()
      .text('➕ Добавить канал', 'admin:channel:create')
      .row()
      .text('🔄 Вкл/Выкл', 'admin:channel:list:toggle')
      .text('🗑 Удалить', 'admin:channel:list:delete')
      .row()
      .text('« Назад', 'admin:main');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  /**
   * Показать статистику
   */
  async showStats(ctx: Context): Promise<void> {
    const userStats = await this.userService.getStats();
    const adStats = await this.advertisementService.getTotalStats();

    const message =
      `📊 *Статистика бота*\n\n` +
      `👥 *Пользователи:*\n` +
      `• Всего: ${userStats.totalUsers}\n` +
      `• Активных сегодня: ${userStats.activeToday}\n\n` +
      `📣 *Реклама:*\n` +
      `• Объявлений: ${adStats.totalAds} (${adStats.activeAds} активных)\n` +
      `• Просмотров: ${adStats.totalViews}\n` +
      `• Кликов: ${adStats.totalClicks}\n` +
      `• CTR: ${adStats.ctr}`;

    const keyboard = new InlineKeyboard().text('« Назад', 'admin:main');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}