import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Role, UserRole } from '../models/index.js';
import { appConfig } from '../config/index.js';
import { success } from '../utils/response.js';
import { withRetry } from '../utils/retry.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/** 注册（限流防批量注册） */
router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password_hash: hashedPassword,
      pingcode_email: email,
    } as any);

    // 为新用户分配默认角色
    const defaultRole = await Role.findOne({ where: { name: 'user' } });
    if (defaultRole) {
      await UserRole.create({
        user_id: user.id,
        role_id: defaultRole.id,
      });
    }

    res.json(success({ id: user.id, username: user.username }, '注册成功'));
  } catch (e: any) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }
    next(e);
  }
});

/** 登录（限流防暴力破解） */
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }

  try {
    const findUser = () => User.findOne({ where: { username } });
    const user = await withRetry(findUser, {
      maxRetries: 2,
      baseDelay: 500,
      label: 'Login',
    });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    // 获取用户角色
    const userRoles = await UserRole.findAll({
      where: { user_id: user.id },
      include: [Role],
    });

    const roles = userRoles.map((ur) => (ur as UserRole & { Role: Role }).Role.name);
    const isAdmin = roles.includes('admin');

    const token = jwt.sign(
      // first_iat 标记会话首次签发时间，用于滑动续期时计算绝对最大有效期
      { id: user.id, username: user.username, roles, isAdmin, first_iat: Math.floor(Date.now() / 1000) },
      appConfig.jwt.secret,
      { expiresIn: '7d' },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        roles,
        isAdmin,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
