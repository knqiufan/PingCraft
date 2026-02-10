/**
 * 请求日志中间件
 * 记录请求方法、路径、状态码、耗时
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  // 响应结束时记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${method} ${originalUrl} ${statusCode} ${duration}ms`);
  });

  next();
};
