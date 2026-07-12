import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { mockReq } from '../../__tests__/setup.js';

vi.mock('../../models/User.js', () => ({
  User: {
    findByPk: vi.fn(),
  },
}));

vi.mock('../../config/index.js', () => ({
  appConfig: {
    jwt: { secret: 'test-secret' },
    frontendUrl: 'http://localhost:5177',
    pingcode: { defaultDomain: 'open.pingcode.com' },
  },
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../services/pingcode.js', () => ({
  getAuthUrl: vi.fn(),
  getToken: vi.fn(),
  getUserIdFromToken: vi.fn(),
  fetchUserInfo: vi.fn(),
  getEnterpriseToken: vi.fn(),
  computeExpiresAtFromTokenResponse: vi.fn(),
  PINGCODE_GRANT_CLIENT_CREDENTIALS: 'client_credentials',
}));

import { User } from '../../models/User.js';
import { resolveOAuthCallbackUser } from '../auth.js';

const SECRET = 'test-secret';
const mockUser = { id: 'user-1', username: 'alice' };

describe('resolveOAuthCallbackUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.findByPk).mockResolvedValue(mockUser as any);
  });

  it('应仅凭合法 query.state JWT 定位用户（无需 cookie）', async () => {
    const state = jwt.sign({ userId: 'user-1' }, SECRET, { expiresIn: '5m' });
    const req = mockReq({ query: { state, code: 'abc' }, headers: {} });

    const user = await resolveOAuthCallbackUser(req as any);

    expect(user).toEqual(mockUser);
    expect(User.findByPk).toHaveBeenCalledWith('user-1');
  });

  it('PingCode 未回传 state 时，应凭 oauth_state cookie 定位用户', async () => {
    const state = jwt.sign({ userId: 'user-1' }, SECRET, { expiresIn: '5m' });
    const req = mockReq({
      query: { code: 'abc' },
      headers: { cookie: `oauth_state=${encodeURIComponent(state)}; oauth_user_id=user-1` },
    });

    const user = await resolveOAuthCallbackUser(req as any);

    expect(user).toEqual(mockUser);
    expect(User.findByPk).toHaveBeenCalledWith('user-1');
  });

  it('query.state 与 oauth_user_id cookie 不一致时应拒绝', async () => {
    const state = jwt.sign({ userId: 'user-1' }, SECRET, { expiresIn: '5m' });
    const req = mockReq({
      query: { state, code: 'abc' },
      headers: { cookie: 'oauth_user_id=other-user' },
    });

    const user = await resolveOAuthCallbackUser(req as any);

    expect(user).toBeNull();
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('无 state 且无 cookie 时应返回 null', async () => {
    const req = mockReq({ query: { code: 'abc' }, headers: {} });

    const user = await resolveOAuthCallbackUser(req as any);

    expect(user).toBeNull();
  });

  it('伪造或过期的 state 应返回 null', async () => {
    const req = mockReq({
      query: { state: 'not-a-valid-jwt', code: 'abc' },
      headers: {},
    });

    const user = await resolveOAuthCallbackUser(req as any);

    expect(user).toBeNull();
  });
});
