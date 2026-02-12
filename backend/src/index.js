import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { appConfig } from './config/index.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
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
import { initDB } from './services/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/* ---- 全局中间件 ---- */
app.use(cors({
  origin: appConfig.cors.origin,
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger);

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

const publicDir = path.join(__dirname, '../public');

app.get('/', (_req, res) => {
  if (appConfig.env === 'production' && fs.existsSync(publicDir)) {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  res.json({ message: 'PingCode Agent 后端服务运行中', env: appConfig.env });
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

/* ---- 启动：先完成数据库初始化再监听端口 ---- */
async function start() {
  try {
    await initDB();
  } catch (err) {
    console.error('[App] 数据库初始化失败，服务无法启动');
    process.exit(1);
  }
  app.listen(appConfig.port, () => {
    console.log(`[${appConfig.env}] 服务运行在端口 ${appConfig.port}`);
  });
}

start();
