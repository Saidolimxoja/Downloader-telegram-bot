// scripts/get-session.js

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
require('dotenv').config();

const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;

(async () => {
  console.log('🔐 Получение SESSION_STRING...\n');

  const client = new TelegramClient(
    new StringSession(''),
    API_ID,
    API_HASH,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () => await input.text('📱 Номер телефона (+998...): '),
    password: async () => await input.text('🔒 Пароль 2FA (Enter если нет): '),
    phoneCode: async () => await input.text('💬 Код из Telegram: '),
    onError: (err) => console.error('❌ Ошибка:', err),
  });

  console.log('\n✅ Авторизация успешна!\n');
  console.log('📝 Добавь это в .env:\n');
  console.log('SESSION_STRING=' + client.session.save());
  console.log('\n');

  process.exit(0);
})();