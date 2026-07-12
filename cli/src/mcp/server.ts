/**
 * MCP Server —— 将已注册 tool 暴露为 MCP 协议（stdio 传输）。
 *
 * 三模式合一的"MCP 适配层"：ListToolsRequest 返回选中 tool 的 JSON Schema 描述，
 * CallToolRequest 路由到 tool handler（经 buildClient 装配的 sdk bundle）。
 *
 * 测试可用 createMcpServer() 拿到 server 实例做 in-process 断言，不经 stdio。
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { meta } from '../core/meta.js';
import { buildClient, type ClientBundle } from '../commands/shared.js';
import { selectTools, toolToMcpDescriptor, parseToolArgs, type ToolDefinition } from './tool-registry.js';
import { registerAllTools, } from './tools/index.js';
import { toCliError } from '../core/errors.js';

export interface McpServerOptions {
  /** --include 模块/tool 列表（启用 optional tier） */
  include?: string[];
  /** --core-only：仅注册 core tier */
  coreOnly?: boolean;
  /** 预构建的 client bundle（测试注入，避免读真实配置） */
  bundle?: ClientBundle;
}

let toolsRegistered = false;

function ensureToolsRegistered(): void {
  if (!toolsRegistered) {
    registerAllTools();
    toolsRegistered = true;
  }
}

/**
 * 创建 MCP server（不连接传输），供 in-process 测试与 startMcpServer 复用。
 * 返回 server 与选中的 tool 列表。
 */
export function createMcpServer(opts: McpServerOptions = {}): { server: Server; tools: ToolDefinition[] } {
  ensureToolsRegistered();
  const tools = selectTools({ include: opts.include, coreOnly: opts.coreOnly });
  const bundle: ClientBundle = opts.bundle ?? buildClient();

  const server = new Server(
    { name: meta.name, version: meta.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(toolToMcpDescriptor),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) {
      return { content: [{ type: 'text', text: `未知 tool：${toolName}` }], isError: true };
    }
    try {
      const parsed = parseToolArgs(tool, args);
      const result = await tool.handler(parsed, { bundle });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const cliErr = toCliError(err);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: cliErr.toJSON() }) }],
        isError: true,
      };
    }
  });

  return { server, tools };
}

/** 启动 MCP server（stdio 传输），返回 server 实例 */
export async function startMcpServer(opts: McpServerOptions = {}): Promise<Server> {
  const { server } = createMcpServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

/** 导出工具清单（供 --json-tools 自省） */
export function listToolDescriptors(opts: McpServerOptions = {}): ReturnType<typeof toolToMcpDescriptor>[] {
  ensureToolsRegistered();
  return selectTools(opts).map(toolToMcpDescriptor);
}
