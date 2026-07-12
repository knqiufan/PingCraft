/**
 * CLI 元信息（单一事实来源）。
 *
 * name / version / description 在此统一从 package.json 读取，供：
 *  - Commander 的 `.name()` / `.version()` / `.description()`
 *  - `--version` 输出
 *  - 错误/帮助/日志前缀
 * 复用，避免多处硬编码导致漂移。
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** package.json 内容（仅取所需字段，保持类型收紧） */
interface PackageMeta {
  name: string;
  version: string;
  description: string;
  /** bin 映射：{ 'pingcode': './bin/pingcode.js' } */
  bin?: Record<string, string> | string;
}

const pkg = require('../../package.json') as PackageMeta;

/** 用户面命令名：优先取 bin 字段的首个键（如 `pingcode`），否则退化为包名末段 */
const commandName =
  typeof pkg.bin === 'string'
    ? (pkg.name.split('/').pop() ?? pkg.name)
    : (pkg.bin ? Object.keys(pkg.bin)[0] : (pkg.name.split('/').pop() ?? pkg.name));

/** CLI 元信息 */
export const meta = {
  /** 命令名（二进制名，用户面） */
  name: commandName,
  /** 包全名（含 scope，用于日志/发布） */
  packageName: pkg.name,
  /** 语义化版本 */
  version: pkg.version,
  /** 一句话定位 */
  description: pkg.description,
} as const;

export type CliMeta = typeof meta;
