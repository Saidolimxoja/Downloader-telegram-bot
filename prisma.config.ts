// prisma.config.ts
import 'dotenv/config';  // загружает .env автоматически

export default {
  schema: 'prisma/schema.prisma',           // путь к вашей схеме (обычно так)
  migrations: {
    path: 'prisma/migrations',              // куда сохраняются миграции
  },
  datasource: {
    url: process.env.DATABASE_URL,          // берём из .env
  },
};