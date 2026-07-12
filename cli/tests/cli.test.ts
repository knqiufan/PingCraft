/**
 * Phase 0 冒烟测试：验证脚手架可跑、命令注册机制工作。
 *
 * 不追求高覆盖率（骨架文件占多数），但建立后续阶段的测试基座：
 *  - 驱动 Commander 的 `program.parseAsync`
 *  - 捕获 stdout/stderr 与退出码（exitOverride 以抛错代替 process.exit）
 *  - 跨平台断言用 toContain，规避 Windows CRLF 差异
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommanderError } from 'commander';
import { createProgram } from '../src/index.js';
import { VERSION } from '../src/commands/version.js';
import { CAPABILITIES } from '../src/commands/index.js';

interface Capture {
  code: number;
  stdout: string;
  stderr: string;
}

/** 驱动一个新 program 解析给定用户参数，捕获输出与退出码 */
async function runCapture(userArgs: string[]): Promise<Capture> {
  const program = createProgram();
  let stdout = '';
  let stderr = '';
  const outSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
      return true;
    });
  const errSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
      return true;
    });
  let code = 0;
  try {
    // ['node', 'pingcode', ...userArgs] —— 默认 from:'node' 剔除前两项
    await program.parseAsync(['node', 'pingcode', ...userArgs]);
  } catch (err) {
    code = err instanceof CommanderError ? err.exitCode : 1;
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
  return { code, stdout, stderr };
}

describe('Phase 0 脚手架冒烟', () => {
  beforeEach(() => {
    // 确保各用例间 spies 已复位（防御性）
    vi.restoreAllMocks();
  });

  it('pingcode --version 输出版本号、退出码 0', async () => {
    const { code, stdout } = await runCapture(['--version']);
    expect(code).toBe(0);
    expect(stdout).toContain(VERSION);
  });

  it('pingcode -V（短选项）同样输出版本号', async () => {
    const { code, stdout } = await runCapture(['-V']);
    expect(code).toBe(0);
    expect(stdout).toContain(VERSION);
  });

  it('pingcode --help 列出 capabilities 命令、退出码 0', async () => {
    const { code, stdout } = await runCapture(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('capabilities');
    expect(stdout.toLowerCase()).toContain('usage');
  });

  it('pingcode capabilities --json 输出有效 JSON 能力清单、退出码 0', async () => {
    const { code, stdout } = await runCapture(['capabilities', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout) as Array<{ command: string; status: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(CAPABILITIES.length);
    const commands = parsed.map((c) => c.command);
    expect(commands).toContain('capabilities');
    expect(commands).toContain('auth');
    expect(commands).toContain('work-item');
  });

  it('pingcode capabilities（无 --json，非 TTY 环境）回退到 JSON 输出', async () => {
    // 测试运行器通常非 TTY —— 应输出 JSON 以保证管道纯净
    const { code, stdout } = await runCapture(['capabilities']);
    expect(code).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it('未知命令返回非零退出码', async () => {
    const { code } = await runCapture(['totally-unknown-command']);
    expect(code).not.toBe(0);
  });
});
