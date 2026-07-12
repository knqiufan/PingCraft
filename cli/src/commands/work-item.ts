/**
 * `work-item` 命令命名空间（L3）。
 *
 * list / get / create / update / delete。
 * list 支持 --all（workItems.listAll 自动分页）；create 支持 --dry-run。
 * 时间字段（--start-at/--end-at）接受 ISO 或日期，内部转 10 位秒级时间戳。
 */
import type { Command } from 'commander';
import {
  buildClient,
  buildOutputContext,
  getConnectionOptions,
  runHandler,
  type ListOptions,
  type OutputOptions,
} from './shared.js';
import { parsePagingOptions } from '../core/pagination.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';
import { CliError, ExitCode, ErrorCode } from '../core/errors.js';

/** 将 ISO/日期字符串转为 10 位秒级时间戳 */
function toUnixTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const ts = Date.parse(value);
  if (!Number.isNaN(ts)) return Math.floor(ts / 1000);
  const n = Number(value);
  if (Number.isFinite(n)) return Math.floor(n);
  throw new CliError({ message: `无法解析时间值：${value}（需 ISO 字符串或日期）`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
}

interface ListCmdOptions extends OutputOptions, ListOptions {
  project?: string;
  type?: string;
  state?: string;
  assignee?: string;
  q?: string;
}

interface CreateCmdOptions extends OutputOptions {
  project: string;
  type: string;
  title: string;
  description?: string;
  priority?: string;
  assignee?: string;
  sprint?: string;
  parent?: string;
  startAt?: string;
  endAt?: string;
  estimatedWorkload?: string;
  property?: string[];
  dryRun?: boolean;
}

interface UpdateCmdOptions extends OutputOptions {
  title?: string;
  description?: string;
  priority?: string;
  assignee?: string;
  sprint?: string;
  startAt?: string;
  endAt?: string;
}

export function registerWorkItemCommands(program: Command): void {
  const workItem = program.command('work-item').description('工作项管理');

  workItem
    .command('list')
    .description('列出工作项（--project 必填）')
    .requiredOption('--project <id>', '项目 ID')
    .option('--type <id>', '按工作项类型过滤')
    .option('--state <id>', '按状态过滤')
    .option('--assignee <id>', '按负责人过滤')
    .option('--q <text>', '关键字搜索')
    .option('--page <n>', '页码（0 基）')
    .option('--page-size <n>', '每页条数')
    .option('--all', '拉取全部（自动分页）')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪（逗号分隔）')
    .option('--quiet', '仅输出 id')
    .action((opts: ListCmdOptions) =>
      runHandler(async () => {
        const { workItems } = buildClient(getConnectionOptions(workItem));
        const out = buildOutputContext(opts);
        const paging = parsePagingOptions({ page: opts.page, pageSize: opts.pageSize, all: opts.all });
        const filter = {
          projectId: opts.project!,
          ...(opts.type ? { typeId: opts.type } : {}),
          ...(opts.state ? { stateId: opts.state } : {}),
          ...(opts.assignee ? { assigneeId: opts.assignee } : {}),
          ...(opts.q ? { q: opts.q } : {}),
        };

        if (paging.fetchAll) {
          const result = await workItems.listAll({ ...filter, pageSize: paging.pageSize });
          if (result.truncated) logProgress(`警告：已达到分页上限，结果可能不完整（${result.values.length} 条）`);
          emitList(result.values, out, { page: 0, pageSize: paging.pageSize, total: result.total ?? result.values.length });
          return;
        }
        const { values, total } = await workItems.list({ ...filter, pageIndex: paging.pageIndex, pageSize: paging.pageSize });
        emitList(values, out, { page: paging.pageIndex, pageSize: paging.pageSize, total: total ?? values.length });
      }),
    );

  workItem
    .command('get')
    .description('查看工作项详情')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { workItems } = buildClient(getConnectionOptions(workItem));
        const detail = await workItems.get(id);
        emitSingle(detail, buildOutputContext(opts));
      }),
    );

  workItem
    .command('create')
    .description('创建工作项（--project/--type/--title 必填）')
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--type <id>', '工作项类型 ID')
    .requiredOption('--title <title>', '标题')
    .option('--description <text>', '描述')
    .option('--priority <id>', '优先级 ID')
    .option('--assignee <id>', '负责人 ID')
    .option('--sprint <id>', '迭代 ID')
    .option('--parent <id>', '父工作项 ID')
    .option('--start-at <date>', '开始时间（ISO/日期）')
    .option('--end-at <date>', '结束时间（ISO/日期）')
    .option('--estimated-workload <n>', '预估工时')
    .option('--property <key=value>', '属性（可重复，格式 key=value）')
    .option('--dry-run', '仅打印请求体，不实际创建')
    .option('--json', 'JSON 输出')
    .action((opts: CreateCmdOptions) =>
      runHandler(async () => {
        const body: Record<string, unknown> = {
          project_id: opts.project,
          type_id: opts.type,
          title: opts.title,
        };
        if (opts.description !== undefined) body.description = opts.description;
        if (opts.priority !== undefined) body.priority_id = opts.priority;
        if (opts.assignee !== undefined) body.assignee_id = opts.assignee;
        if (opts.sprint !== undefined) body.sprint_id = opts.sprint;
        if (opts.parent !== undefined) body.parent_id = opts.parent;
        const startAt = toUnixTimestamp(opts.startAt);
        const endAt = toUnixTimestamp(opts.endAt);
        if (startAt !== undefined) body.start_at = startAt;
        if (endAt !== undefined) body.end_at = endAt;
        if (opts.estimatedWorkload !== undefined) body.estimated_workload = Number(opts.estimatedWorkload);
        if (opts.property && opts.property.length) {
          const properties: Record<string, unknown> = {};
          for (const entry of opts.property) {
            const idx = entry.indexOf('=');
            if (idx <= 0) throw new CliError({ message: `--property 格式应为 key=value：${entry}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
            properties[entry.slice(0, idx)] = entry.slice(idx + 1);
          }
          body.properties = properties;
        }

        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { workItems } = buildClient(getConnectionOptions(workItem));
        const created = await workItems.create(body as never);
        emitSingle(created, buildOutputContext(opts));
      }),
    );

  workItem
    .command('update')
    .description('更新工作项')
    .argument('<id>')
    .option('--title <title>', '标题')
    .option('--description <text>', '描述')
    .option('--priority <id>', '优先级 ID')
    .option('--assignee <id>', '负责人 ID')
    .option('--sprint <id>', '迭代 ID')
    .option('--start-at <date>', '开始时间')
    .option('--end-at <date>', '结束时间')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: UpdateCmdOptions) =>
      runHandler(async () => {
        const body: Record<string, unknown> = {};
        if (opts.title !== undefined) body.title = opts.title;
        if (opts.description !== undefined) body.description = opts.description;
        if (opts.priority !== undefined) body.priority_id = opts.priority;
        if (opts.assignee !== undefined) body.assignee_id = opts.assignee;
        if (opts.sprint !== undefined) body.sprint_id = opts.sprint;
        const startAt = toUnixTimestamp(opts.startAt);
        const endAt = toUnixTimestamp(opts.endAt);
        if (startAt !== undefined) body.start_at = startAt;
        if (endAt !== undefined) body.end_at = endAt;
        const { workItems } = buildClient(getConnectionOptions(workItem));
        const updated = await workItems.update(id, body as never);
        emitSingle(updated, buildOutputContext(opts));
      }),
    );

  workItem
    .command('delete')
    .description('删除工作项')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { workItems } = buildClient(getConnectionOptions(workItem));
        await workItems.remove(id);
        emitSingle({ id, deleted: true }, buildOutputContext(opts));
      }),
    );
}
