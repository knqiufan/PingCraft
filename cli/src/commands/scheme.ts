/**
 * 配置中心 scheme 命令（L3，只读）。
 *
 * scheme state/property/type/transition（按项目/工作项类型）。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions } from './shared.js';
import { emitList } from '../core/output.js';

export function registerSchemeCommands(program: Command): void {
  const scheme = program.command('scheme').description('工作项配置中心（scheme，只读）');

  const projectTypeRequired = (cmd: Command) =>
    cmd.requiredOption('--project <id>', '项目 ID').option('--type <id>', '工作项类型 ID').option('--json', 'JSON 输出').option('--fields <list>', '字段裁剪');

  const stateCmd = scheme.command('state').description('状态方案');
  projectTypeRequired(stateCmd);
  stateCmd.action((opts: OutputOptions & { project: string }) =>
    runHandler(async () => {
      const { workItemScheme } = buildClient(getConnectionOptions(scheme));
      const { values } = await workItemScheme.states(opts.project);
      emitList(values, buildOutputContext(opts));
    }),
  );

  const propCmd = scheme.command('property').description('属性方案');
  projectTypeRequired(propCmd);
  propCmd.action((opts: OutputOptions & { project: string }) =>
    runHandler(async () => {
      const { workItemScheme } = buildClient(getConnectionOptions(scheme));
      const { values } = await workItemScheme.properties(opts.project);
      emitList(values, buildOutputContext(opts));
    }),
  );

  const typeCmd = scheme.command('type').description('类型方案');
  projectTypeRequired(typeCmd);
  typeCmd.action((opts: OutputOptions & { project: string }) =>
    runHandler(async () => {
      const { workItemScheme } = buildClient(getConnectionOptions(scheme));
      const { values } = await workItemScheme.types(opts.project);
      emitList(values, buildOutputContext(opts));
    }),
  );

  const transCmd = scheme.command('transition').description('流转方案');
  transCmd
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--type <id>', '工作项类型 ID')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; type: string }) =>
      runHandler(async () => {
        const { workItemScheme } = buildClient(getConnectionOptions(scheme));
        const { values } = await workItemScheme.transitions(opts.project, opts.type);
        emitList(values, buildOutputContext(opts));
      }),
    );
}
