/**
 * `project` 命令命名空间（L3）。
 *
 * list / get / create / update / delete / members。
 * list 支持 --all 自动分页（复用 core/paginate）；create 支持 --dry-run。
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
import { paginate, parsePagingOptions } from '../core/pagination.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';

interface ListCmdOptions extends OutputOptions, ListOptions {
  search?: string;
}

interface CreateCmdOptions extends OutputOptions {
  name: string;
  type?: string;
  identifier?: string;
  description?: string;
  assignee?: string;
  member?: string[];
  dryRun?: boolean;
}

interface UpdateCmdOptions extends OutputOptions {
  name?: string;
  description?: string;
  identifier?: string;
}

export function registerProjectCommands(program: Command): void {
  const project = program.command('project').description('项目管理');

  project
    .command('list')
    .description('列出可访问的项目')
    .option('--search <text>', '按名称搜索')
    .option('--page <n>', '页码（0 基）')
    .option('--page-size <n>', '每页条数')
    .option('--all', '拉取全部（自动分页）')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪（逗号分隔）')
    .option('--quiet', '仅输出 id')
    .action((opts: ListCmdOptions) =>
      runHandler(async () => {
        const { projects } = buildClient(getConnectionOptions(project));
        const out = buildOutputContext(opts);
        const paging = parsePagingOptions({ page: opts.page, pageSize: opts.pageSize, all: opts.all });

        if (paging.fetchAll) {
          const result = await paginate(async (pageIndex, pageSize) => projects.list({ search: opts.search, pageIndex, pageSize }), { pageSize: paging.pageSize });
          if (result.truncated) logProgress(`警告：已达到分页上限，结果可能不完整（${result.values.length} 条）`);
          emitList(result.values, out, { page: 0, pageSize: paging.pageSize, total: result.total ?? result.values.length });
          return;
        }

        const { values, total } = await projects.list({ search: opts.search, pageIndex: paging.pageIndex, pageSize: paging.pageSize });
        emitList(values, out, { page: paging.pageIndex, pageSize: paging.pageSize, total: total ?? values.length });
      }),
    );

  project
    .command('get')
    .description('查看项目详情')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { projects } = buildClient(getConnectionOptions(project));
        const detail = await projects.get(id);
        emitSingle(detail, buildOutputContext(opts));
      }),
    );

  project
    .command('create')
    .description('创建项目')
    .requiredOption('--name <name>', '项目名称')
    .option('--type <type>', '项目类型（如 scrum/kanban）')
    .option('--identifier <id>', '项目标识')
    .option('--description <text>', '描述')
    .option('--assignee <id>', '负责人 ID')
    .option('--member <id>', '成员 ID（可重复）')
    .option('--dry-run', '仅打印请求体，不实际创建')
    .option('--json', 'JSON 输出')
    .action((opts: CreateCmdOptions) =>
      runHandler(async () => {
        const body = {
          name: opts.name,
          ...(opts.type ? { type: opts.type } : {}),
          ...(opts.identifier ? { identifier: opts.identifier } : {}),
          ...(opts.description ? { description: opts.description } : {}),
          ...(opts.assignee ? { assignee_id: opts.assignee } : {}),
          ...(opts.member && opts.member.length ? { members: opts.member } : {}),
        };
        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { projects } = buildClient(getConnectionOptions(project));
        const created = await projects.create(body);
        emitSingle(created, buildOutputContext(opts));
      }),
    );

  project
    .command('update')
    .description('更新项目')
    .argument('<id>')
    .option('--name <name>', '项目名称')
    .option('--description <text>', '描述')
    .option('--identifier <id>', '项目标识')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: UpdateCmdOptions) =>
      runHandler(async () => {
        const body: Record<string, unknown> = {};
        if (opts.name !== undefined) body.name = opts.name;
        if (opts.description !== undefined) body.description = opts.description;
        if (opts.identifier !== undefined) body.identifier = opts.identifier;
        const { projects } = buildClient(getConnectionOptions(project));
        const updated = await projects.update(id, body);
        emitSingle(updated, buildOutputContext(opts));
      }),
    );

  project
    .command('delete')
    .description('删除项目')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { projects } = buildClient(getConnectionOptions(project));
        await projects.remove(id);
        emitSingle({ id, deleted: true }, buildOutputContext(opts));
      }),
    );

  project
    .command('members')
    .description('查看项目成员')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { projects } = buildClient(getConnectionOptions(project));
        const { values } = await projects.members(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
}
