/**
 * 工作项元数据命令命名空间（L3）。
 *
 * work-item-type / work-item-state / work-item-property / work-item-priority，
 * 各自提供 `list` 子命令查询 PingCode 元数据。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions } from './shared.js';
import { emitList } from '../core/output.js';

export function registerWorkItemMetaCommands(program: Command): void {
  const typeCmd = program.command('work-item-type').description('工作项类型');
  typeCmd
    .command('list')
    .description('列出工作项类型')
    .requiredOption('--project <id>', '项目 ID')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { workItemMeta } = buildClient(getConnectionOptions(typeCmd));
        const { values } = await workItemMeta.types(opts.project);
        emitList(values, buildOutputContext(opts));
      }),
    );

  const stateCmd = program.command('work-item-state').description('工作项状态');
  stateCmd
    .command('list')
    .description('列出工作项状态')
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--type <id>', '工作项类型 ID')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions & { project: string; type: string }) =>
      runHandler(async () => {
        const { workItemMeta } = buildClient(getConnectionOptions(stateCmd));
        const { values } = await workItemMeta.states(opts.project, opts.type);
        emitList(values, buildOutputContext(opts));
      }),
    );

  const propCmd = program.command('work-item-property').description('工作项属性');
  propCmd
    .command('list')
    .description('列出工作项属性')
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--type <id>', '工作项类型 ID')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions & { project: string; type: string }) =>
      runHandler(async () => {
        const { workItemMeta } = buildClient(getConnectionOptions(propCmd));
        const { values } = await workItemMeta.properties(opts.project, opts.type);
        emitList(values, buildOutputContext(opts));
      }),
    );

  const priorityCmd = program.command('work-item-priority').description('工作项优先级');
  priorityCmd
    .command('list')
    .description('列出工作项优先级')
    .requiredOption('--project <id>', '项目 ID')
    .option('--json', 'JSON 输出')
    .option('--fields <list>', '字段裁剪')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { workItemMeta } = buildClient(getConnectionOptions(priorityCmd));
        const { values } = await workItemMeta.priorities(opts.project);
        emitList(values, buildOutputContext(opts));
      }),
    );
}
