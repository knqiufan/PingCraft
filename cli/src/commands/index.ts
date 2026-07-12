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
import { registerWorkItemMetaCommands } from './work-item-meta.js';

/** 将所有命令注册到给定 program */
export function registerCommands(program: Command): void {
  registerCapabilities(program);
  registerAuthCommands(program);
  registerProjectCommands(program);
  registerWorkItemCommands(program);
  registerWorkItemMetaCommands(program);
}

export { CAPABILITIES } from './capabilities.js';
export type { Capability } from './capabilities.js';
export { VERSION, VERSION_STRING } from './version.js';
export { runHandler, ExitSignal } from './shared.js';
