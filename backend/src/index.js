import app from './app.js';
import { appConfig } from './config/index.js';
import { initDB } from './services/db.js';
import { validateRequiredConfig } from './config/validate.js';
import { startCleanupSchedule } from './services/uploadCleanup.js';

/* ---- 启动：先校验配置，再完成数据库初始化，最后监听端口 ---- */
async function start() {
  // 1. 校验必填环境变量（生产环境严格要求 ENCRYPTION_KEY / JWT_SECRET 等）
  const configErrors = validateRequiredConfig();
  if (configErrors.length > 0) {
    console.error('[App] 配置校验失败：');
    configErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 2. 数据库初始化
  try {
    await initDB();
  } catch (err) {
    console.error('[App] 数据库初始化失败，服务无法启动');
    process.exit(1);
  }

  // 3. 启动上传文件定时清理（P2-4.9）
  const cleanupHandles = startCleanupSchedule();

  // 4. 启动 HTTP 服务
  const server = app.listen(appConfig.port, () => {
    console.log(`[${appConfig.env}] 服务运行在端口 ${appConfig.port}`);
  });

  // 5. 优雅关闭：清理定时器和连接（P2 审查 I3）
  function shutdown(signal) {
    console.log(`[App] 收到 ${signal}，正在关闭...`);
    if (cleanupHandles?.timer) clearInterval(cleanupHandles.timer);
    if (cleanupHandles?.initialTimer) clearTimeout(cleanupHandles.initialTimer);
    server.close(() => {
      console.log('[App] HTTP 服务已关闭');
      process.exit(0);
    });
    // 5s 超时强制退出
    setTimeout(() => process.exit(1), 5000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
