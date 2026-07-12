/**
 * 工单 Ticket + 需求 Requirement 命令（L3）。
 *
 * 复用 registerResource 注册 CRUD，再追加 transition + 元数据查询。
 */
import type { Command } from 'commander';
import { buildClient, getConnectionOptions, runHandler, buildOutputContext, type OutputOptions } from './shared.js';
import { registerResource, registerListOnly } from './_resource.js';
import { emitList, emitSingle } from '../core/output.js';

function registerTransition(parent: Command, label: string, fn: (id: string, stateId: string) => Promise<unknown>): void {
  parent
    .command('transition')
    .argument('<id>')
    .requiredOption('--state <id>', '目标状态 ID')
    .description(`变更${label}状态（流转）`)
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { state: string }) =>
      runHandler(async () => {
        emitSingle(await fn(id, opts.state), buildOutputContext(opts));
      }),
    );
}

export function registerTicketCommands(program: Command): void {
  const ticket = registerResource(program, 'ticket', '工单', () => buildClient(getConnectionOptions(program)).tickets as never, {
    createFields: [['--title <title>', '工单标题']],
  });
  registerTransition(ticket, '工单', (id, s) => buildClient(getConnectionOptions(program)).tickets.transition(id, s));
  const tBundle = () => buildClient(getConnectionOptions(program)).tickets;
  registerListOnly(ticket, 'type', '工单类型', async () => ({ values: (await tBundle().types()).values }));
  registerListOnly(ticket, 'state', '工单状态', async () => ({ values: (await tBundle().states()).values }));
  registerListOnly(ticket, 'property', '工单属性', async () => ({ values: (await tBundle().properties()).values }));
  registerListOnly(ticket, 'channel', '工单渠道', async () => ({ values: (await tBundle().channels()).values }));
  registerListOnly(ticket, 'priority', '工单优先级', async () => ({ values: (await tBundle().priorities()).values }));
  registerListOnly(ticket, 'solution', '工单解决方案', async () => ({ values: (await tBundle().solutions()).values }));
  registerListOnly(ticket, 'tag', '工单标签', async () => ({ values: (await tBundle().tags()).values }));

  // ---- requirement ----
  const requirement = registerResource(program, 'requirement', '需求', () => buildClient(getConnectionOptions(program)).requirements as never, {
    createFields: [['--title <title>', '需求标题']],
  });
  registerTransition(requirement, '需求', (id, s) => buildClient(getConnectionOptions(program)).requirements.transition(id, s));
  const rBundle = () => buildClient(getConnectionOptions(program)).requirements;
  registerListOnly(requirement, 'state', '需求状态', async () => ({ values: (await rBundle().states()).values }));
  registerListOnly(requirement, 'property', '需求属性', async () => ({ values: (await rBundle().properties()).values }));
  registerListOnly(requirement, 'module', '需求模块', async () => ({ values: (await rBundle().modules()).values }));
  registerListOnly(requirement, 'schedule', '需求排期', async () => ({ values: (await rBundle().schedules()).values }));
  registerListOnly(requirement, 'priority', '需求优先级', async () => ({ values: (await rBundle().priorities()).values }));
  void emitList;
}
