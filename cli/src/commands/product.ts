/**
 * 产品管理 Product + 客户 Customer + 外部用户 命令（L3）。
 */
import type { Command } from 'commander';
import { buildClient, getConnectionOptions, runHandler, buildOutputContext, type OutputOptions } from './shared.js';
import { registerResource, registerListOnly } from './_resource.js';
import { emitList, emitSingle } from '../core/output.js';

export function registerProductCommands(program: Command): void {
  // ---- product ----
  const product = registerResource(program, 'product', '产品', () => buildClient(getConnectionOptions(program)).products as never, {
    createFields: [['--name <name>', '产品名称']],
  });
  const pBundle = () => buildClient(getConnectionOptions(program)).products;
  registerListOnly(product, 'ticket-channel', '工单渠道', async () => ({ values: await pBundle().ticketChannels() }));
  registerListOnly(product, 'ticket-type', '工单类型', async () => ({ values: await pBundle().ticketTypes() }));
  registerListOnly(product, 'tag', '产品标签', async () => ({ values: await pBundle().tags() }));
  product
    .command('member')
    .description('产品成员')
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        emitList(await pBundle().members(id), { json: opts.json });
      }),
    );
  product
    .command('module')
    .description('产品需求模块')
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        emitList(await pBundle().modules(id), { json: opts.json });
      }),
    );

  // ---- customer ----
  registerResource(program, 'customer', '客户', () => buildClient(getConnectionOptions(program)).customers as never, {
    createFields: [['--name <name>', '客户名称']],
  });

  // ---- external-user ----
  const ext = program.command('external-user').description('外部用户');
  ext
    .command('list')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await buildClient(getConnectionOptions(program)).customers.externalUser.list();
        emitList(values, { json: opts.json });
      }),
    );
  ext
    .command('create')
    .requiredOption('--name <name>', '名称')
    .option('--extra <json>', '额外字段（JSON）')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { name: string; extra?: string }) =>
      runHandler(async () => {
        const body: Record<string, unknown> = { name: opts.name };
        if (opts.extra) Object.assign(body, JSON.parse(opts.extra));
        emitSingle(await buildClient(getConnectionOptions(program)).customers.externalUser.create(body), buildOutputContext(opts));
      }),
    );
}
