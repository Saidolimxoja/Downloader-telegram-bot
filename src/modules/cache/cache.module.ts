// src/modules/cache/cache.module.ts

import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheCleanupService } from './cache-cleanup.service';

@Module({
  providers: [CacheService, CacheCleanupService],
  exports: [CacheService],
})
export class CacheModule {}