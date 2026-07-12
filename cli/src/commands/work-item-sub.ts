/**
 * 工作项子资源命令（L3）—— 注册到既有 `work-item` 命令下。
 *
 * comment / attachment / watcher / link / history / tags / deliverables / transition。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, fileToFormData, type OutputOptions, type ClientBundle } from './shared.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';
import { readItems } from '../core/input.js';

export function registerWorkItemSubResources(program: Command): void {
  // 顶层：关联类型
  program
    .command('work-item-link-type')
    .description('工作项关联类型')
    .command('list')
    .description('列出关联类型')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { workItemScheme } = buildClient(getConnectionOptions(program));
        const { values } = await workItemScheme.linkTypes();
        emitList(values, buildOutputContext(opts));
      }),
    );

  // 挂到既有 work-item 命令上的子资源
  const workItem = program.commands.find((c) => c.name() === 'work-item');
  if (!workItem) return; // work-item 命令应已注册

  const bundle = (): ClientBundle => buildClient(getConnectionOptions(workItem));

  // ---- 评论 ----
  const comment = workItem.command('comment').description('工作项评论');
  comment
    .command('list')
    .argument('<id>')
    .description('评论列表')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.comments.list(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  comment
    .command('add')
    .argument('<id>')
    .requiredOption('--content <text>', '评论内容')
    .description('添加评论')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { content: string }) =>
      runHandler(async () => {
        const created = await bundle().workItemSubResources.comments.add(id, opts.content);
        emitSingle(created, buildOutputContext(opts));
      }),
    );
  comment
    .command('remove')
    .argument('<id>')
    .argument('<commentId>')
    .description('删除评论')
    .option('--json', 'JSON 输出')
    .action((id: string, commentId: string, opts: OutputOptions) =>
      runHandler(async () => {
        await bundle().workItemSubResources.comments.remove(id, commentId);
        emitSingle({ id: commentId, deleted: true }, buildOutputContext(opts));
      }),
    );

  // ---- 附件 ----
  const attachment = workItem.command('attachment').description('工作项附件');
  attachment
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.attachments.list(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  attachment
    .command('upload')
    .argument('<id>')
    .requiredOption('--file <path>', '文件路径')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { file: string }) =>
      runHandler(async () => {
        const form = fileToFormData(opts.file);
        const created = await bundle().workItemSubResources.attachments.upload(id, form);
        emitSingle(created, buildOutputContext(opts));
      }),
    );

  // ---- 关注人 ----
  const watcher = workItem.command('watcher').description('工作项关注人');
  watcher
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.watchers.list(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  watcher
    .command('add')
    .argument('<id>')
    .requiredOption('--user-id <id>', '用户 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { userId: string }) =>
      runHandler(async () => {
        const created = await bundle().workItemSubResources.watchers.add(id, opts.userId);
        emitSingle(created, buildOutputContext(opts));
      }),
    );
  watcher
    .command('remove')
    .argument('<id>')
    .requiredOption('--user-id <id>', '用户 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { userId: string }) =>
      runHandler(async () => {
        await bundle().workItemSubResources.watchers.remove(id, opts.userId);
        emitSingle({ userId: opts.userId, removed: true }, buildOutputContext(opts));
      }),
    );

  // ---- 关联 ----
  const link = workItem.command('link').description('工作项关联');
  link
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.links.list(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  link
    .command('create')
    .argument('<id>')
    .requiredOption('--target <id>', '目标工作项 ID')
    .requiredOption('--type <id>', '关联类型 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { target: string; type: string }) =>
      runHandler(async () => {
        const created = await bundle().workItemSubResources.links.create(id, { target_id: opts.target, link_type_id: opts.type });
        emitSingle(created, buildOutputContext(opts));
      }),
    );

  // ---- 历史 / 标签 / 交付 / 流转 ----
  workItem
    .command('history')
    .argument('<id>')
    .description('流转/活动记录')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.history(id);
        emitList(values, buildOutputContext(opts));
      }),
    );

  const tag = workItem.command('tag').description('工作项标签');
  tag
    .command('list')
    .argument('<id>')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.tags.list(id);
        emitList(values, buildOutputContext(opts));
      }),
    );
  tag
    .command('add')
    .argument('<id>')
    .requiredOption('--tag <name>', '标签名')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { tag: string }) =>
      runHandler(async () => {
        const created = await bundle().workItemSubResources.tags.add(id, opts.tag);
        emitSingle(created, buildOutputContext(opts));
      }),
    );

  workItem
    .command('deliverables')
    .argument('<id>')
    .description('交付目标')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { values } = await bundle().workItemSubResources.deliverables(id);
        emitList(values, buildOutputContext(opts));
      }),
    );

  workItem
    .command('transition')
    .argument('<id>')
    .requiredOption('--state <id>', '目标状态 ID')
    .description('变更工作项状态（流转）')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { state: string }) =>
      runHandler(async () => {
        const updated = await bundle().workItemSubResources.transition(id, opts.state);
        emitSingle(updated, buildOutputContext(opts));
      }),
    );

  // ---- 批量更新 / 移动 ----
  workItem
    .command('batch-update')
    .description('批量更新工作项（每条 {id, ...fields}，并发执行，部分失败聚合）')
    .option('--file <path>', '从 JSON 文件读取批量数据')
    .option('--stdin', '从 stdin 读取 JSON')
    .option('--concurrency <n>', '并发数', '3')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { file?: string; stdin?: boolean; concurrency: string }) =>
      runHandler(async () => {
        const items = await readItems<{ id: string } & Record<string, unknown>>(opts);
        const { workItems } = bundle();
        const result = await workItems.batchUpdate(items as never, {
          concurrency: Number(opts.concurrency) || 3,
          onProgress: (current, total, status) => logProgress(`[${current}/${total}] ${status}`),
        });
        logProgress(`完成：成功 ${result.success}，失败 ${result.failed}`);
        emitSingle(result, buildOutputContext(opts));
      }),
    );

  workItem
    .command('move')
    .description('移动工作项（等价于更新 parent_id/sprint_id/project_id，可用 work-item update 替代）')
    .argument('<id>')
    .option('--parent <id>', '父工作项 ID')
    .option('--sprint <id>', '目标迭代 ID')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { parent?: string; sprint?: string }) =>
      runHandler(async () => {
        const body: Record<string, unknown> = {};
        if (opts.parent !== undefined) body.parent_id = opts.parent;
        if (opts.sprint !== undefined) body.sprint_id = opts.sprint;
        const { workItems } = bundle();
        const updated = await workItems.update(id, body as never);
        emitSingle(updated, buildOutputContext(opts));
      }),
    );
}
