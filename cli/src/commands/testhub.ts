/**
 * 测试管理 Testhub 命令（L3）—— test-library/case/plan/execution/config。
 */
import type { Command } from 'commander';
import { buildClient, getConnectionOptions, runHandler, buildOutputContext, type OutputOptions } from './shared.js';
import { registerResource, registerListOnly } from './_resource.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';
import { readItems } from '../core/input.js';

export function registerTesthubCommands(program: Command): void {
  const bundle = () => buildClient(getConnectionOptions(program));

  // ---- test-library ----
  const library = registerResource(program, 'test-library', '测试库', () => bundle().testLibrary as never, {
    createFields: [['--name <name>', '测试库名称']],
  });
  registerListOnly(library, 'member', '成员', async () => ({ values: [] }));
  registerListOnly(library, 'module', '用例模块', async () => ({ values: [] }));

  // ---- test-case ----
  const testCase = registerResource(program, 'test-case', '测试用例', () => bundle().testCases as never, {
    createFields: [['--name <name>', '用例名称']],
    listParams: [['--library <id>', '测试库 ID']],
  });
  registerListOnly(testCase, 'type', '用例类型', async () => ({ values: (await bundle().testCases.types()).values }));
  registerListOnly(testCase, 'state', '用例状态', async () => ({ values: (await bundle().testCases.states()).values }));
  registerListOnly(testCase, 'property', '用例属性', async () => ({ values: (await bundle().testCases.properties()).values }));
  // batch-create + link/unlink
  testCase
    .command('batch-create')
    .option('--file <path>', '用例 JSON 数组')
    .option('--stdin', '从 stdin 读取 JSON')
    .option('--concurrency <n>', '并发数', '3')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { file: string; concurrency: string }) =>
      runHandler(async () => {
        const items = await readItems<Record<string, unknown>>(opts);
        const result = await bundle().testCases.batchCreate(items, {
          concurrency: Number(opts.concurrency) || 3,
          onProgress: (c, t, s) => logProgress(`[${c}/${t}] ${s}`),
        });
        logProgress(`完成：成功 ${result.success}，失败 ${result.failed}`);
        emitSingle(result, buildOutputContext(opts));
      }),
    );
  testCase
    .command('link-work-item')
    .argument('<id>')
    .requiredOption('--work-item <id>', '工作项 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { workItem: string }) =>
      runHandler(async () => {
        emitSingle(await bundle().testCases.linkWorkItem(id, opts.workItem), buildOutputContext(opts));
      }),
    );
  testCase
    .command('unlink-work-item')
    .argument('<id>')
    .requiredOption('--work-item <id>', '工作项 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { workItem: string }) =>
      runHandler(async () => {
        await bundle().testCases.unlinkWorkItem(id, opts.workItem);
        emitSingle({ workItem: opts.workItem, unlinked: true }, buildOutputContext(opts));
      }),
    );

  // ---- test-plan ----
  const plan = registerResource(program, 'test-plan', '测试计划', () => bundle().testPlans as never, {
    createFields: [['--name <name>', '计划名称']],
  });
  registerListOnly(plan, 'type', '计划类型', async () => ({ values: (await bundle().testPlans.types()).values }));

  // ---- test-execution ----
  const execution = program.command('test-execution').description('测试执行');
  execution
    .command('create')
    .requiredOption('--plan <id>', '计划 ID')
    .option('--case <id>', '用例 ID')
    .option('--extra <json>', '额外字段（JSON）')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { plan: string; case?: string; extra?: string }) =>
      runHandler(async () => {
        const body: Record<string, unknown> = { plan_id: opts.plan };
        if (opts.case) body.case_id = opts.case;
        if (opts.extra) Object.assign(body, JSON.parse(opts.extra));
        emitSingle(await bundle().testExecutions.create(body), buildOutputContext(opts));
      }),
    );
  execution
    .command('batch-create')
    .option('--file <path>', '执行 JSON 数组')
    .option('--stdin', '从 stdin 读取 JSON')
    .option('--concurrency <n>', '并发数', '3')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { file: string; concurrency: string }) =>
      runHandler(async () => {
        const items = await readItems<Record<string, unknown>>(opts);
        const result = await bundle().testExecutions.batchCreate(items, {
          concurrency: Number(opts.concurrency) || 3,
          onProgress: (c, t, s) => logProgress(`[${c}/${t}] ${s}`),
        });
        logProgress(`完成：成功 ${result.success}，失败 ${result.failed}`);
        emitSingle(result, buildOutputContext(opts));
      }),
    );
  execution
    .command('list')
    .option('--plan <id>', '计划 ID')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { plan?: string }) =>
      runHandler(async () => {
        const { values } = await bundle().testExecutions.list(opts.plan ? { plan_id: opts.plan } : {});
        emitList(values, buildOutputContext(opts));
      }),
    );
  execution
    .command('result')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        emitSingle(await bundle().testExecutions.result(id), buildOutputContext(opts));
      }),
    );

  // ---- test-config ----
  const config = program.command('test-config').description('测试配置中心（只读）');
  const cfgBundle = () => bundle().testConfig;
  const reg = (name: string, desc: string, fn: () => Promise<{ values: unknown[] }>) => {
    config
      .command(name)
      .description(desc)
      .option('--json', 'JSON 输出')
      .action((opts: OutputOptions) =>
        runHandler(async () => {
          const { values } = await fn();
          emitList(values, buildOutputContext(opts));
        }),
      );
  };
  reg('case-state', '用例状态', async () => cfgBundle().caseStates());
  reg('case-type', '用例类型', async () => cfgBundle().caseTypes());
  reg('severity', '重要程度', async () => cfgBundle().severities());
  reg('case-property', '用例属性', async () => cfgBundle().caseProperties());
  reg('plan-state', '计划状态', async () => cfgBundle().planStates());
}
