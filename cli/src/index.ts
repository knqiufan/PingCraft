/**
 * PingCraft CLI 库入口 —— Commander program 组装。
 *
 * 本模块**不含任何副作用**（不读 argv、不自动 run、不触发 process.exit），
 * 因此可被测试与库模式安全 import。CLI 启动逻辑放在 `src/main.ts`。
 *
 * 设计要点：
 *  - `createProgram()` 是可被测试/库模式复用的纯工厂；`exitOverride()` 让 Commander
 *    以抛错代替直接 `process.exit`，从而在 `run()` 中统一控制退出码（见总体规划 §4.3）。
 *  - `run()` 返回数值退出码，由调用方决定如何退出（测试可断言、main 可 process.exit）。
 *  - 进度/错误走 stderr，数据走 stdout（保证 `| jq` 纯净）。
 */
import { Command, CommanderError } from 'commander';
import { meta } from './core/index.js';
import { registerCommands, VERSION_STRING } from './commands/index.js';

/** 构建并返回配置好的 Commander program（不解析） */
export function createProgram(): Command {
  const program = new Command();
  // 以抛错代替 process.exit，使退出码可控、可在测试中捕获。
  program.exitOverride();
  program
    .name(meta.name)
    .description(meta.description)
    // --version 输出 `pingcode/0.1.0` 形式
    .version(VERSION_STRING, '-V, --version', `输出 ${meta.name} 的版本号`)
    // 全局连接选项：在子命令前使用，如 `pingcode --profile prod project list`
    .option('--profile <name>', '使用指定 profile（覆盖 default_profile / 环境变量）')
    .option('--host <url>', 'PingCode 开放平台地址（覆盖配置/环境变量）');
  registerCommands(program);
  return program;
}

/** 将任意错误归一化为退出码（与总体规划 §4.3 退出码表对齐） */
function exitCodeForError(err: unknown): number {
  if (err instanceof CommanderError) return err.exitCode;
  if (
    err &&
    typeof err === 'object' &&
    'exitCode' in err &&
    typeof (err as { exitCode: unknown }).exitCode === 'number'
  ) {
    return (err as { exitCode: number }).exitCode;
  }
  return 1;
}

/**
 * 运行 CLI。
 *
 * @param argv 可选的参数数组，默认 `process.argv`（测试可显式传入）
 * @returns 进程退出码（0 成功 / 非 0 失败）
 */
export async function run(argv: string[] = process.argv): Promise<number> {
  const program = createProgram();
  try {
    // argv 形如 ['node', '<script>', ...userArgs]；默认 from:'node' 会剔除前两项。
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    // --version / --help 成功退出也会抛 CommanderError(exitCode=0)，其输出已由 Commander 写入。
    if (err instanceof CommanderError) {
      return err.exitCode;
    }
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return exitCodeForError(err);
  }
}

export { meta } from './core/index.js';
