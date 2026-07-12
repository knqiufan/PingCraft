/**
 * `waterfall` 命令命名空间（L3，只读）。
 *
 * work-item-types / transitions（按项目）。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions } from './shared.js';
import { emitList } from '../core/output.js';

export function registerWaterfallCommands(program: Command): void {
  const waterfall = program.command('waterfall').description('瀑布管理（只读）');

  waterfall
    .command('work-item-types')
    .requiredOption('--project <id>', '项目 ID')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { waterfall: wf } = buildClient(getConnectionOptions(waterfall));
        const { values } = await wf.workItemTypes(opts.project);
        emitList(values, buildOutputContext(opts));
      }),
    );

  waterfall
    .command('transitions')
    .requiredOption('--project <id>', '项目 ID')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { waterfall: wf } = buildClient(getConnectionOptions(waterfall));
        const { values } = await wf.transitions(opts.project);
        emitList(values, buildOutputContext(opts));
      }),
    );
}
