/**
 * commands 层聚合（L3 命令定义）。
 *
 * 每个命令模块导出 `register<Name>(program: Command)`，由本聚合统一调用。
 * 新增命令时：在此 import 并在 `registerCommands` 内追加一行即可。
 */
import type { Command } from 'commander';
import { registerCapabilities } from './capabilities.js';

/** 将所有命令注册到给定 program */
export function registerCommands(program: Command): void {
  registerCapabilities(program);
}

export { CAPABILITIES } from './capabilities.js';
export type { Capability } from './capabilities.js';
export { VERSION, VERSION_STRING } from './version.js';
