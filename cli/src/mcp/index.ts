/**
 * MCP Server 模式聚合导出。
 *
 * `pingcode mcp serve` 启动 stdio MCP Server，三层 tool 注册策略
 * （core 始终注册 / optional 经 --include 启用 / longtail 仅 CLI）。
 */
export { createMcpServer, startMcpServer, listToolDescriptors } from './server.js';
export type { McpServerOptions } from './server.js';
export { registerTool, selectTools, toolToMcpDescriptor, parseToolArgs, clearTools, getRegisteredTools } from './tool-registry.js';
export type { ToolDefinition, ToolTier, ToolContext, McpToolDescriptor } from './tool-registry.js';
export { registerAllTools } from './tools/index.js';

/** MCP 模块版本 */
export const MCP_VERSION = '0.4.0';

