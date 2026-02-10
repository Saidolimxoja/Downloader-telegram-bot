import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from './cache.service';

@Injectable()
export class CacheCleanupService {
  private readonly logger = new Logger(CacheCleanupService.name);

  constructor(private cacheService: CacheService) {}

  /**
   * Очистка старого кеша (раз в день в 3:00)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanOldCache() {
    this.logger.log('🗑️ Запуск очистки старого кеша...');

    try {
      const deleted = await this.cacheService.cleanOldCache(30); // 30 дней

      if (deleted > 0) {
        this.logger.log(`✅ Удалено ${deleted} старых записей`);
      } else {
        this.logger.log('✅ Нет старых записей для удаления');
      }
    } catch (error: any) {
      this.logger.error(`❌ Ошибка очистки кеша: ${error.message}`);
    }
  }

  /**
   * Статистика кеша (раз в неделю в понедельник в 10:00)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async logCacheStats() {
    this.logger.log('📊 Статистика кеша...');

    try {
      const stats = await this.cacheService.getStats();

      const totalSizeMB = Number(stats.totalSizeBytes) / (1024 * 1024);

      this.logger.log(
        `📊 Кеш: ${stats.totalFiles} файлов, ${totalSizeMB.toFixed(2)} MB, ` +
          `${stats.memoryCacheSize} в памяти`,
      );
    } catch (error: any) {
      this.logger.error(`❌ Ошибка получения статистики: ${error.message}`);
    }
  }
}
