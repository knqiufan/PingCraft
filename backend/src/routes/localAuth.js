import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { appConfig } from '../config/index.js';
import { success } from '../utils/response.js';
import { withRetry } from '../utils/retry.js';

const router = express.Router();

/** 注册 */
router.post('/register', async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password_hash: hashedPassword });
    res.json(success({ id: user.id }, '注册成功'));
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }
    next(e);
  }
});

/** 登录 */
router.post('/login', async (req, res, next) => {
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

    const token = jwt.sign(
      { id: user.id, username: user.username },
      appConfig.jwt.secret,
      { expiresIn: '1d' }
    );

    res.json({ success: true, token, user: { id: user.id, username: user.username } });
  } catch (e) {
    next(e);
  }
});

export default router;
