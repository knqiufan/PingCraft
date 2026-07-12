import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createAuthModule, buildAuthUrl, DEFAULT_SCOPE } from '../../modules/auth.js';
import myselfFixture from '../../../../tests/fixtures/myself.json' with { type: 'json' };

const HOST = 'https://open.pingcode.com';

function setup() {
  const client = createClient({ host: HOST, credentials: { getToken: async () => 'tok' } });
  const mock = new MockAdapter(client.axios);
  const auth = createAuthModule(client, { host: HOST, redirectUri: 'http://localhost:3000/auth/callback' });
  return { client, mock, auth };
}

let { mock } = setup();
beforeEach(() => {
  mock.restore();
});
afterEach(() => mock.restore());

describe('buildAuthUrl()', () => {
  it('构造正确的授权 URL', () => {
    const url = buildAuthUrl(HOST, { clientId: 'cid', redirectUri: 'http://cb', state: 'xyz' });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${HOST}/oauth2/authorize`);
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('redirect_uri')).toBe('http://cb');
    expect(u.searchParams.get('scope')).toBe(DEFAULT_SCOPE);
    expect(u.searchParams.get('state')).toBe('xyz');
  });

  it('模块方法 buildAuthUrl 复用 defaults', () => {
    const { auth } = setup();
    const url = auth.buildAuthUrl({ clientId: 'cid' });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
  });
});

describe('auth 模块 token 端点（auth:false）', () => {
  it('getTokenByCode 不带 Authorization', async () => {
    const { auth, mock } = setup();
    mock.onGet('/auth/token').reply((cfg) => [
      200,
      { access_token: 'at', grant_type_sent: cfg.params?.grant_type, authed: cfg.headers?.Authorization ?? null },
    ]);
    const res = await auth.getTokenByCode({ code: 'c', clientId: 'cid', clientSecret: 'cs' });
    expect(res.access_token).toBe('at');
    expect(res.grant_type_sent).toBe('authorization_code');
    expect(res.authed).toBeNull();
  });

  it('getTokenByClientCredentials 用 client_credentials', async () => {
    const { auth, mock } = setup();
    mock.onGet('/auth/token').reply((cfg) => [200, { access_token: 'at', grant_type: cfg.params?.grant_type }]);
    const res = await auth.getTokenByClientCredentials({ clientId: 'cid', clientSecret: 'cs' });
    expect(res.grant_type).toBe('client_credentials');
  });

  it('refresh 用 refresh_token', async () => {
    const { auth, mock } = setup();
    mock.onGet('/auth/token').reply((cfg) => [200, { access_token: 'new', grant_type: cfg.params?.grant_type }]);
    const res = await auth.refresh({ refreshToken: 'rt', clientId: 'cid', clientSecret: 'cs' });
    expect(res.grant_type).toBe('refresh_token');
    expect(res.access_token).toBe('new');
  });
});

describe('auth.getMyself()', () => {
  it('需鉴权并返回 myself 数据', async () => {
    const { auth, mock } = setup();
    mock.onGet('/myself').reply((cfg) => [200, { ...myselfFixture, authed: cfg.headers?.Authorization }]);
    const me = await auth.getMyself();
    expect(me.id).toBe('u1');
    expect(me.name).toBe('Alice');
    expect((me as { authed: string }).authed).toBe('Bearer tok');
  });
});
