import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Bot
  BOT_TOKEN: Joi.string().required(),
  YOUR_USERNAME: Joi.string().required(),
  
  // MTProto
  API_ID: Joi.number().required(),
  API_HASH: Joi.string().required(),
  SESSION_STRING: Joi.string().allow('').optional(),
  
  // Channels
  CHANNEL_ID: Joi.string().required(),
  
  // Admin
  ADMIN_USER_ID: Joi.number().required(),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  
  // App
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Paths
  YTDLP_PATH: Joi.string().default('yt-dlp'),
  DOWNLOADS_DIR: Joi.string().default('./downloads'),
  
  // Queue
  MAX_PARALLEL_DOWNLOADS: Joi.number().default(3),
  MAX_QUEUE_SIZE: Joi.number().default(50),
})