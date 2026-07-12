/**
 * 资源命令注册工厂（L3 内部工具）。
 *
 * Product/Testhub 大量资源同构（list/get/create/update/delete），用本工厂收敛样板。
 * 特殊命令（transition/batch/link）在各模块文件追加。
 */
import type { Command } from 'commander';
import { buildOutputContext, runHandler, type OutputOptions, type ListOptions } from './shared.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';

export interface ResourceOps {
  list(params?: Record<string, unknown>): Promise<{ values: unknown[]; total?: number }>;
  get(id: string): Promise<unknown>;
  create?(body: Record<string, unknown>): Promise<unknown>;
  update?(id: string, body: Record<string, unknown>): Promise<unknown>;
  remove?(id: string): Promise<void>;
}

export interface CrudCommandOptions {
  /** list 的额外查询参数选项，如 [['--product <id>', '产品 ID']] */
  listParams?: [string, string][];
  /** create 的 required 选项 */
  createFields?: [string, string][];
  /** 是否生成 create/update/delete（默认全生成） */
  writable?: boolean;
}

/** 为 parent 注册一组标准 CRUD 子命令，返回创建的命令组（可继续追加子命令） */
export function registerResource(
  parent: Command,
  label: string,
  desc: string,
  getOps: () => ResourceOps,
  opts: CrudCommandOptions = {},
): Command {
  const writable = opts.writable ?? true;
  const group = parent.command(label).description(desc);

  // list
  const listCmd = group.command('list').description(`${desc}列表`);
  listCmd.option('--page <n>', '页码').option('--page-size <n>', '每页条数').option('--json', 'JSON 输出').option('--fields <list>', '字段裁剪').option('--quiet', '仅输出 id');
  for (const [flag, fdesc] of opts.listParams ?? []) listCmd.option(flag, fdesc);
  listCmd.action((cliOpts: ListOptions & OutputOptions & Record<string, unknown>) =>
    runHandler(async () => {
      const ops = getOps();
      const { page, pageSize, ...rest } = cliOpts;
      void page;
      void pageSize;
      const { values, total } = await ops.list({ pageIndex: Number(cliOpts.page || 0), pageSize: Number(cliOpts.pageSize || 30), ...rest });
      emitList(values, buildOutputContext(cliOpts), { page: Number(cliOpts.page || 0), pageSize: Number(cliOpts.pageSize || 30), total: total ?? values.length });
    }),
  );

  // get
  group
    .command('get')
    .argument('<id>')
    .description(`${desc}详情`)
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .action((id: string, cliOpts: OutputOptions) =>
      runHandler(async () => {
        emitSingle(await getOps().get(id), buildOutputContext(cliOpts));
      }),
    );

  if (!writable) return group;

  // create
  const createCmd = group.command('create').description(`创建${desc}`).option('--dry-run', '仅打印请求体').option('--json', 'JSON 输出');
  for (const [flag, fdesc] of opts.createFields ?? []) createCmd.requiredOption(flag, fdesc);
  createCmd.option('--extra <json>', '额外字段（JSON 对象）');
  createCmd.action((cliOpts: OutputOptions & { dryRun?: boolean; extra?: string } & Record<string, unknown>) =>
    runHandler(async () => {
      const { dryRun, extra, ...fields } = cliOpts;
      const body: Record<string, unknown> = { ...fields };
      if (extra) Object.assign(body, JSON.parse(extra));
      if (dryRun) {
        logProgress('（--dry-run）未发送请求');
        emitSingle(body, buildOutputContext(cliOpts));
        return;
      }
      emitSingle(await getOps().create!(body), buildOutputContext(cliOpts));
    }),
  );

  // update
  group
    .command('update')
    .argument('<id>')
    .description(`更新${desc}`)
    .requiredOption('--fields <json>', '更新字段（JSON 对象）')
    .option('--json', 'JSON 输出')
    .action((id: string, cliOpts: OutputOptions & { fields: string }) =>
      runHandler(async () => {
        emitSingle(await getOps().update!(id, JSON.parse(cliOpts.fields)), buildOutputContext(cliOpts));
      }),
    );

  // delete
  group
    .command('delete')
    .argument('<id>')
    .description(`删除${desc}`)
    .option('--json', 'JSON 输出')
    .action((id: string, cliOpts: OutputOptions) =>
      runHandler(async () => {
        await getOps().remove!(id);
        emitSingle({ id, deleted: true }, buildOutputContext(cliOpts));
      }),
    );

  return group;
}

/** 注册一个只读 list 子命令（元数据/配置中心常用） */
export function registerListOnly(parent: Command, label: string, desc: string, listFn: () => Promise<{ values: unknown[]; total?: number }>): void {
  parent
    .command(label)
    .description(desc)
    .command('list')
    .option('--json', 'JSON 输出')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await listFn();
        emitList(values, buildOutputContext(opts));
      }),
    );
}
