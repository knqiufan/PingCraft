import { Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';
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
  // 导入 models/index.js 以确保所有模型和关联关系都被注册
  await import('../models/index.js');
  await sequelize.sync({ alter: true });
  console.log('[DB] 关系数据库已连接');
}

/** 初始化默认角色 */
async function initDefaultRoles() {
  const { Role } = await import('../models/index.js');

  const defaultRoles = [
    {
      name: 'admin',
      display_name: '管理员',
      description: '系统管理员，拥有所有权限',
      is_system: true,
    },
    {
      name: 'user',
      display_name: '普通用户',
      description: '普通用户，拥有基本权限',
      is_system: true,
    },
  ];

  for (const roleData of defaultRoles) {
    const [role, created] = await Role.findOrCreate({
      where: { name: roleData.name },
      defaults: roleData,
    });
    if (created) {
      console.log(`[DB] 创建默认角色: ${role.display_name}`);
    }
  }
}

/** 初始化默认管理员账号（admin / qwe@123） */
async function initDefaultAdmin() {
  const { User, Role, UserRole } = await import('../models/index.js');

  const existingUser = await User.findOne({ where: { username: 'admin' } });
  if (existingUser) {
    return;
  }

  const passwordHash = await bcrypt.hash('qwe@123', 10);
  const adminRole = await Role.findOne({ where: { name: 'admin' } });
  if (!adminRole) {
    console.warn('[DB] 未找到 admin 角色，跳过创建默认管理员');
    return;
  }

  const user = await User.create({
    username: 'admin',
    password_hash: passwordHash,
  });
  await UserRole.create({
    user_id: user.id,
    role_id: adminRole.id,
  });
  console.log('[DB] 创建默认管理员账号: admin / qwe@123');
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
      await initDefaultRoles();
      await initDefaultAdmin();
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
