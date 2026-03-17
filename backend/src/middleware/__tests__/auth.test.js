import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock('../../models/index.js', () => ({
  User: { findByPk: vi.fn() },
  Role: {},
  UserRole: { findAll: vi.fn() },
}));

vi.mock('../../config/index.js', () => ({
  appConfig: { jwt: { secret: 'test-secret' } },
}));

import jwt from 'jsonwebtoken';
import { User, UserRole } from '../../models/index.js';
import { requireAuth } from '../auth.js';

describe('requireAuth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it('should return 401 when no Authorization header', async () => {
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '未提供认证令牌' });
  });

  it('should return 401 for invalid token', async () => {
    req.headers['authorization'] = 'Bearer invalid';
    jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 when user not found', async () => {
    req.headers['authorization'] = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 'user1' });
    User.findByPk.mockResolvedValue(null);
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '用户不存在' });
  });

  it('should set req.user, req.userRoles, req.isAdmin on success', async () => {
    req.headers['authorization'] = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 'user1' });
    const mockUser = { id: 'user1', username: 'test' };
    User.findByPk.mockResolvedValue(mockUser);
    UserRole.findAll.mockResolvedValue([
      { Role: { name: 'admin' } },
      { Role: { name: 'user' } },
    ]);

    await requireAuth(req, res, next);

    expect(req.user).toBe(mockUser);
    expect(req.userRoles).toEqual(['admin', 'user']);
    expect(req.isAdmin).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});
