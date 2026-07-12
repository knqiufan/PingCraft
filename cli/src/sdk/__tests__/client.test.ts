import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient, type PingCodeClient, type ClientCredentials } from '../client.js';

let client: PingCodeClient;
let mock: MockAdapter;

function makeCredentials(initial?: string, refreshImpl?: () => Promise<void>): { creds: ClientCredentials; set: (t: string) => void } {
  let token = initial;
  return {
    creds: {
      getToken: async () => token,
      refreshToken: refreshImpl
        ? async () => {
            await refreshImpl();
          }
        : undefined,
    },
    set: (t: string) => {
      token = t;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  client = createClient({ host: 'https://test.pingcode.com', maxRetries: 3, rateLimitMaxRetries: 3 });
  mock = new MockAdapter(client.axios);
});

afterEach(() => {
  mock.restore();
  vi.useRealTimers();
});

/** 推进 fake timer 直到 promise 落定（处理未知退避时长） */
async function settle<T>(p: Promise<T>): Promise<T> {
  let settled = false;
  p.catch(() => {}).finally(() => {
    settled = true;
  });
  for (let i = 0; i < 50 && !settled; i++) {
    await vi.advanceTimersByTimeAsync(2000);
  }
  return p;
}

describe('createClient() 鉴权注入', () => {
  it('注入 Authorization: Bearer <token>', async () => {
    const { creds } = makeCredentials('tok123');
    const c = createClient({ host: 'https://t', credentials: creds });
    const m = new MockAdapter(c.axios);
    m.onGet('/myself').reply((cfg) => [200, { auth: cfg.headers?.Authorization }]);

    const data = await settle(c.get('/myself'));
    expect(data).toEqual({ auth: 'Bearer tok123' });
    m.restore();
  });

  it('auth:false 不注入鉴权头（token 端点）', async () => {
    const { creds } = makeCredentials('tok');
    const c = createClient({ host: 'https://t', credentials: creds });
    const m = new MockAdapter(c.axios);
    m.onGet('/auth/token').reply((cfg) => [200, { auth: cfg.headers?.Authorization ?? null }]);

    const data = await settle(c.get('/auth/token', { auth: false }));
    expect(data).toEqual({ auth: null });
    m.restore();
  });

  it('无 token 时不注入 Authorization', async () => {
    const { creds } = makeCredentials(undefined);
    const c = createClient({ host: 'https://t', credentials: creds });
    const m = new MockAdapter(c.axios);
    m.onGet('/x').reply((cfg) => [200, { auth: cfg.headers?.Authorization ?? null }]);
    const data = await settle(c.get('/x'));
    expect(data).toEqual({ auth: null });
    m.restore();
  });
});

describe('401 刷新重放', () => {
  it('401 触发 refreshToken 一次并重放成功', async () => {
    const refresh = vi.fn(async () => {});
    const { creds, set } = makeCredentials('old', async () => {
      refresh();
      set('new');
    });
    const c = createClient({ host: 'https://t', credentials: creds });
    const m = new MockAdapter(c.axios);
    // 首个请求（old token）401，第二个（new token）200
    let call = 0;
    m.onGet('/x').reply((cfg) => {
      call++;
      if (cfg.headers?.Authorization === 'Bearer old') return [401, { message: 'expired' }];
      return [200, { ok: true, token: cfg.headers?.Authorization }];
    });

    const data = await settle(c.get('/x'));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(call).toBe(2);
    expect(data).toEqual({ ok: true, token: 'Bearer new' });
    m.restore();
  });

  it('无 refreshToken 时 401 直接抛出', async () => {
    const { creds } = makeCredentials('old');
    const c = createClient({ host: 'https://t', credentials: creds });
    const m = new MockAdapter(c.axios);
    m.onGet('/x').reply(401, { message: 'expired' });
    await expect(settle(c.get('/x'))).rejects.toMatchObject({ response: { status: 401 } });
    m.restore();
  });

  it('刷新后仍 401 只刷新一次后抛出', async () => {
    const refresh = vi.fn(async () => {});
    const { creds } = makeCredentials('old', async () => refresh());
    const c = createClient({ host: 'https://t', credentials: creds });
    const m = new MockAdapter(c.axios);
    m.onGet('/x').reply(401, { message: 'still expired' });
    await expect(settle(c.get('/x'))).rejects.toMatchObject({ response: { status: 401 } });
    expect(refresh).toHaveBeenCalledTimes(1);
    m.restore();
  });
});

describe('429 退避', () => {
  it('读 x-pc-retry-after 后重试成功', async () => {
    mock.onGet('/x').replyOnce(429, { message: 'rate' }, { 'x-pc-retry-after': '0' }).onGet('/x').reply(200, { ok: true });
    const data = await settle(client.get('/x'));
    expect(data).toEqual({ ok: true });
  });

  it('超过预算后抛 429', async () => {
    mock.onGet('/x').reply(429, { message: 'rate' }, { 'x-pc-retry-after': '0' });
    await expect(settle(client.get('/x'))).rejects.toMatchObject({ response: { status: 429 } });
  });

  it('onBackoff 回调以 rate-limit 触发', async () => {
    const onBackoff = vi.fn();
    const c = createClient({ host: 'https://t', onBackoff, rateLimitMaxRetries: 1 });
    const m = new MockAdapter(c.axios);
    m.onGet('/x').replyOnce(429, {}, { 'x-pc-retry-after': '0' }).onGet('/x').reply(200, { ok: 1 });
    await settle(c.get('/x'));
    expect(onBackoff).toHaveBeenCalledWith(expect.objectContaining({ reason: 'rate-limit', attempt: 1 }));
    m.restore();
  });
});

describe('5xx / 网络重试', () => {
  it('5xx 指数退避后重试成功', async () => {
    mock.onGet('/x').replyOnce(500).onGet('/x').replyOnce(502).onGet('/x').reply(200, { ok: true });
    const data = await settle(client.get('/x'));
    expect(data).toEqual({ ok: true });
  });

  it('达到 maxRetries 后抛最后一次 5xx', async () => {
    mock.onGet('/x').reply(500);
    await expect(settle(client.get('/x'))).rejects.toMatchObject({ response: { status: 500 } });
  });

  it('网络错误（无 response）重试成功', async () => {
    let call = 0;
    mock.onGet('/x').reply(() => {
      call++;
      if (call === 1) {
        const e = new Error('connect ECONNREFUSED') as Error & { code: string };
        e.code = 'ECONNREFUSED';
        return Promise.reject(e);
      }
      return [200, { ok: true }];
    });
    const data = await settle(client.get('/x'));
    expect(data).toEqual({ ok: true });
  });
});

describe('4xx 不重试', () => {
  it('400 直接抛出', async () => {
    mock.onGet('/x').reply(400, { message: 'bad' });
    await expect(settle(client.get('/x'))).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('404 直接抛出', async () => {
    mock.onGet('/x').reply(404, { message: 'nf' });
    await expect(settle(client.get('/x'))).rejects.toMatchObject({ response: { status: 404 } });
  });
});

describe('HTTP 方法', () => {
  it('POST 发送 body', async () => {
    mock.onPost('/p').reply((cfg) => [200, { got: JSON.parse(cfg.data) }]);
    const data = await settle(client.post('/p', { a: 1 }));
    expect(data).toEqual({ got: { a: 1 } });
  });

  it('PATCH / DELETE 方法正确', async () => {
    mock.onPatch('/p/1').reply((cfg) => [200, { method: cfg.method, got: JSON.parse(cfg.data) }]);
    mock.onDelete('/p/1').reply((cfg) => [200, { method: cfg.method }]);
    expect(await settle(client.patch('/p/1', { b: 2 }))).toEqual({ method: 'patch', got: { b: 2 } });
    expect(await settle(client.delete('/p/1'))).toEqual({ method: 'delete' });
  });

  it('params 透传为 query', async () => {
    mock.onGet('/p').reply((cfg) => [200, { page: cfg.params?.page_index }]);
    const data = await settle(client.get('/p', { params: { page_index: 2 } }));
    expect(data).toEqual({ page: 2 });
  });
});
