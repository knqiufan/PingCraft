import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 根据 NODE_ENV 加载对应的环境配置文件
 * 加载顺序：先加载 .env（基础），再加载 .env.{NODE_ENV}（覆盖）
 */
function loadEnv() {
  // 先加载基础 .env
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  const env = process.env.NODE_ENV || 'development';
  const envFile = path.resolve(__dirname, `../../.env.${env}`);

  // 加载对应环境文件（override = true 表示覆盖已有值）
  dotenv.config({ path: envFile, override: true });
}

loadEnv();

/** 统一导出的配置对象 */
export const appConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_key',
  },

  pingcode: {
    clientId: process.env.PINGCODE_CLIENT_ID || '',
    clientSecret: process.env.PINGCODE_CLIENT_SECRET || '',
    redirectUri: process.env.PINGCODE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    host: process.env.PINGCODE_HOST || 'https://open.pingcode.com',
  },

  llm: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || '',
    model: process.env.OPENAI_MODEL || 'deepseek-chat',
  },

  seekdb: {
    host: process.env.SEEKDB_HOST || '127.0.0.1',
    port: parseInt(process.env.SEEKDB_PORT || '2881', 10),
    user: process.env.SEEKDB_USER || 'root',
    password: process.env.SEEKDB_PASSWORD || '',
    database: process.env.SEEKDB_DATABASE || 'pingcode_agent',
    retryCount: parseInt(process.env.SEEKDB_RETRY_COUNT || '5', 10),
    retryIntervalMs: parseInt(process.env.SEEKDB_RETRY_INTERVAL_MS || '2000', 10),
    /** 同步工作项时每批数量，2c2g 建议 20-30，4g+ 可调高 */
    syncWorkItemBatchSize: parseInt(process.env.SYNC_WORK_ITEM_BATCH_SIZE || '25', 10),
    /** 批次间延迟（毫秒），缓解 embedding 模型内存压力 */
    syncBatchDelayMs: parseInt(process.env.SYNC_BATCH_DELAY_MS || '500', 10),
  },
};
