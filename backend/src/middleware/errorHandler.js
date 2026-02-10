import { appConfig } from '../config/index.js';

/**
 * 统一错误处理中间件
 * 放在所有路由之后注册
 */
export const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || '服务器内部错误';

  // 开发环境输出详细错误
  if (appConfig.isDev) {
    console.error('[Error]', {
      method: req.method,
      url: req.originalUrl,
      status,
      message,
      stack: err.stack,
    });
  } else {
    console.error('[Error]', req.method, req.originalUrl, status, message);
  }

  res.status(status).json({
    success: false,
    error: message,
  });
};

/**
 * 创建一个带状态码的错误
 */
export function createError(message, status = 500) {
  const err = new Error(message);
  err.status = status;
  return err;
}
