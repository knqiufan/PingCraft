import { Sequelize } from 'sequelize';
import { SeekdbClient } from 'seekdb';
import { appConfig } from '../config/index.js';

const { seekdb: dbConf } = appConfig;

/** 关系数据库（OceanBase/MySQL 兼容） */
export const sequelize = new Sequelize(
  dbConf.database,
  dbConf.user,
  dbConf.password,
  {
    host: dbConf.host,
    port: dbConf.port,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000,
      /** 断线后自动剔除并重建连接，避免 SeekDB 重启后使用失效连接 */
      evict: 5000,
    },
  }
);

/** 向量数据库客户端 */
export const seekdbClient = new SeekdbClient({
  host: dbConf.host,
  port: dbConf.port,
  user: dbConf.user,
  password: dbConf.password,
  database: dbConf.database,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 连接关系数据库并同步模型 */
async function connectRelational() {
  await sequelize.authenticate();
  // 动态导入确保模型已注册
  await import('../models/User.js');
  await import('../models/WorkItemType.js');
  await import('../models/WorkItemState.js');
  await import('../models/WorkItemProperty.js');
  await import('../models/WorkItemPriority.js');
  await import('../models/SyncedProject.js');
  await import('../models/SyncedWorkItem.js');
  await sequelize.sync({ alter: true });
  console.log('[DB] 关系数据库已连接');
}

/** 初始化向量集合 */
async function initCollections() {
  const collections = ['projects', 'work_items'];
  for (const name of collections) {
    try {
      await seekdbClient.createCollection({ name });
    } catch {
      // 集合已存在则忽略
    }
  }
}

/** 初始化数据库（带重试） */
export async function initDB() {
  const { retryCount, retryIntervalMs } = dbConf;

  for (let i = 0; i < retryCount; i++) {
    try {
      await connectRelational();
      await initCollections();
      console.log('[DB] SeekDB 向量数据库已连接');
      return;
    } catch (err) {
      if (i === retryCount - 1) {
        console.error('[DB] 数据库连接失败，请确认 SeekDB 服务已启动。', err.message);
        throw err;
      }
      console.warn(`[DB] 连接失败，${retryIntervalMs}ms 后重试（${i + 1}/${retryCount}）`);
      await sleep(retryIntervalMs);
    }
  }
}
