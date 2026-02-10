import express from 'express';
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
import { initDB } from './services/db.js';

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

app.get('/', (_req, res) => {
  res.json({ message: 'PingCode Agent 后端服务运行中', env: appConfig.env });
});

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
