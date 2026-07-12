/**
 * `mcp` 命令命名空间（L3）。
 *
 * `pingcode mcp serve`：启动 stdio MCP Server（Agent 直连）。
 * `pingcode mcp tools`：列出 tool 清单（自省，--json 输出）。
 */
import type { Command } from 'commander';
import { startMcpServer, listToolDescriptors } from '../mcp/server.js';
import { runHandler } from './shared.js';

export function registerMcpCommands(program: Command): void {
  const mcp = program.command('mcp').description('MCP Server 模式');

  mcp
    .command('serve')
    .description('启动 stdio MCP Server（供 AI Agent 连接）')
    .option('--include <list>', '启用可选 tool（逗号分隔模块/工具名）')
    .option('--core-only', '仅注册核心 tool')
    .action((opts: { include?: string; coreOnly?: boolean }) =>
      runHandler(async () => {
        const include = opts.include ? opts.include.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
        await startMcpServer({ include, coreOnly: opts.coreOnly });
        // server 持续运行直到 stdio 关闭；runHandler 成功不退出
      }),
    );

  mcp
    .command('tools')
    .description('列出 MCP tool 清单（自省）')
    .option('--include <list>', '启用可选 tool')
    .option('--core-only', '仅核心 tool')
    .option('--json', 'JSON 输出')
    .action((opts: { include?: string; coreOnly?: boolean; json?: boolean }) =>
      runHandler(async () => {
        const include = opts.include ? opts.include.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
        const descriptors = listToolDescriptors({ include, coreOnly: opts.coreOnly });
        if (opts.json) {
          process.stdout.write(`${JSON.stringify(descriptors, null, 2)}\n`);
          return;
        }
        for (const d of descriptors) {
          const flag = d.description.startsWith('⚠️') ? ' [destructive]' : '';
          process.stdout.write(`${d.name}${flag}\n    ${d.description}\n`);
        }
      }),
    );
}
