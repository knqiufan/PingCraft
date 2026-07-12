/**
 * MCP tool 注册中心。
 *
 * - tool 用 Zod schema 描述输入，`zodToJsonSchema` 生成 MCP 的 inputSchema。
 * - 三层加载：core（始终注册）/ optional（--include 启用）/ longtail（仅 CLI）。
 * - 危险操作（delete/update/move）description 前缀 `⚠️ destructive`。
 *
 * 纪律：tool handler 只编排 sdk 调用，不重复业务逻辑（与 commands 共享同一 sdk）。
 */
import { z } from 'zod';
import type { ClientBundle } from '../commands/shared.js';

export type ToolTier = 'core' | 'optional' | 'longtail';

export interface ToolContext {
  bundle: ClientBundle;
}

export interface ToolDefinition {
  /** tool 名，约定 `<module>__<action>`，如 `work-item__list` */
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  tier: ToolTier;
  /** 危险操作（delete/update/move 等） */
  dangerous?: boolean;
}

const registry: ToolDefinition[] = [];

/** 注册一个 tool */
export function registerTool(def: ToolDefinition): void {
  registry.push(def);
}

/** 清空注册表（测试用） */
export function clearTools(): void {
  registry.length = 0;
}

/** 已注册的全部 tool */
export function getRegisteredTools(): ToolDefinition[] {
  return [...registry];
}

function moduleOf(name: string): string {
  return name.split('__')[0];
}

/**
 * 按三层策略筛选 tool。
 *  - core 始终返回
 *  - optional 仅当 coreOnly=false 且 `--include` 含模块名或 tool 名时返回
 *  - longtail 永不在 MCP 暴露（仅 CLI）
 */
export function selectTools(opts: { include?: string[]; coreOnly?: boolean } = {}): ToolDefinition[] {
  const include = new Set(opts.include ?? []);
  return registry.filter((t) => {
    if (t.tier === 'core') return true;
    if (opts.coreOnly) return false;
    if (t.tier === 'optional') return include.has(t.name) || include.has(moduleOf(t.name));
    return false;
  });
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** 将 tool 转为 MCP 协议描述（含危险标注，inputSchema 去掉 $schema） */
export function toolToMcpDescriptor(tool: ToolDefinition): McpToolDescriptor {
  const description = tool.dangerous ? `⚠️ destructive — ${tool.description}` : tool.description;
  // zod v4 原生 z.toJSONSchema（zod-to-json-schema v3 不兼容 zod v4）
  const schema = z.toJSONSchema(tool.inputSchema) as Record<string, unknown>;
  delete schema.$schema;
  return { name: tool.name, description, inputSchema: schema };
}

/** 校验并解析入参；非法时抛错（MCP server 捕获后返回错误） */
export function parseToolArgs(tool: ToolDefinition, args: unknown): Record<string, unknown> {
  const result = tool.inputSchema.safeParse(args);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    const err = new Error(`参数校验失败：${detail}`);
    err.name = 'ToolInputError';
    throw err;
  }
  return result.data as Record<string, unknown>;
}
