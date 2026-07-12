/**
 * 批量输入读取（L1 core）。
 *
 * 所有批量命令（sprint create-batch / work-item batch-update 等）统一通过本模块读取
 * 输入项，保证一致的 `--file`/`--stdin` 行为与错误处理。
 */
import fs from 'node:fs';
import { CliError, ExitCode, ErrorCode } from './errors.js';

export interface BatchInputOptions {
  /** 从 JSON 文件读取 */
  file?: string;
  /** 从 stdin 读取 JSON */
  stdin?: boolean;
}

/** 从 stdin 读取全部内容 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (buf += chunk));
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function parseJsonArray(raw: string, source: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new CliError({ message: `${source} 的 JSON 解析失败：${(e as Error).message}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS, cause: e });
  }
  if (!Array.isArray(parsed)) {
    throw new CliError({ message: `${source} 期望 JSON 数组，实际为 ${parsed === null ? 'null' : typeof parsed}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
  }
  return parsed;
}

/**
 * 读取批量输入项。优先级：--file > --stdin；二者皆无则抛参数错（exit 2）。
 */
export async function readItems<T = unknown>(opts: BatchInputOptions): Promise<T[]> {
  if (opts.file) {
    let raw: string;
    try {
      raw = fs.readFileSync(opts.file, 'utf-8');
    } catch (e) {
      throw new CliError({ message: `读取文件失败：${opts.file} — ${(e as Error).message}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS, cause: e });
    }
    return parseJsonArray(raw, `文件 ${opts.file}`) as T[];
  }
  if (opts.stdin) {
    const raw = await readStdin();
    return parseJsonArray(raw, 'stdin') as T[];
  }
  throw new CliError({ message: '批量命令需要 --file <path> 或 --stdin 提供输入', code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
}
