/**
 * 版本信息访问器。
 *
 * `--version` / `-V` 由 Commander 的 `program.version()` 内建处理（在 index.ts 中注册），
 * 本模块仅作为版本元信息的统一读取入口，供 capabilities、诊断、未来 `--version --json` 等复用。
 */
import { meta } from '../core/index.js';

/** 当前 CLI 版本（语义化版本字符串，如 `0.1.0`） */
export const VERSION = meta.version;

/** 带命令名前缀的版本字符串，用于 `--version` 输出，形如 `pingcode/0.1.0` */
export const VERSION_STRING = `${meta.name}/${meta.version}`;
