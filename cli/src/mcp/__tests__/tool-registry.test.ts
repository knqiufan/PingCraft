import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { registerTool, clearTools, selectTools, toolToMcpDescriptor, parseToolArgs, getRegisteredTools } from '../tool-registry.js';

beforeEach(() => clearTools());

describe('tool-registry 三层选择', () => {
  it('core 始终返回；optional 仅 --include 启用；longtail 永不返回', () => {
    registerTool({ name: 'a__list', description: 'd', inputSchema: z.object({}), handler: async () => null, tier: 'core' });
    registerTool({ name: 'a__create', description: 'd', inputSchema: z.object({}), handler: async () => null, tier: 'optional' });
    registerTool({ name: 'a__config', description: 'd', inputSchema: z.object({}), handler: async () => null, tier: 'longtail' });

    expect(selectTools().map((t) => t.name)).toEqual(['a__list']);
    expect(selectTools({ coreOnly: true }).map((t) => t.name)).toEqual(['a__list']);
    // include 模块名 a 启用 optional
    expect(selectTools({ include: ['a'] }).map((t) => t.name)).toEqual(['a__list', 'a__create']);
    // include 具体 tool 名
    expect(selectTools({ include: ['a__create'] }).map((t) => t.name)).toEqual(['a__list', 'a__create']);
    // longtail 永远不在 MCP
    expect(selectTools({ include: ['a__config'] }).some((t) => t.name === 'a__config')).toBe(false);
  });
});

describe('toolToMcpDescriptor', () => {
  it('生成 JSON Schema 且含 description', () => {
    registerTool({
      name: 'x__get',
      description: '取一个',
      inputSchema: z.object({ id: z.string().describe('标识') }),
      handler: async () => null,
      tier: 'core',
    });
    const d = toolToMcpDescriptor(getRegisteredTools()[0]);
    expect(d.name).toBe('x__get');
    expect(d.description).toBe('取一个');
    expect(d.inputSchema.type).toBe('object');
    expect((d.inputSchema.properties as Record<string, unknown>).id).toBeDefined();
    expect(d.inputSchema).not.toHaveProperty('$schema');
  });

  it('dangerous=true 时 description 前缀 ⚠️ destructive', () => {
    registerTool({ name: 'x__del', description: '删除', inputSchema: z.object({}), handler: async () => null, tier: 'core', dangerous: true });
    const d = toolToMcpDescriptor(getRegisteredTools()[0]);
    expect(d.description).toBe('⚠️ destructive — 删除');
  });
});

describe('parseToolArgs', () => {
  it('合法入参返回解析结果', () => {
    const schema = z.object({ id: z.string(), n: z.number() });
    registerTool({ name: 'x', description: 'd', inputSchema: schema, handler: async () => null, tier: 'core' });
    expect(parseToolArgs(getRegisteredTools()[0], { id: 'a', n: 3 })).toEqual({ id: 'a', n: 3 });
  });

  it('非法入参抛 ToolInputError', () => {
    const schema = z.object({ id: z.string() });
    registerTool({ name: 'x', description: 'd', inputSchema: schema, handler: async () => null, tier: 'core' });
    expect(() => parseToolArgs(getRegisteredTools()[0], { id: 123 })).toThrow(/参数校验失败/);
  });
});
