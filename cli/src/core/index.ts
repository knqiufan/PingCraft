/**
 * core 层聚合导出（L1 核心运行时）。
 *
 * config / auth / output / errors / pagination —— 命令层与库模式的统一底座。
 */
export { meta } from './meta.js';
export type { CliMeta } from './meta.js';

export * from './errors.js';
export * from './pagination.js';
export * from './config.js';
export * from './auth.js';
export * from './output.js';
