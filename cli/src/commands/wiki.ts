/**
 * `wiki` 命令命名空间（L3）。
 *
 * space list/get/create/update/delete/members + page list/get/create/update/delete +
 * page body get/update + page versions/restore。
 */
import type { Command } from 'commander';
import { buildClient, buildOutputContext, getConnectionOptions, runHandler, type OutputOptions, type ListOptions } from './shared.js';
import { emitList, emitSingle, logProgress } from '../core/output.js';

export function registerWikiCommands(program: Command): void {
  const wiki = program.command('wiki').description('Wiki 知识库');

  // ---- 空间 ----
  const space = wiki.command('space').description('Wiki 空间');
  space
    .command('list')
    .option('--page <n>', '页码')
    .option('--page-size <n>', '每页条数')
    .option('--json', 'JSON 输出')
    .option('--quiet', '仅输出 id')
    .action((opts: ListOptions & OutputOptions) =>
      runHandler(async () => {
        const { wiki: wikiMod } = buildClient(getConnectionOptions(space));
        const { values } = await wikiMod.spaces.list({ pageIndex: Number(opts.page || 0), pageSize: Number(opts.pageSize || 30) });
        emitList(values, buildOutputContext(opts));
      }),
    );
  space.command('get').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { wiki: wikiMod } = buildClient(getConnectionOptions(space));
      emitSingle(await wikiMod.spaces.get(id), buildOutputContext(opts));
    }),
  );
  space
    .command('create')
    .requiredOption('--name <name>', '空间名称')
    .option('--description <text>', '描述')
    .option('--dry-run', '仅打印请求体')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { name: string; description?: string; dryRun?: boolean }) =>
      runHandler(async () => {
        const body = { name: opts.name, ...(opts.description ? { description: opts.description } : {}) };
        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { wiki: wikiMod } = buildClient(getConnectionOptions(space));
        emitSingle(await wikiMod.spaces.create(body), buildOutputContext(opts));
      }),
    );
  space.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { wiki: wikiMod } = buildClient(getConnectionOptions(space));
      await wikiMod.spaces.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );
  space.command('members').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { wiki: wikiMod } = buildClient(getConnectionOptions(space));
      const { values } = await wikiMod.spaces.members(id);
      emitList(values, buildOutputContext(opts));
    }),
  );

  // ---- 页面 ----
  const page = wiki.command('page').description('Wiki 页面');
  page
    .command('list')
    .requiredOption('--space <id>', '空间 ID')
    .option('--page <n>', '页码')
    .option('--page-size <n>', '每页条数')
    .option('--json', 'JSON 输出')
    .option('--quiet', '仅输出 id')
    .action((opts: ListOptions & OutputOptions & { space: string }) =>
      runHandler(async () => {
        const { wiki: wikiMod } = buildClient(getConnectionOptions(page));
        const { values } = await wikiMod.pages.list({ spaceId: opts.space, pageIndex: Number(opts.page || 0), pageSize: Number(opts.pageSize || 30) });
        emitList(values, buildOutputContext(opts));
      }),
    );
  page.command('get').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { wiki: wikiMod } = buildClient(getConnectionOptions(page));
      emitSingle(await wikiMod.pages.get(id), buildOutputContext(opts));
    }),
  );
  page
    .command('create')
    .requiredOption('--space <id>', '空间 ID')
    .requiredOption('--title <title>', '页面标题')
    .option('--parent <id>', '父页面 ID')
    .option('--dry-run', '仅打印请求体')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { space: string; title: string; parent?: string; dryRun?: boolean }) =>
      runHandler(async () => {
        const body = { space_id: opts.space, title: opts.title, ...(opts.parent ? { parent_id: opts.parent } : {}) };
        if (opts.dryRun) {
          logProgress('（--dry-run）未发送请求');
          emitSingle(body, buildOutputContext(opts));
          return;
        }
        const { wiki: wikiMod } = buildClient(getConnectionOptions(page));
        emitSingle(await wikiMod.pages.create(body), buildOutputContext(opts));
      }),
    );
  page.command('delete').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { wiki: wikiMod } = buildClient(getConnectionOptions(page));
      await wikiMod.pages.remove(id);
      emitSingle({ id, deleted: true }, buildOutputContext(opts));
    }),
  );

  // 正文
  const body = page.command('body').description('页面正文');
  body
    .command('get')
    .argument('<id>')
    .description('获取页面正文（输出到 stdout）')
    .action((id: string) =>
      runHandler(async () => {
        const { wiki: wikiMod } = buildClient(getConnectionOptions(body));
        const content = await wikiMod.pages.body.get(id);
        process.stdout.write(`${content}\n`);
      }),
    );
  body
    .command('update')
    .argument('<id>')
    .requiredOption('--content <text>', '正文内容')
    .option('--json', 'JSON 输出')
    .action((id: string, opts: OutputOptions & { content: string }) =>
      runHandler(async () => {
        const { wiki: wikiMod } = buildClient(getConnectionOptions(body));
        emitSingle(await wikiMod.pages.body.update(id, opts.content), buildOutputContext(opts));
      }),
    );

  // 版本
  page.command('versions').argument('<id>').option('--json', 'JSON 输出').action((id: string, opts: OutputOptions) =>
    runHandler(async () => {
      const { wiki: wikiMod } = buildClient(getConnectionOptions(page));
      const { values } = await wikiMod.pages.versions(id);
      emitList(values, buildOutputContext(opts));
    }),
  );
  page
    .command('restore')
    .argument('<id>')
    .argument('<versionId>')
    .option('--json', 'JSON 输出')
    .action((id: string, versionId: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { wiki: wikiMod } = buildClient(getConnectionOptions(page));
        emitSingle(await wikiMod.pages.restore(id, versionId), buildOutputContext(opts));
      }),
    );
}
