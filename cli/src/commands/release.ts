/**
 * `release` 命令命名空间（L3）。
 *
 * list/get/create/update/delete/stages/groups/categories。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions, type ListOptions } from './shared.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';
import { CliError, ExitCode, ErrorCode } from '../core/errors.js';

function toUnix(value?: string): number | undefined {
  if (!value) return undefined;
  const ts = Date.parse(value);
  if (!Number.isNaN(ts)) return Math.floor(ts / 1000);
  throw new CliError({ message: `无法解析时间：${value}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
}

export function registerReleaseCommands(program: Command): void {
  const release = program.command('release').description('发布/版本管理');

  release
    .command('list')
    .requiredOption('--project <id>', '项目 ID')
    .option('--page <n>', '页码')
    .option('--page-size <n>', '每页条数')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((opts: ListOptions & OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { releases } = buildClient(getConnectionOptions(release));
        const { values, total } = await releases.list({ projectId: opts.project, pageIndex: Number(opts.page || 0), pageSize: Number(opts.pageSize || 30) });
        emitList(values, buildOutputContext(opts), { page: Number(opts.page || 0), pageSize: Number(opts.pageSize || 30), total: total ?? values.length });
      }),
    );

  release.command('get').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { releases } = buildClient(getConnectionOptions(release));
      emitSingle(await releases.get(id), buildOutputContext(opts));
    }),
  );

  release
    .command('create')
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--name <name>', '发布名称')
    .option('--start-at <date>', '开始时间')
    .option('--end-at <date>', '结束时间')
    .option('--dry-run', '仅打印请求体')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; name: string; startAt?: string; endAt?: string; dryRun?: boolean }) =>
      runHandler(async () => {
        const body = {
          project_id: opts.project,
          name: opts.name,
          ...(opts.startAt ? { start_at: toUnix(opts.startAt) } : {}),
          ...(opts.endAt ? { end_at: toUnix(opts.endAt) } : {}),
        };
        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { releases } = buildClient(getConnectionOptions(release));
        emitSingle(await releases.create(body as never), buildOutputContext(opts));
      }),
    );

  release.command('update').argument('<id>').option('--name <name>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions & { name?: string }) =>
    runHandler(async () => {
      const body = opts.name !== undefined ? { name: opts.name } : {};
      const { releases } = buildClient(getConnectionOptions(release));
      emitSingle(await releases.update(id, body as never), buildOutputContext(opts));
    }),
  );

  release.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { releases } = buildClient(getConnectionOptions(release));
      await releases.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );

  release.command('stages').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { releases } = buildClient(getConnectionOptions(release));
      const { values } = await releases.stages(id);
      emitList(values, buildOutputContext(opts));
    }),
  );

  release.command('groups').option('--json', 'JSON 输出').action((opts: OutputOptions) =>
    runHandler(async () => {
      const { releases } = buildClient(getConnectionOptions(release));
      const { values } = await releases.groups();
      emitList(values, buildOutputContext(opts));
    }),
  );

  release.command('categories').option('--json', 'JSON 输出').action((opts: OutputOptions) =>
    runHandler(async () => {
      const { releases } = buildClient(getConnectionOptions(release));
      const { values } = await releases.categories();
      emitList(values, buildOutputContext(opts));
    }),
  );
}
