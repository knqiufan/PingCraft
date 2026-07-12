/**
 * 命令集成测试驱动器。
 *
 * 驱动 createProgram().parseAsync，捕获 stdout/stderr，并把 runHandler 中的
 * process.exit（测试中被 mock 为抛出）转成可断言的 ExitSignal.exitCode。
 */
import { vi } from 'vitest';
import { CommanderError } from 'commander';
import { createProgram } from '../src/index.js';
import { ExitSignal } from '../src/commands/shared.js';

export interface CmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** 内部标记：process.exit 被 mock 时抛出 */
const EXIT_MARK = '__PC_EXIT__';

/** 驱动 CLI（userArgs 不含 node/脚本前缀） */
export async function runCmd(userArgs: string[]): Promise<CmdResult> {
  let stdout = '';
  let stderr = '';
  const outSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stdout += typeof c === 'string' ? c : Buffer.from(c).toString();
      return true;
    });
  const errSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stderr += typeof c === 'string' ? c : Buffer.from(c).toString();
      return true;
    });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error(EXIT_MARK);
  }) as never);

  let exitCode = 0;
  try {
    await createProgram().parseAsync(['node', 'pingcode', ...userArgs]);
  } catch (e) {
    if (e instanceof ExitSignal) exitCode = e.code;
    else if (e instanceof CommanderError) exitCode = e.exitCode;
    else if (e instanceof Error && e.message === EXIT_MARK) exitCode = 1;
    else throw e;
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
    exitSpy.mockRestore();
  }
  return { stdout, stderr, exitCode };
}

/** 解析 --json 输出的 stdout 包络 */
export function parseJsonOut<T = unknown>(stdout: string): T {
  return JSON.parse(stdout.trim()) as T;
}
