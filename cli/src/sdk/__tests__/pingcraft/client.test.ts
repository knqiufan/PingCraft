import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { consumeSSE } from '../../pingcraft/client.js';
import { createPingcraftApi, runOrchestrator } from '../../pingcraft/index.js';
import type { PingcraftClient } from '../../pingcraft/client.js';

describe('consumeSSE()', () => {
  it('解析多事件并按序回调（含 JSON data）', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const stream = Readable.from([
      'event: start\ndata: {"total":3}\n\n',
      'event: progress\ndata: {"current":1}\n\n',
      'event: complete\ndata: {"result":{"success":3}}\n\n',
    ]);
    await consumeSSE(stream, (ev) => events.push(ev));
    expect(events.map((e) => e.event)).toEqual(['start', 'progress', 'complete']);
    expect(events[0].data).toEqual({ total: 3 });
    expect(events[2].data).toEqual({ result: { success: 3 } });
  });

  it('跨块边界正确拼装', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    // 故意把一个事件切成两块
    const stream = Readable.from(['event: progress\nda', 'ta: {"current":2}\n\n']);
    await consumeSSE(stream, (ev) => events.push(ev));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'progress', data: { current: 2 } });
  });

  it('兼容 CRLF 行尾', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const stream = Readable.from(['event: start\r\ndata: {"total":1}\r\n\r\n']);
    await consumeSSE(stream, (ev) => events.push(ev));
    expect(events[0]).toEqual({ event: 'start', data: { total: 1 } });
  });

  it('非 JSON data 保留原字符串', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const stream = Readable.from(['event: ping\ndata: pong\n\n']);
    await consumeSSE(stream, (ev) => events.push(ev));
    expect(events[0].data).toBe('pong');
  });
});

/** 构造 mock pingcraft client */
function mockClient(impl: Partial<PingcraftClient> = {}): PingcraftClient {
  return {
    axios: {} as never,
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    postStream: vi.fn(async () => ({ data: Readable.from([]) })) as never,
    postForm: vi.fn(async () => ({})),
    ...impl,
  } as PingcraftClient;
}

describe('createPingcraftApi', () => {
  it('login POST /auth/local/login', async () => {
    const post = vi.fn(async () => ({ success: true, token: 'jwt' }));
    const api = createPingcraftApi(mockClient({ post: post as never }));
    const res = await api.login('u', 'p');
    expect(post).toHaveBeenCalledWith('/auth/local/login', { username: 'u', password: 'p' });
    expect(res.token).toBe('jwt');
  });

  it('importStream 解析 SSE 并返回 complete 结果', async () => {
    const sse = Readable.from([
      'event: start\ndata: {"total":2}\n\n',
      'event: progress\ndata: {"current":1}\n\n',
      'event: complete\ndata: {"result":{"success":2,"failed":0}}\n\n',
    ]);
    const postStream = vi.fn(async () => ({ data: sse })) as never;
    const api = createPingcraftApi(mockClient({ postStream }));
    const progress: unknown[] = [];
    const result = await api.importStream({ items: [{ a: 1 }, { b: 2 }], projectId: 'p1' }, {
      onStart: () => progress.push('start'),
      onProgress: () => progress.push('progress'),
      onComplete: () => progress.push('complete'),
    });
    expect(progress).toEqual(['start', 'progress', 'complete']);
    expect(result).toEqual({ success: 2, failed: 0 });
  });
});

describe('runOrchestrator', () => {
  it('完整流程 analyze→match→dup→import（autoImport）', async () => {
    const analyze = vi.fn(async () => ({ items: [{ title: 'A' }, { title: 'B' }] }));
    const matchProject = vi.fn(async () => ({ projectId: 'p1' }));
    const checkDuplicates = vi.fn(async () => ({ duplicates: [] }));
    const importStream = vi.fn(async () => ({ success: 2 }));
    const api = createPingcraftApi(
      mockClient({ postForm: analyze as never, post: vi.fn(async (_url: string, body?: unknown) => {
        // matchProject / checkDuplicates 都走 post，按 URL 路由
        if (body && (body as { requirements?: unknown[] }).requirements) return { projectId: 'p1' };
        return { duplicates: [] };
      }) as never }),
    );
    // 直接替换 api 方法更可控
    (api as unknown as { matchProject: unknown }).matchProject = matchProject;
    (api as unknown as { checkDuplicates: unknown }).checkDuplicates = checkDuplicates;
    (api as unknown as { importStream: unknown }).importStream = importStream;

    const result = await runOrchestrator({ api, formData: new FormData(), autoImport: true });
    expect(analyze).toHaveBeenCalled();
    expect(matchProject).toHaveBeenCalled();
    expect(checkDuplicates).toHaveBeenCalled();
    expect(importStream).toHaveBeenCalled();
    expect(result.projectId).toBe('p1');
    expect(result.result).toEqual({ success: 2 });
  });

  it('无 autoImport 时止于查重', async () => {
    const importStream = vi.fn(async () => ({ success: 0 }));
    const api = createPingcraftApi(mockClient());
    (api as unknown as { analyze: unknown }).analyze = vi.fn(async () => ({ items: [{ title: 'A' }] }));
    (api as unknown as { matchProject: unknown }).matchProject = vi.fn(async () => ({ projectId: 'p1' }));
    (api as unknown as { checkDuplicates: unknown }).checkDuplicates = vi.fn(async () => ({}));
    (api as unknown as { importStream: unknown }).importStream = importStream;

    const result = await runOrchestrator({ api, formData: new FormData() });
    expect(importStream).not.toHaveBeenCalled();
    expect(result.skipped).toBe(false);
    expect(result.projectId).toBe('p1');
  });
});
