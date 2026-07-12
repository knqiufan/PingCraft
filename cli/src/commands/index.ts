/**
 * commands 层聚合（L3 命令定义）。
 *
 * 每个命名空间模块导出 `register<Name>(program)`，由本聚合统一调用。
 * 全局连接选项（--profile/--host）在 `src/index.ts` 的 program 根上注册。
 */
import type { Command } from 'commander';
import { registerCapabilities } from './capabilities.js';
import { registerAuthCommands } from './auth.js';
import { registerProjectCommands } from './project.js';
import { registerWorkItemCommands } from './work-item.js';
import { registerWorkItemSubResources } from './work-item-sub.js';
import { registerWorkItemMetaCommands } from './work-item-meta.js';
import { registerSchemeCommands } from './scheme.js';
import { registerSprintCommands } from './sprint.js';
import { registerReleaseCommands } from './release.js';
import { registerKanbanCommands } from './kanban.js';
import { registerWaterfallCommands } from './waterfall.js';
import { registerDirectoryCommands } from './directory.js';
import { registerCommonCommands } from './common.js';
import { registerWikiCommands } from './wiki.js';
import { registerMcpCommands } from './mcp.js';
import { registerPingcraftCommands } from './pingcraft.js';
import { registerProductCommands } from './product.js';
import { registerTicketCommands } from './ticket.js';
import { registerTesthubCommands } from './testhub.js';
import { registerDevopsCommands } from './devops.js';

/** 将所有命令注册到给定 program */
export function registerCommands(program: Command): void {
  registerCapabilities(program);
  registerAuthCommands(program);
  registerProjectCommands(program);
  // work-item 核心命令需先于子资源注册（子资源挂到 work-item 命令上）
  registerWorkItemCommands(program);
  registerWorkItemSubResources(program);
  registerWorkItemMetaCommands(program);
  registerSchemeCommands(program);
  registerSprintCommands(program);
  registerReleaseCommands(program);
  registerKanbanCommands(program);
  registerWaterfallCommands(program);
  registerDirectoryCommands(program);
  registerCommonCommands(program);
  registerWikiCommands(program);
  registerMcpCommands(program);
  registerPingcraftCommands(program);
  registerProductCommands(program);
  registerTicketCommands(program);
  registerTesthubCommands(program);
  registerDevopsCommands(program);
}

export { CAPABILITIES } from './capabilities.js';
export type { Capability } from './capabilities.js';
export { VERSION, VERSION_STRING } from './version.js';
export { runHandler, ExitSignal } from './shared.js';
