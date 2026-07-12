/**
 * 全局通用资源命令（L3）—— 集中注册 comment/attachment/watcher/association/
 * activity/worklog/worklog-type/review/log 顶层命令。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, fileToFormData, type OutputOptions } from './shared.js';
import { emitList, emitSingle } from '../core/output.js';

function principalOpts(cmd: Command): Command {
  return cmd.requiredOption('--principal-type <t>', '主体类型').requiredOption('--principal-id <id>', '主体 ID');
}

export function registerCommonCommands(program: Command): void {
  // ---- 评论 ----
  const comment = program.command('comment').description('通用评论');
  const commentList = comment.command('list');
  principalOpts(commentList).option('--json', 'JSON 输出');
  commentList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(comment));
      const { values } = await commonResources.comments.list({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );
  const commentCreate = comment.command('create').requiredOption('--content <text>');
  principalOpts(commentCreate).option('--json', 'JSON 输出');
  commentCreate.action((opts: OutputOptions & { principalType: string; principalId: string; content: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(comment));
      emitSingle(await commonResources.comments.create({ principal_type: opts.principalType, principal_id: opts.principalId, content: opts.content }), buildOutputContext(opts));
    }),
  );
  comment.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(comment));
      await commonResources.comments.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );

  // ---- 附件 ----
  const attachment = program.command('attachment').description('通用附件');
  const attachmentList = attachment.command('list');
  principalOpts(attachmentList).option('--json', 'JSON 输出');
  attachmentList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(attachment));
      const { values } = await commonResources.attachments.list({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );
  attachment
    .command('upload')
    .requiredOption('--file <path>', '文件路径')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { file: string }) =>
      runHandler(async () => {
        const { commonResources } = buildClient(getConnectionOptions(attachment));
        emitSingle(await commonResources.attachments.upload(fileToFormData(opts.file)), buildOutputContext(opts));
      }),
    );
  attachment
    .command('snippet')
    .requiredOption('--name <name>')
    .requiredOption('--language <lang>')
    .requiredOption('--content <text>')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { name: string; language: string; content: string }) =>
      runHandler(async () => {
        const { commonResources } = buildClient(getConnectionOptions(attachment));
        emitSingle(await commonResources.attachments.snippet({ name: opts.name, language: opts.language, content: opts.content }), buildOutputContext(opts));
      }),
    );

  // ---- 关注人 ----
  const watcher = program.command('watcher').description('通用关注人');
  const watcherList = watcher.command('list');
  principalOpts(watcherList).option('--json', 'JSON 输出');
  watcherList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(watcher));
      const { values } = await commonResources.watchers.list({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );
  const watcherAdd = watcher.command('add').requiredOption('--user-id <id>');
  principalOpts(watcherAdd).option('--json', 'JSON 输出');
  watcherAdd.action((opts: OutputOptions & { principalType: string; principalId: string; userId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(watcher));
      emitSingle(await commonResources.watchers.add({ principal_type: opts.principalType, principal_id: opts.principalId, user_id: opts.userId }), buildOutputContext(opts));
    }),
  );

  // ---- 关联 ----
  const association = program.command('association').description('通用关联');
  const assocList = association.command('list');
  principalOpts(assocList).option('--json', 'JSON 输出');
  assocList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(association));
      const { values } = await commonResources.associations.list({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );
  association
    .command('create')
    .requiredOption('--target-type <t>', '目标主体类型')
    .requiredOption('--target-id <id>', '目标主体 ID')
    .option('--link-type <id>', '关联类型 ID')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { targetType: string; targetId: string; linkType?: string }) =>
      runHandler(async () => {
        const body: Record<string, unknown> = { target_type: opts.targetType, target_id: opts.targetId };
        if (opts.linkType !== undefined) body.link_type_id = opts.linkType;
        const { commonResources } = buildClient(getConnectionOptions(association));
        emitSingle(await commonResources.associations.create(body), buildOutputContext(opts));
      }),
    );
  association.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(association));
      await commonResources.associations.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );

  // ---- 活动记录 ----
  const activity = program.command('activity').description('活动记录');
  const activityList = activity.command('list');
  principalOpts(activityList).option('--json', 'JSON 输出');
  activityList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(activity));
      const { values } = await commonResources.activities({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );

  // ---- 工时 ----
  const worklog = program.command('worklog').description('工时');
  const worklogList = worklog.command('list');
  principalOpts(worklogList).option('--json', 'JSON 输出');
  worklogList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(worklog));
      const { values } = await commonResources.worklogs.list({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );
  worklog
    .command('create')
    .requiredOption('--workload <n>', '工时')
    .option('--description <text>', '描述')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { workload: string; description?: string }) =>
      runHandler(async () => {
        const body: Record<string, unknown> = { workload: Number(opts.workload) };
        if (opts.description !== undefined) body.description = opts.description;
        const { commonResources } = buildClient(getConnectionOptions(worklog));
        emitSingle(await commonResources.worklogs.create(body), buildOutputContext(opts));
      }),
    );
  worklog.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(worklog));
      await commonResources.worklogs.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );

  program
    .command('worklog-type')
    .description('工时类型')
    .command('list')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { commonResources } = buildClient(getConnectionOptions(program));
        const { values } = await commonResources.worklogTypes();
        emitList(values, buildOutputContext(opts));
      }),
    );

  // ---- 评审 ----
  const review = program.command('review').description('评审');
  const reviewList = review.command('list');
  principalOpts(reviewList).option('--json', 'JSON 输出');
  reviewList.action((opts: OutputOptions & { principalType: string; principalId: string }) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(review));
      const { values } = await commonResources.reviews.list({ principal_type: opts.principalType, principal_id: opts.principalId });
      emitList(values, buildOutputContext(opts));
    }),
  );
  const reviewCreate = review.command('create');
  principalOpts(reviewCreate).option('--name <name>', '评审名称').option('--json', 'JSON 输出');
  reviewCreate.action((opts: OutputOptions & { principalType: string; principalId: string; name?: string }) =>
    runHandler(async () => {
      const body: Record<string, unknown> = { principal_type: opts.principalType, principal_id: opts.principalId };
      if (opts.name !== undefined) body.name = opts.name;
      const { commonResources } = buildClient(getConnectionOptions(review));
      emitSingle(await commonResources.reviews.create(body), buildOutputContext(opts));
    }),
  );
  review.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { commonResources } = buildClient(getConnectionOptions(review));
      await commonResources.reviews.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );

  // ---- 日志 ----
  const log = program.command('log').description('安全日志');
  log
    .command('login')
    .option('--page <n>', '页码')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { page?: string }) =>
      runHandler(async () => {
        const { logs: logsMod } = buildClient(getConnectionOptions(log));
        const { values } = await logsMod.login({ pageIndex: Number(opts.page || 0) });
        emitList(values, buildOutputContext(opts));
      }),
    );
  log
    .command('audit')
    .option('--page <n>', '页码')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { page?: string }) =>
      runHandler(async () => {
        const { logs: logsMod } = buildClient(getConnectionOptions(log));
        const { values } = await logsMod.audit({ pageIndex: Number(opts.page || 0) });
        emitList(values, buildOutputContext(opts));
      }),
    );
}
