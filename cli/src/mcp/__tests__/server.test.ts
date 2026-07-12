import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server.js';
import { clearTools } from '../tool-registry.js';
import { registerAllTools } from '../tools/index.js';
import type { ClientBundle } from '../../commands/shared.js';

/** 构造一个 mock bundle：任意模块方法可被覆盖 */
function mockBundle(overrides: Record<string, unknown> = {}): ClientBundle {
  const stub = () => {
    const cache = new Map<string, ReturnType<typeof vi.fn>>();
    return new Proxy({}, {
      get: (_t, key) => {
        if (typeof key !== 'string') return undefined;
        if (!cache.has(key)) cache.set(key, vi.fn(async () => ({ values: [], total: 0 })));
        return cache.get(key);
      },
    });
  };
  return {
    profile: { name: 'default', host: 'https://x' },
    client: { axios: {} as never } as never,
    auth: stub() as never,
    projects: (overrides.projects as never) ?? stub(),
    workItems: (overrides.workItems as never) ?? stub(),
    workItemMeta: (overrides.workItemMeta as never) ?? stub(),
    workItemSubResources: stub() as never,
    workItemScheme: stub() as never,
    sprints: (overrides.sprints as never) ?? stub(),
    releases: stub() as never,
    kanbans: stub() as never,
    waterfall: stub() as never,
    directory: stub() as never,
    commonResources: stub() as never,
    logs: stub() as never,
    wiki: (overrides.wiki as never) ?? stub(),
  };
}

async function connect(bundle: ClientBundle) {
  const { server } = createMcpServer({ bundle });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
}

beforeEach(() => {
  clearTools();
  registerAllTools();
});

describe('MCP server listTools', () => {
  it('返回核心 tool，且 inputSchema 是合法 JSON Schema', async () => {
    const client = await connect(mockBundle());
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('work-item__list');
    expect(names).toContain('project__list');
    expect(names).toContain('myself__get');
    // optional（project__create）默认不在列表
    expect(names).not.toContain('project__create');
    const list = tools.find((t) => t.name === 'work-item__list');
    expect(list?.inputSchema.type).toBe('object');
  });

  it('dangerous tool description 含 ⚠️', async () => {
    const client = await connect(mockBundle());
    const { tools } = await client.listTools();
    const create = tools.find((t) => t.name === 'work-item__create');
    expect(create?.description).toContain('⚠️');
  });
});

describe('MCP server callTool', () => {
  it('路由到 sdk（work-item__list）', async () => {
    const workItemList = vi.fn(async () => ({ values: [{ id: 'w1', title: 'T' }], total: 1 }));
    const bundle = mockBundle({ workItems: { list: workItemList, listAll: vi.fn() } as never });
    const client = await connect(bundle);
    const res = await client.callTool({ name: 'work-item__list', arguments: { project_id: 'p1' } });
    expect(workItemList).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1' }));
    expect(res.isError).toBeFalsy();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(text)[0].id).toBe('w1');
  });

  it('未知 tool 返回 isError', async () => {
    const client = await connect(mockBundle());
    const res = await client.callTool({ name: 'nope__x', arguments: {} });
    expect(res.isError).toBe(true);
  });

  it('参数校验失败返回 isError', async () => {
    const client = await connect(mockBundle());
    const res = await client.callTool({ name: 'work-item__get', arguments: {} }); // 缺 id
    expect(res.isError).toBe(true);
  });
});
