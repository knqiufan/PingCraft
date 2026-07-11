/**
 * 速率限制中间件（基于 express-rate-limit）
 * 防止登录/注册接口被暴力破解或批量注册。
 *
 * 注意：默认使用内存存储（MemoryStore），适用于单实例部署。
 * 多实例部署时需替换为 Redis Store（见 express-rate-limit 文档）。
 */
import { rateLimit } from 'express-rate-limit';

/** 登录接口限流：10 次 / 15 分钟 / IP */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录尝试过于频繁，请 15 分钟后再试' },
  // 跳过成功响应的计数重置策略由 store 决定；这里按窗口固定计数
});

/** 注册接口限流：5 次 / 小时 / IP */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '注册请求过于频繁，请稍后再试' },
});
