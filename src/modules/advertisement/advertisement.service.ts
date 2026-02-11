import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Advertisement } from '@prisma/client';
import { Context, InlineKeyboard } from 'grammy';
import { CreateAdDto } from './dto/create-ad.dto';

@Injectable()
export class AdvertisementService {
  private readonly logger = new Logger(AdvertisementService.name);
  private userDownloadCounts = new Map<bigint, number>();

  constructor(private prisma: PrismaService) {}

  /**
   * Проверить нужно ли показать рекламу пользователю
   */
  async shouldShowAd(userId: bigint): Promise<boolean> {
    const activeAds = await this.getActiveAds();

    if (activeAds.length === 0) {
      return false;
    }

    // Получаем количество загрузок пользователя с момента последней рекламы
    const count = this.userDownloadCounts.get(userId) || 0;

    // Берём минимальный интервал среди активных объявлений
    const minInterval = Math.min(...activeAds.map((ad) => ad.showInterval));

    if (count >= minInterval) {
      this.userDownloadCounts.set(userId, 0); // Сбрасываем счётчик
      return true;
    }

    return false;
  }

  /**
   * Увеличить счётчик загрузок для пользователя
   */
  incrementUserDownloads(userId: bigint): void {
    const current = this.userDownloadCounts.get(userId) || 0;
    this.userDownloadCounts.set(userId, current + 1);

    this.logger.debug(`Пользователь ${userId}: ${current + 1} загрузок`);
  }

  /**
   * Показать рекламу пользователю
   */
  async showAd(ctx: Context): Promise<void> {
    if (!ctx.from) {
      this.logger.warn('Cannot show advertisement: ctx.from is missing');
      return;
    }
    const userId = BigInt(ctx.from.id);
    const ads = await this.getActiveAds();

    if (ads.length === 0) {
      return;
    }

    // Выбираем случайное объявление
    const ad = ads[Math.floor(Math.random() * ads.length)];

    this.logger.log(`📣 Показ рекламы ID:${ad.id} пользователю ${userId}`);

    try {
      const keyboard = new InlineKeyboard();

      if (ad.buttonText && ad.buttonUrl) {
        keyboard.url(ad.buttonText, ad.buttonUrl);
      }

      // Записываем просмотр
      await this.recordView(ad.id, userId);

      // Отправляем рекламу
      if (ad.mediaFileId) {
        await ctx.replyWithPhoto(ad.mediaFileId, {
          caption: ad.content,
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(ad.content, {
          reply_markup: keyboard,
        });
      }

      this.logger.log(`✅ Реклама показана пользователю ${userId}`);
    } catch (error: any) {
      this.logger.error(`❌ Ошибка показа рекламы: ${error.message}`);
    }
  }

  /**
   * Записать просмотр рекламы
   */
  private async recordView(adId: number, userId: bigint): Promise<void> {
    await Promise.all([
      // Создаём запись просмотра
      this.prisma.advertisementView.create({
        data: {
          adId,
          userId,
        },
      }),
      // Увеличиваем счётчик просмотров
      this.prisma.advertisement.update({
        where: { id: adId },
        data: {
          viewCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Записать клик по рекламе
   */
  async recordClick(adId: number, userId: bigint): Promise<void> {
    await Promise.all([
      // Обновляем запись просмотра
      this.prisma.advertisementView.updateMany({
        where: {
          adId,
          userId,
          clicked: false,
        },
        data: {
          clicked: true,
        },
      }),
      // Увеличиваем счётчик кликов
      this.prisma.advertisement.update({
        where: { id: adId },
        data: {
          clickCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Получить активные объявления
   */
  async getActiveAds(): Promise<Advertisement[]> {
    return this.prisma.advertisement.findMany({
      where: { isActive: true },
    });
  }

  /**
   * Получить все объявления (для админки)
   */
  async getAll(): Promise<Advertisement[]> {
    return this.prisma.advertisement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Создать объявление
   */
  async create(dto: CreateAdDto): Promise<Advertisement> {
    return this.prisma.advertisement.create({
      data: {
        content: dto.content,
        mediaFileId: dto.mediaFileId,
        buttonText: dto.buttonText,
        buttonUrl: dto.buttonUrl,
        isActive: dto.isActive ?? true,
        showInterval: dto.showInterval ?? 5,
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.advertisement.findUnique({
      where: { id },
    });
  }

  async update(id: number, data: Partial<CreateAdDto>) {
    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.mediaFileId !== undefined && {
          mediaFileId: data.mediaFileId,
        }),
        ...(data.buttonText !== undefined && { buttonText: data.buttonText }),
        ...(data.buttonUrl !== undefined && { buttonUrl: data.buttonUrl }),
        ...(data.showInterval && { showInterval: data.showInterval }),
      },
    });
  }

  /**
   * Удалить объявление
   */
  async delete(id: number): Promise<void> {
    await this.prisma.advertisement.delete({
      where: { id },
    });
  }

  /**
   * Переключить активность
   */
  async toggleActive(id: number): Promise<Advertisement> {
    const ad = await this.prisma.advertisement.findUnique({
      where: { id },
    });

    if (!ad) {
      throw new Error('Объявление не найдено');
    }

    return this.prisma.advertisement.update({
      where: { id },
      data: { isActive: !ad.isActive },
    });
  }

  /**
   * Получить статистику объявления
   */
  async getAdStats(id: number) {
    const ad = await this.prisma.advertisement.findUnique({
      where: { id },
      include: {
        views: true,
      },
    });

    if (!ad) {
      throw new Error('Объявление не найдено');
    }

    const ctr =
      ad.viewCount > 0
        ? ((ad.clickCount / ad.viewCount) * 100).toFixed(2)
        : '0.00';

    return {
      ...ad,
      ctr: `${ctr}%`,
      uniqueViews: new Set(ad.views.map((v) => v.userId.toString())).size,
    };
  }

  /**
   * Общая статистика всех объявлений
   */
  async getTotalStats() {
    const ads = await this.prisma.advertisement.findMany();

    const totalViews = ads.reduce((sum, ad) => sum + ad.viewCount, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clickCount, 0);
    const ctr =
      totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00';

    return {
      totalAds: ads.length,
      activeAds: ads.filter((ad) => ad.isActive).length,
      totalViews,
      totalClicks,
      ctr: `${ctr}%`,
    };
  }
}
