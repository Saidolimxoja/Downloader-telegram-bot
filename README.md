# 🦍KING-KONG BOT

Мощный Telegram бот для скачивания видео и аудио с YouTube, Instagram, и других платформ.

## ✨ Возможности

- 📥 **Скачивание видео/аудио** с 50+ платформ
- ⚡ **Мгновенный кеш** — повторные запросы отправляются моментально
- 📺 **Потоковое воспроизведение** — смотри без скачивания
- 💎 **Файлы до 2GB** — поддержка больших файлов через MTProto
- 📢 **Обязательные подписки** — требуй подписку на каналы
- 📣 **Система рекламы** — монетизация через показ объявлений
- 👨‍💼 **Админ-панель** — управление через Telegram
- 📊 **Статистика** — отслеживание пользователей и загрузок

---

## 🛠️ Технологии

- **NestJS** — фреймворк
- **Grammy** — Telegram Bot API
- **Prisma** — ORM для PostgreSQL
- **telegram** (MTProto) — загрузка больших файлов
- **yt-dlp** — скачивание медиа
- **ffmpeg** — обработка видео

---

## 📦 Установка

### **Требования**

- Node.js 18+
- PostgreSQL 15+
- yt-dlp
- ffmpeg

### **1. Клонируй репозиторий**
```bash
git clone https://github.com/Saidolimxoja/kingkong-bot.git
cd kingkong-bot
```

### **2. Установи зависимости**
```bash
npm install
```

### **3. Настрой .env**

Скопируй `.env.example` в `.env` и заполни:
```bash
cp .env.example .env
```
```env
# Bot
BOT_TOKEN=your_bot_token_from_botfather
YOUR_USERNAME=@your_bot_username

# MTProto
API_ID=12345678
API_HASH=your_api_hash_from_my_telegram_org
SESSION_STRING=your_session_string

# Channels
CHANNEL_ID=-1001234567890

# Admin
ADMIN_USER_ID=your_telegram_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kingkong_bot

# App
NODE_ENV=development
PORT=3000

# Paths
YTDLP_PATH=yt-dlp
DOWNLOADS_DIR=./downloads

# Queue
MAX_PARALLEL_DOWNLOADS=3
MAX_QUEUE_SIZE=50
```

### **4. Настрой базу данных**
```bash
# Создай БД
createdb kingkong_bot

# Примени миграции
npx prisma migrate dev

# (Опционально) Заполни тестовыми данными
npx prisma db seed
```

### **5. Получи SESSION_STRING**
```bash
node scripts/get-session.js
```

Следуй инструкциям и скопируй `SESSION_STRING` в `.env`.

### **6. Запусти бота**
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

---

## 🎯 Использование

### **Для пользователей**

1. `/start` — Запуск бота
2. Отправь ссылку на видео
3. Выбери качество
4. Получи файл

### **Для администраторов**

1. `/admin` — Админ-панель
2. Управляй рекламой, каналами и статистикой

---

## 🔧 Команды разработчика
```bash
# Разработка
npm run start:dev          # Запуск с hot-reload
npm run build              # Сборка проекта
npm run start:prod         # Запуск production

# База данных
npx prisma migrate dev     # Создать миграцию
npx prisma migrate deploy  # Применить миграции (prod)
npx prisma studio          # UI для БД
npx prisma generate        # Генерация Prisma Client
npx prisma db seed         # Заполнить тестовыми данными

# Линтинг
npm run lint               # Проверка кода
npm run lint:fix           # Исправление ошибок

# Тесты
npm run test               # Unit тесты
npm run test:e2e           # E2E тесты
npm run test:cov           # Coverage
```

---

## 📁 Структура проекта
```
kingkong-bot/
├── prisma/
│   ├── schema.prisma          # БД схема
│   ├── migrations/            # Миграции
│   └── seed.ts                # Тестовые данные
│
├── src/
│   ├── main.ts                # Entry point
│   ├── app.module.ts          # Root модуль
│   │
│   ├── config/                # Конфигурация
│   ├── common/                # Утилиты
│   ├── database/              # Prisma
│   │
│   └── modules/
│       ├── bot/               # Grammy бот
│       ├── user/              # Пользователи
│       ├── subscription/      # Подписки
│       ├── channel/           # Каналы
│       ├── downloader/        # Скачивание
│       ├── cache/             # Кеширование
│       ├── uploader/          # Загрузка в TG
│       ├── mtproto/           # MTProto клиент
│       ├── advertisement/     # Реклама
│       └── admin/             # Админка
│
├── scripts/                   # Утилиты
├── .env                       # Переменные окружения
├── package.json
└── README.md
```

---


### **Ошибка "chat not found"**

Убедись что бот добавлен в канал как администратор:
```bash
# Проверь через команду
/checkchannels
```

### **Ошибка MTProto**

Получи новый `SESSION_STRING`:
```bash
node scripts/get-session.js
```

### **yt-dlp не работает**

Обнови до последней версии:
```bash
pip3 install --upgrade yt-dlp
```

---

## 📝 Лицензия

MIT

---

## 🤝 Вклад

Pull requests приветствуются!

1. Fork проекта
2. Создай feature ветку (`git checkout -b feature/amazing`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing`)
5. Открой Pull Request

---

## 📞 Поддержка

- Telegram: [@KINGOLIMXOJA](https://t.me/KINGOLIMXOJA)
- Issues: [GitHub Issues](https://github.com/yourusername/kingkong-bot/issues)

---

## 🙏 Благодарности

- [NestJS](https://nestjs.com/)
- [Grammy](https://grammy.dev/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Prisma](https://www.prisma.io/)

---

**Сделано с ❤️ by [@KINGOLIMXOJA](https://t.me/KINGOLIMXOJA)**
