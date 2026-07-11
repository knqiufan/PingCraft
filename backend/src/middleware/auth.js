import jwt from 'jsonwebtoken';
import { User, Role, UserRole } from '../models/index.js';
import { appConfig } from '../config/index.js';

/** 当 token 剩余有效期不足 25% 时，自动签发新 token 通过响应头下发（滑动续期 P2-4.3） */
const REFRESH_THRESHOLD = 0.25; // 剩余 < 25% 时续期
/** 会话绝对最大有效期（30 天），超过后不再续期，强制重新登录（防止无限续期链） */
const MAX_SESSION_LIFETIME_SEC = 30 * 24 * 3600;
/** 单次 token 有效期 */
const TOKEN_TTL = '7d';

/**
 * JWT 认证中间件
 * 从 Authorization header 提取 Bearer token 并验证。
 * 当 token 即将过期（剩余有效期 < 25%）时，通过 X-Refreshed-Token 响应头下发新 token，
 * 前端拦截器收到后自动更新本地存储，实现滑动续期，无需用户重新登录。
 *
 * 安全约束：自首次签发（first_iat）起超过 30 天后不再续期，强制重新认证。
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, appConfig.jwt.secret);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: '用户不存在' });
    }

    // 获取用户角色
    const userRoles = await UserRole.findAll({
      where: { user_id: user.id },
      include: [Role],
    });

    const roles = userRoles.map(ur => ur.Role.name);
    const isAdmin = roles.includes('admin');

    req.user = user;
    req.userRoles = roles;
    req.isAdmin = isAdmin;

    // 滑动续期：token 剩余有效期不足阈值时，签发新 token 通过响应头下发
    if (decoded.exp && decoded.iat) {
      const totalLifetime = decoded.exp - decoded.iat;
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      // 追踪会话首次签发时间，超过绝对最大有效期后不再续期
      const firstIat = decoded.first_iat || decoded.iat;
      const sessionAge = Math.floor(Date.now() / 1000) - firstIat;
      if (
        remaining > 0 &&
        remaining / totalLifetime < REFRESH_THRESHOLD &&
        sessionAge < MAX_SESSION_LIFETIME_SEC
      ) {
        const refreshedToken = jwt.sign(
          { id: user.id, username: user.username, roles, isAdmin, first_iat: firstIat },
          appConfig.jwt.secret,
          { expiresIn: TOKEN_TTL }
        );
        res.setHeader('X-Refreshed-Token', refreshedToken);
      }
    }

    next();
  } catch {
    return res.status(401).json({ success: false, error: '认证令牌无效或已过期' });
  }
};
