import { Injectable } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { ChannelService } from '../channel/channel.service';

@Injectable()
export class SubscriptionService {
  constructor(private channelService: ChannelService) {}

  /**
   * Проверить подписан ли пользователь на все каналы
   */
  async checkAll(userId: number, bot: Bot<Context>): Promise<boolean> {
    const channels = await this.channelService.getActiveChannels();

    if (channels.length === 0) {
      // Если нет обязательных каналов — пропускаем проверку
      return true;
    }

    for (const channel of channels) {
      try {
        const member = await bot.api.getChatMember(channel.channelId, userId);


        const validStatuses = ['member', 'administrator', 'creator'];
        if (!validStatuses.includes(member.status)) {
          console.log(
            `❌ Пользователь ${userId} не подписан на ${channel.channelName}`,
          );
          

          return false;
        }
      } catch (error) {
        console.error(`❌ Ошибка проверки канала ${channel.channelId}:`, error);
        // Если бот не админ в канале или канал не найден — считаем что не подписан
        return false;
      }
    }

    console.log(`✅ Пользователь ${userId} подписан на все каналы`);
    return true;
  }

  /**
   * Получить клавиатуру с кнопками подписки
   */
  async getSubscriptionKeyboard(): Promise<InlineKeyboard> {
    const channels = await this.channelService.getActiveChannels();
    const keyboard = new InlineKeyboard();

    for (const channel of channels) {
      const buttonText = `📢 ${channel.channelName}`;
      const url =
        channel.channelLink ||
        `https://t.me/${channel.channelId.replace('@', '')}`;
      keyboard.url(buttonText, url).row();
    }

    // Кнопка проверки
    keyboard.text('✅ Проверить подписку', 'check_subscription');

    return keyboard;
  }
}
