/**
 * `sprint` 命令命名空间（L3）。
 *
 * list/get/create/create-batch/update/groups/categories/work-items。
 * create-batch 复用 core/input.readItems + SDK createBatch（并发 + 进度）。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions, type ListOptions } from './shared.js';
import { readItems } from '../core/input.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';
import { CliError, ExitCode, ErrorCode } from '../core/errors.js';
import { paginate, parsePagingOptions } from '../core/pagination.js';

function toUnix(value?: string): number | undefined {
  if (!value) return undefined;
  const ts = Date.parse(value);
  if (!Number.isNaN(ts)) return Math.floor(ts / 1000);
  throw new CliError({ message: `无法解析时间：${value}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
}

export function registerSprintCommands(program: Command): void {
  const sprint = program.command('sprint').description('Scrum 迭代管理');

  sprint
    .command('list')
    .requiredOption('--project <id>', '项目 ID')
    .option('--page <n>', '页码')
    .option('--page-size <n>', '每页条数')
    .option('--all', '拉取全部')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((opts: ListOptions & OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { sprints } = buildClient(getConnectionOptions(sprint));
        const paging = parsePagingOptions(opts);
        if (paging.fetchAll) {
          const result = await paginate(async (pageIndex, pageSize) => sprints.list({ projectId: opts.project, pageIndex, pageSize }), { pageSize: paging.pageSize });
          emitList(result.values, buildOutputContext(opts), { page: 0, pageSize: paging.pageSize, total: result.total ?? result.values.length });
          return;
        }
        const { values, total } = await sprints.list({ projectId: opts.project, pageIndex: paging.pageIndex, pageSize: paging.pageSize });
        emitList(values, buildOutputContext(opts), { page: paging.pageIndex, pageSize: paging.pageSize, total: total ?? values.length });
      }),
    );

  sprint
    .command('get')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { sprints } = buildClient(getConnectionOptions(sprint));
        emitSingle(await sprints.get(id), buildOutputContext(opts));
      }),
    );

  sprint
    .command('create')
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--name <name>', '迭代名称')
    .option('--start-at <date>', '开始时间')
    .option('--end-at <date>', '结束时间')
    .option('--goal <text>', '迭代目标')
    .option('--dry-run', '仅打印请求体')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; name: string; startAt?: string; endAt?: string; goal?: string; dryRun?: boolean }) =>
      runHandler(async () => {
        const body = {
          project_id: opts.project,
          name: opts.name,
          ...(opts.startAt ? { start_at: toUnix(opts.startAt) } : {}),
          ...(opts.endAt ? { end_at: toUnix(opts.endAt) } : {}),
          ...(opts.goal ? { goal: opts.goal } : {}),
        };
        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { sprints } = buildClient(getConnectionOptions(sprint));
        emitSingle(await sprints.create(body as never), buildOutputContext(opts));
      }),
    );

  sprint
    .command('create-batch')
    .requiredOption('--project <id>', '项目 ID')
    .option('--file <path>', '从 JSON 文件读取批量数据')
    .option('--stdin', '从 stdin 读取 JSON')
    .option('--concurrency <n>', '并发数', '3')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; file?: string; stdin?: boolean; concurrency: string }) =>
      runHandler(async () => {
        const items = await readItems<Record<string, unknown>>(opts);
        const payloads = items.map((item, i) => ({ project_id: opts.project, ...item, _local_id: item._local_id ?? i + 1 }));
        const { sprints } = buildClient(getConnectionOptions(sprint));
        const result = await sprints.createBatch(payloads as never, {
          concurrency: Number(opts.concurrency) || 3,
          onProgress: (current, total, status) => logProgress(`[${current}/${total}] ${status}`),
        });
        logProgress(`完成：成功 ${result.success}，失败 ${result.failed}`);
        emitSingle(result, buildOutputContext(opts));
      }),
    );

  sprint
    .command('update')
    .argument('<id>')
    .option('--name <name>', '迭代名称')
    .option('--state <id>', '状态')
    .option('--goal <text>', '目标')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { name?: string; state?: string; goal?: string }) =>
      runHandler(async () => {
        const body: Record<string, unknown> = {};
        if (opts.name !== undefined) body.name = opts.name;
        if (opts.state !== undefined) body.status = opts.state;
        if (opts.goal !== undefined) body.goal = opts.goal;
        const { sprints } = buildClient(getConnectionOptions(sprint));
        emitSingle(await sprints.update(id, body as never), buildOutputContext(opts));
      }),
    );

  sprint
    .command('groups')
    .argument('<id>')
    .description('迭代分组')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { sprints } = buildClient(getConnectionOptions(sprint));
        // groups 实际以 projectId 查询，这里 id 视为 projectId
        const { values } = await sprints.groups(id);
        emitList(values, buildOutputContext(opts));
      }),
    );

  sprint
    .command('categories')
    .description('迭代类别')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { sprints } = buildClient(getConnectionOptions(sprint));
        const { values } = await sprints.categories();
        emitList(values, buildOutputContext(opts));
      }),
    );

  sprint
    .command('work-items')
    .argument('<id>')
    .description('迭代内工作项')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { sprints } = buildClient(getConnectionOptions(sprint));
        const { values } = await sprints.workItems(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
}
