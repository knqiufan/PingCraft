/**
 * `kanban` 命令命名空间（L3）。
 *
 * list/get/create + columns/swimlanes（含栏 CRUD）。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions } from './shared.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';

export function registerKanbanCommands(program: Command): void {
  const kanban = program.command('kanban').description('看板管理');

  kanban
    .command('list')
    .requiredOption('--project <id>', '项目 ID')
    .option('--json', 'JSON 输出')
    .option('--quiet', '仅输出 id')
    .action((opts: OutputOptions & { project: string }) =>
      runHandler(async () => {
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        const { values } = await kanbans.list({ projectId: opts.project });
        emitList(values, buildOutputContext(opts));
      }),
    );

  kanban.command('get').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { kanbans } = buildClient(getConnectionOptions(kanban));
      emitSingle(await kanbans.get(id), buildOutputContext(opts));
    }),
  );

  kanban
    .command('create')
    .requiredOption('--project <id>', '项目 ID')
    .requiredOption('--name <name>', '看板名称')
    .option('--dry-run', '仅打印请求体')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; name: string; dryRun?: boolean }) =>
      runHandler(async () => {
        const body = { project_id: opts.project, name: opts.name };
        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        emitSingle(await kanbans.create(body), buildOutputContext(opts));
      }),
    );

  // 栏
  const column = kanban.command('column').description('看板栏');
  column
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        const { values } = await kanbans.columns(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  column
    .command('create')
    .argument('<id>')
    .requiredOption('--name <name>', '栏名称')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { name: string }) =>
      runHandler(async () => {
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        emitSingle(await kanbans.createColumn(id, { name: opts.name }), buildOutputContext(opts));
      }),
    );
  column
    .command('delete')
    .argument('<kanbanId>')
    .argument('<columnId>')
    .option('--json', 'JSON 输出')
    .action((kanbanId: string, columnId: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        await kanbans.deleteColumn(kanbanId, columnId);
        emitSingle({ id: columnId, deleted: true }, buildOutputContext(opts));
      }),
    );

  // 泳道
  const swimlane = kanban.command('swimlane').description('看板泳道');
  swimlane
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        const { values } = await kanbans.swimlanes(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  swimlane
    .command('create')
    .argument('<id>')
    .requiredOption('--name <name>', '泳道名称')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { name: string }) =>
      runHandler(async () => {
        const { kanbans } = buildClient(getConnectionOptions(kanban));
        emitSingle(await kanbans.createSwimlane(id, { name: opts.name }), buildOutputContext(opts));
      }),
    );
}
