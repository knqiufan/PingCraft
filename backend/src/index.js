import app from './app.js';
import { appConfig } from './config/index.js';
import { initDB } from './services/db.js';

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
