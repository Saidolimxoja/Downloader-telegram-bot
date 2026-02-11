import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequiredChannel } from '@prisma/client';

@Injectable()
export class ChannelService {
  constructor(private prisma: PrismaService) {}

  /**
   * Получить все активные обязательные каналы
   */
  async getActiveChannels(): Promise<RequiredChannel[]> {
    const channelActive = this.prisma.requiredChannel.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });
    return channelActive;
  }

  /**
   * Создать канал
   */
  async create(data: {
    channelId: string;
    channelName: string;
    channelLink: string;
    priority?: number;
  }): Promise<RequiredChannel> {
    return this.prisma.requiredChannel.create({
      data: {
        channelId: data.channelId,
        channelName: data.channelName,
        channelLink: data.channelLink,
        priority: data.priority ?? 0,
      },
    });
  }

  /**
   * Удалить канал
   */
  async delete(id: number): Promise<void> {
    await this.prisma.requiredChannel.delete({
      where: { id },
    });
  }

  /**
   * Переключить активность канала
   */
  async toggle(id: number): Promise<RequiredChannel> {
    const channel = await this.prisma.requiredChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    return this.prisma.requiredChannel.update({
      where: { id },
      data: { isActive: !channel.isActive },
    });
  }

  /**
   * Получить все каналы (для админки)
   */
  async getAll(): Promise<RequiredChannel[]> {
    return this.prisma.requiredChannel.findMany({
      orderBy: { priority: 'asc' },
    });
  }
}
