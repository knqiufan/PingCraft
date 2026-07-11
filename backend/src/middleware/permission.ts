import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../types/authRequest.js';
import { Role, UserRole, Permission, RolePermission } from '../models/index.js';

/**
 * 检查用户是否为 admin 的中间件
 */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    if (req.isAdmin) {
      next();
      return;
    }

    const userRoles = await UserRole.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Role, where: { name: 'admin' } }],
    });

    if (userRoles.length === 0) {
      res.status(403).json({ success: false, error: '需要管理员权限' });
      return;
    }

    req.isAdmin = true;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * 检查用户是否有指定权限的中间件
 * @param permissionName - 权限名称，格式为 "resource.action"，如 "users.manage"
 */
export function requirePermission(permissionName: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: '未登录' });
        return;
      }

      if (req.isAdmin) {
        next();
        return;
      }

      const adminRole = await UserRole.findOne({
        where: { user_id: req.user.id },
        include: [{ model: Role, where: { name: 'admin' } }],
      });

      if (adminRole) {
        req.isAdmin = true;
        next();
        return;
      }

      const userRoles = await UserRole.findAll({
        where: { user_id: req.user.id },
        attributes: ['role_id'],
      });

      if (userRoles.length === 0) {
        res.status(403).json({ success: false, error: `缺少权限: ${permissionName}` });
        return;
      }

      const roleIds = userRoles.map((ur) => ur.role_id);
      const rolePermission = await RolePermission.findOne({
        where: { role_id: roleIds },
        include: [{
          model: Permission,
          where: { name: permissionName },
        }],
      });

      if (!rolePermission) {
        res.status(403).json({ success: false, error: `缺少权限: ${permissionName}` });
        return;
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}
