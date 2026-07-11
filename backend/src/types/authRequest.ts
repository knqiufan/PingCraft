import type { Request } from 'express';
import type { User } from '../models/User.js';

/**
 * 带 auth 上下文的 Express Request。
 *
 * requireAuth 中间件注入 user / userRoles / isAdmin。
 *
 * 采用显式接口而非全局 `declare module` 增强：本项目的 @types/express
 * 未独立安装 express-serve-static-core，全局增强会意外创建空模块、破坏
 * express 原生类型；显式接口可移植且无此副作用。strict:false 下函数参数
 * 双变，`(req: AuthedRequest) => ...` 可作为 RequestHandler 注册。
 */
export interface AuthedRequest extends Request {
  user?: User;
  userRoles?: string[];
  isAdmin?: boolean;
}
