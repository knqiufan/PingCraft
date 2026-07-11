import express from 'express';
import type { Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permission.js';
import type { AuthedRequest } from '../types/authRequest.js';
import { Role, Permission, RolePermission, UserRole } from '../models/index.js';
import { sequelize } from '../services/db.js';
import { success } from '../utils/response.js';

const router = express.Router();

// ===== 角色管理 =====

/** 获取所有角色 */
router.get('/', requireAuth, async (_req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const roles = await Role.findAll({
      order: [['createdAt', 'ASC']],
    });
    res.json(success(roles));
  } catch (e) {
    next(e);
  }
});

/** 创建角色 */
router.post('/', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const role = await Role.create({
      id: crypto.randomUUID(),
      name,
      display_name,
      description,
      is_system: false,
    });

    // 关联权限
    if (permissions && Array.isArray(permissions)) {
      for (const permissionId of permissions) {
        await RolePermission.create({
          role_id: role.id,
          permission_id: permissionId,
        });
      }
    }

    res.json(success(role, '创建成功'));
  } catch (e) {
    next(e);
  }
});

/** 更新角色 */
router.put('/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findByPk(req.params.id as string);

    if (!role) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    if (role.is_system) {
      return res.status(403).json({ success: false, error: '系统角色不可修改' });
    }

    const { name, display_name, description, permissions } = req.body;

    await role.update({
      ...(name && { name }),
      ...(display_name && { display_name }),
      ...(description !== undefined && { description }),
    });

    // 更新权限关联
    if (permissions && Array.isArray(permissions)) {
      // 删除旧的权限关联
      await RolePermission.destroy({ where: { role_id: role.id } });
      // 添加新的权限关联
      for (const permissionId of permissions) {
        await RolePermission.create({
          role_id: role.id,
          permission_id: permissionId,
        });
      }
    }

    res.json(success(role, '更新成功'));
  } catch (e) {
    next(e);
  }
});

/** 删除角色 */
router.delete('/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findByPk(req.params.id as string);

    if (!role) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    if (role.is_system) {
      return res.status(403).json({ success: false, error: '系统角色不可删除' });
    }

    await sequelize.transaction(async (t) => {
      await RolePermission.destroy({ where: { role_id: role.id }, transaction: t });
      await UserRole.destroy({ where: { role_id: role.id }, transaction: t });
      await role.destroy({ transaction: t });
    });

    res.json(success(null, '删除成功'));
  } catch (e) {
    next(e);
  }
});

// ===== 权限管理 =====

/** 获取所有权限 */
router.get('/permissions', requireAuth, async (_req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const permissions = await Permission.findAll({
      order: [['resource', 'ASC'], ['action', 'ASC']],
    });
    res.json(success(permissions));
  } catch (e) {
    next(e);
  }
});

/** 创建权限 */
router.post('/permissions', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, display_name, description, resource, action } = req.body;

    if (!name || !display_name || !resource || !action) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const permission = await Permission.create({
      id: crypto.randomUUID(),
      name,
      display_name,
      description,
      resource,
      action,
    });

    res.json(success(permission, '创建成功'));
  } catch (e) {
    next(e);
  }
});

/** 获取角色的权限 */
router.get('/:id/permissions', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const rolePermissions = await RolePermission.findAll({
      where: { role_id: req.params.id },
      include: [Permission],
    });

    const permissions = rolePermissions.map((rp) => (rp as RolePermission & { Permission: Permission }).Permission);
    res.json(success(permissions));
  } catch (e) {
    next(e);
  }
});

export default router;
