import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { appConfig } from '../config/index.js';

/**
 * JWT 认证中间件
 * 从 Authorization header 提取 Bearer token 并验证
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, appConfig.jwt.secret);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
};
