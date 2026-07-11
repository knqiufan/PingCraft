import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { appConfig } from './config/index.js';
import { sequelize, seekdbClient } from './services/db.js';
import { requireAuth } from './middleware/auth.js';
import { requireAdmin } from './middleware/permission.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { success } from './utils/response.js';
import authRoutes from './routes/auth.js';
import localAuthRoutes from './routes/localAuth.js';
import configRoutes from './routes/config.js';
import syncRoutes from './routes/sync.js';
import analyzeRoutes from './routes/analyze.js';
import workItemRoutes from './routes/workItems.js';
import metadataRoutes from './routes/metadata.js';
import modelsRoutes from './routes/models.js';
import recordsRoutes from './routes/records.js';
import rolesRoutes from './routes/roles.js';
import usersRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/* ---- 全局中间件 ---- */
const allowedOrigins = Array.isArray(appConfig.cors.origin)
  ? appConfig.cors.origin
  : [appConfig.cors.origin];

app.use(cors({
  origin: (origin, callback) => {
    // 允许同源请求（无 Origin header，如服务器端请求或同源浏览器请求）
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false); // 不允许的源：不设置 CORS 头，浏览器会拦截
    }
  },
  credentials: true,
  // 暴露滑动续期自定义响应头，供前端读取（P2-4.3）
  exposedHeaders: ['X-Refreshed-Token'],
}));
// 显式限制请求体大小（默认 100kb 对大批量导入场景不足；5mb 兼顾大文档与 DoS 防护）
app.use(express.json({ limit: '5mb' }));
app.use(requestLogger);

/* ---- 审计日志查询（仅 admin，P3-5.9） ---- */
app.get('/api/audit-logs', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { getAuditLogs } = await import('./services/auditLog.js');
    const logs = getAuditLogs({
      userId: req.query.userId || undefined,
      action: req.query.action || undefined,
      limit: parseInt(req.query.limit || '100', 10),
    });
    res.json(success(logs));
  } catch (e) {
    next(e);
  }
});

/* ---- 健康检查（无需认证，供容器编排探针使用） ---- */
app.get('/health', async (_req, res) => {
  const checks = {};
  let allOk = true;

  // 关系数据库连通性
  try {
    await sequelize.authenticate();
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'error';
    allOk = false;
  }

  // 向量数据库连通性（SeekDB 复用同一 MySQL 协议连接，authenticate 通过即可认为向量库可用）
  try {
    const coll = await seekdbClient.getCollection({ name: 'projects' }).catch(() => null);
    checks.vectorDB = coll ? 'ok' : 'degraded';
  } catch {
    checks.vectorDB = 'degraded';
  }

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'error',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/* ---- 路由 ---- */
app.use('/auth', authRoutes);
app.use('/auth/local', localAuthRoutes);
app.use('/api', configRoutes);
app.use('/api', syncRoutes);
app.use('/api', analyzeRoutes);
app.use('/api', workItemRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);

const publicDir = path.join(__dirname, '../public');

app.get('/', (_req, res) => {
  if (appConfig.env === 'production' && fs.existsSync(publicDir)) {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  res.json({ message: 'PingCraft 后端服务运行中', env: appConfig.env });
});

/* ---- 生产环境：托管前端静态资源与 SPA 回退（Docker 同源部署） ---- */
if (appConfig.env === 'production' && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

/* ---- 统一错误处理（必须在路由之后） ---- */
app.use(errorHandler);

export default app;
