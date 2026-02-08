// src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // ✅ КРИТИЧНО: Включаем lifecycle hooks
  app.enableShutdownHooks();

  // Глобальная валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Создаём папку для загрузок
  const downloadsDir = process.env.DOWNLOADS_DIR || './downloads';
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log('\n🦍 ========================================');
  console.log('   KINGKONG BOT');
  console.log('========================================');
  console.log(`🚀 App running on: http://localhost:${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log('========================================\n');
}

bootstrap();