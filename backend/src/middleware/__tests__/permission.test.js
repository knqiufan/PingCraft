import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../models/index.js', () => ({
  Role: {},
  UserRole: { findAll: vi.fn(), findOne: vi.fn() },
  Permission: {},
  RolePermission: { findOne: vi.fn() },
}));

import { UserRole, RolePermission } from '../../models/index.js';
import { requireAdmin, requirePermission } from '../permission.js';

describe('permission middleware', () => {
  let res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  describe('requireAdmin', () => {
    it('should return 401 when no req.user', async () => {
      await requireAdmin({ user: null }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should call next when req.isAdmin is true', async () => {
      await requireAdmin({ user: { id: '1' }, isAdmin: true }, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user is not admin', async () => {
      UserRole.findAll.mockResolvedValue([]);
      await requireAdmin({ user: { id: '1' }, isAdmin: false }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requirePermission', () => {
    it('should return 401 when no req.user', async () => {
      const mw = requirePermission('users.manage');
      await mw({ user: null }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should skip check for admin', async () => {
      const mw = requirePermission('users.manage');
      await mw({ user: { id: '1' }, isAdmin: true }, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next when user has permission', async () => {
      const mw = requirePermission('users.manage');
      UserRole.findOne.mockResolvedValue(null); // not admin via DB
      UserRole.findAll.mockResolvedValue([{ role_id: 'role1' }]);
      RolePermission.findOne.mockResolvedValue({ id: 'rp1' });
      await mw({ user: { id: '1' }, isAdmin: false }, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user lacks permission', async () => {
      const mw = requirePermission('users.manage');
      UserRole.findOne.mockResolvedValue(null);
      UserRole.findAll.mockResolvedValue([{ role_id: 'role1' }]);
      RolePermission.findOne.mockResolvedValue(null);
      await mw({ user: { id: '1' }, isAdmin: false }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
