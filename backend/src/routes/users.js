import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permission.js';
import { User, Role, UserRole } from '../models/index.js';
import { success } from '../utils/response.js';
import { logAudit } from '../services/auditLog.js';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';

const router = express.Router();

/** 获取用户列表（仅 admin） */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // 检查是否为 admin
    if (!req.isAdmin) {
      return res.status(403).json({ success: false, error: '无权限' });
    }

    const { page = 1, pageSize = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const where = {};
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'username', 'pingcode_display_name', 'pingcode_email', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: Number(pageSize),
      offset,
    });

    res.json(success({
      list: rows,
      total: count,
      page: Number(page),
      pageSize: Number(pageSize),
    }));
  } catch (e) {
    next(e);
  }
});

/** 获取用户详情 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user.id;

    // 只能查看自己或 admin 可以查看所有
    if (userId !== currentUserId && !req.isAdmin) {
      return res.status(403).json({ success: false, error: '无权限' });
    }

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password_hash', 'access_token', 'refresh_token', 'pingcode_client_secret'] },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 获取用户角色
    const userRoles = await UserRole.findAll({
      where: { user_id: userId },
      include: [Role],
    });

    const roles = userRoles.map(ur => ({
      id: ur.Role.id,
      name: ur.Role.name,
      display_name: ur.Role.display_name,
    }));

    res.json(success({ ...user.toJSON(), roles }));
  } catch (e) {
    next(e);
  }
});

/**
 * 创建用户（仅 admin 可用，用于管理端创建账号）。
 * 普通注册统一走 POST /auth/local/register（含限流）。
 */
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }

    // 创建用户
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password_hash,
      pingcode_email: email,
    });

    // 为新用户分配默认角色（user 角色）
    const defaultRole = await Role.findOne({ where: { name: 'user' } });
    if (defaultRole) {
      await UserRole.create({
        user_id: user.id,
        role_id: defaultRole.id,
      });
    }

    res.json(success({ id: user.id, username: user.username }, '创建成功'));
  } catch (e) {
    next(e);
  }
});

/** 更新用户 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user.id;

    // 只能修改自己或 admin 可以修改所有
    if (userId !== currentUserId && !req.isAdmin) {
      return res.status(403).json({ success: false, error: '无权限' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const { username, email, roles } = req.body;

    // 更新用户信息
    await user.update({
      ...(username && { username }),
      ...(email !== undefined && { pingcode_email: email }),
    });

    // 更新用户角色（仅 admin 可修改）
    if (roles && Array.isArray(roles) && req.isAdmin) {
      await UserRole.destroy({ where: { user_id: userId } });
      for (const roleId of roles) {
        await UserRole.create({
          user_id: userId,
          role_id: roleId,
        });
      }
    }

    res.json(success(null, '更新成功'));
  } catch (e) {
    next(e);
  }
});

/** 删除用户（仅 admin） */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    // 检查是否为 admin
    if (!req.isAdmin) {
      return res.status(403).json({ success: false, error: '无权限' });
    }

    const userId = req.params.id;

    // 不能删除自己
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: '不能删除自己' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    await user.destroy();
    // 删除用户时，同时删除角色关联
    await UserRole.destroy({ where: { user_id: userId } });

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: 'DELETE_USER',
      resource: `user:${userId}`,
      detail: { deletedUsername: user.username },
    });

    res.json(success(null, '删除成功'));
  } catch (e) {
    next(e);
  }
});

export default router;
