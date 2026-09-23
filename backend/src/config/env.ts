import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  publicServerUrl: process.env.PUBLIC_SERVER_URL || 'http://localhost:3000',
  databaseUrl:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_CONNECTION_STRING ||
    process.env.POSTGRES_URI ||
    'file:./dev.db',
  
  // Security
  internalSmsSyncKey: process.env.INTERNAL_SMS_SYNC_KEY || 'prime_sms_secret_token_8899aabbcc',
  
  // Wuilt
  wuiltApiKey: process.env.WUILT_API_KEY || '',
  wuiltWebhookSecret: process.env.WUILT_WEBHOOK_SECRET || '',
  wuiltStoreId: process.env.WUILT_STORE_ID || '',
  
  // WhatsApp Cloud API
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'prime_wa_webhook_verify_token',
  branchGroupId: process.env.BRANCH_GROUP_ID || '',
  
  // Vision Provider
  visionProvider: (process.env.VISION_PROVIDER || 'openai').toLowerCase(),
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  
  // Queue & Redis
  redisUrl: process.env.REDIS_URL || '',
  
  // Financial Thresholds
  depositThresholdEgp: parseFloat(process.env.DEPOSIT_THRESHOLD_EGP || '190'),
  targetDepositEgp: parseFloat(process.env.TARGET_DEPOSIT_EGP || '200'),
  matchingWindowMinutes: parseInt(process.env.MATCHING_WINDOW_MINUTES || '30', 10),

  // Puppeteer Chromium Path (Linux cloud container)
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '',

  // Web QR Security Key
  adminQrKey: process.env.ADMIN_QR_KEY || '',

  // Customer Suppression List (Safety against duplicate messages for manually handled orders)
  suppressedPhones: (process.env.SUPPRESSED_PHONES || '')
    .split(',')
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean),
  suppressedOrders: (process.env.SUPPRESSED_ORDERS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
