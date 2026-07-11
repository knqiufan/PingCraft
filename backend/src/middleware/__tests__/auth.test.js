import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
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
    res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
    next = vi.fn();
  });

  it('should return 401 when no Authorization header', async () => {
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: '未提供认证令牌' });
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
    expect(res.json).toHaveBeenCalledWith({ success: false, error: '用户不存在' });
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

  it('should issue refreshed token via header when token is near expiry', async () => {
    req.headers['authorization'] = 'Bearer aging-token';
    // token 已用 80% 寿命（剩余 20% < 25% 阈值），会话年龄在 30 天内
    const now = Math.floor(Date.now() / 1000);
    jwt.verify.mockReturnValue({ id: 'user1', iat: now - 8000, exp: now + 2000, first_iat: now - 8000 });
    jwt.sign = vi.fn().mockReturnValue('refreshed-token');
    const mockUser = { id: 'user1', username: 'test' };
    User.findByPk.mockResolvedValue(mockUser);
    UserRole.findAll.mockResolvedValue([{ Role: { name: 'user' } }]);

    await requireAuth(req, res, next);

    expect(jwt.sign).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Refreshed-Token', 'refreshed-token');
    // 续期 token 应携带 first_iat
    const signArgs = jwt.sign.mock.calls[0];
    expect(signArgs[0]).toHaveProperty('first_iat');
  });

  it('should NOT refresh when session exceeds absolute max lifetime (30 days)', async () => {
    req.headers['authorization'] = 'Bearer expired-session';
    // token 剩余 < 25%，但 first_iat 在 31 天前（超过 30 天绝对最大有效期）
    const now = Math.floor(Date.now() / 1000);
    const oldFirstIat = now - 31 * 24 * 3600;
    jwt.verify.mockReturnValue({ id: 'user1', iat: oldFirstIat + 8000, exp: now + 2000, first_iat: oldFirstIat });
    jwt.sign = vi.fn();
    const mockUser = { id: 'user1', username: 'test' };
    User.findByPk.mockResolvedValue(mockUser);
    UserRole.findAll.mockResolvedValue([{ Role: { name: 'user' } }]);

    await requireAuth(req, res, next);

    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('should NOT issue refreshed token when token has plenty of lifetime', async () => {
    req.headers['authorization'] = 'Bearer fresh-token';
    // token 刚签发（剩余 ~100%）
    const now = Math.floor(Date.now() / 1000);
    jwt.verify.mockReturnValue({ id: 'user1', iat: now, exp: now + 604800 });
    jwt.sign = vi.fn();
    const mockUser = { id: 'user1', username: 'test' };
    User.findByPk.mockResolvedValue(mockUser);
    UserRole.findAll.mockResolvedValue([{ Role: { name: 'user' } }]);

    await requireAuth(req, res, next);

    expect(jwt.sign).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
