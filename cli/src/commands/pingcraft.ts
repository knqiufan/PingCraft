/**
 * `pingcraft` 命名空间（L3）—— PingCraft 本地后端业务。
 *
 * auth login / analyze / match-project / check-duplicates / import / import-stream /
 * run（一键编排）+ records/stats/metadata/model/user 查询。
 */
import type { Command } from 'commander';
import fs from 'node:fs';
import {
  buildPingcraft,
  buildOutputContext,
  getConnectionOptions,
  runHandler,
  savePingcraftToken,
  fileToFormData,
  type OutputOptions,
  type ConnectionOptions,
} from './shared.js';
import { emitSingle, emitList, logProgress } from '../core/output.js';
import { runOrchestrator } from '../sdk/pingcraft/index.js';
import { CliError, ExitCode, ErrorCode } from '../core/errors.js';

interface AuthLoginOptions extends OutputOptions, ConnectionOptions {
  username: string;
  password: string;
  apiUrl?: string;
}

export function registerPingcraftCommands(program: Command): void {
  const pingcraft = program.command('pingcraft').description('PingCraft 业务（本地后端）');

  // ---- auth login ----
  pingcraft
    .command('auth')
    .description('PingCraft 账号')
    .command('login')
    .requiredOption('--username <name>', '用户名')
    .requiredOption('--password <pw>', '密码')
    .option('--api-url <url>', 'PingCraft 后端地址')
    .option('--json', 'JSON 输出')
    .action((opts: AuthLoginOptions) =>
      runHandler(async () => {
        const { profile, api } = buildPingcraft({ ...getConnectionOptions(pingcraft), pingcraftApiUrl: opts.apiUrl });
        const res = await api.login(opts.username, opts.password);
        if (!res.success || !res.token) {
          throw new CliError({ message: res.error ?? '登录失败', code: ErrorCode.UNAUTHORIZED, exitCode: ExitCode.UNAUTHORIZED });
        }
        savePingcraftToken(profile.name, res.token);
        emitSingle({ profile: profile.name, user: res.user }, buildOutputContext(opts));
      }),
    );

  // ---- analyze ----
  pingcraft
    .command('analyze')
    .description('解析需求文档（DOCX/MD/TXT）为结构化需求项')
    .requiredOption('--file <path>', '文档路径')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { file: string }) =>
      runHandler(async () => {
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        const result = await api.analyze(fileToFormData(opts.file));
        emitSingle(result, buildOutputContext(opts));
      }),
    );

  // ---- match-project ----
  pingcraft
    .command('match-project')
    .description('为需求项推荐 PingCode 项目')
    .requiredOption('--file <path>', '需求项 JSON 文件（analyze 的输出）')
    .option('--project-name <name>', '候选项目名')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { file: string; projectName?: string }) =>
      runHandler(async () => {
        const items = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        const result = await api.matchProject({ requirements: items, ...(opts.projectName ? { projectName: opts.projectName } : {}) });
        emitSingle(result, buildOutputContext(opts));
      }),
    );

  // ---- check-duplicates ----
  pingcraft
    .command('check-duplicates')
    .description('查重（对照 SeekDB 向量库）')
    .requiredOption('--project <id>', 'PingCode 项目 ID')
    .requiredOption('--file <path>', '需求项 JSON')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; file: string }) =>
      runHandler(async () => {
        const items = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        emitSingle(await api.checkDuplicates({ projectId: opts.project, items }), buildOutputContext(opts));
      }),
    );

  // ---- import / import-stream ----
  pingcraft
    .command('import-stream')
    .description('流式导入需求项到 PingCode（SSE 进度走 stderr）')
    .requiredOption('--project <id>', 'PingCode 项目 ID')
    .requiredOption('--file <path>', '需求项 JSON')
    .option('--record <id>', '关联导入记录 ID')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions & { project: string; file: string; record?: string }) =>
      runHandler(async () => {
        const items = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        const result = await api.importStream(
          { items, projectId: opts.project, autoCreateProject: true, ...(opts.record ? { record_id: opts.record } : {}) },
          {
            onProgress: (d) => logProgress(`进度：${JSON.stringify(d)}`),
            onProjectCreated: (d) => logProgress(`已创建项目：${d.name}`),
            onError: (d) => logProgress(`错误：${d.message}`),
          },
        );
        emitSingle(result, buildOutputContext(opts));
      }),
    );

  // ---- run 一键编排 ----
  pingcraft
    .command('run')
    .description('一键编排：解析 → 匹配 → 查重 → 导入')
    .argument('<file>', '需求文档路径')
    .option('--project <id>', '指定项目（跳过 match-project）')
    .option('--auto-import', '自动导入（默认仅查重）')
    .option('--force', '覆盖重复项')
    .option('--api-url <url>', 'PingCraft 后端地址')
    .option('--json', 'JSON 输出')
    .action((file: string, opts: OutputOptions & ConnectionOptions & { project?: string; autoImport?: boolean; force?: boolean; apiUrl?: string }) =>
      runHandler(async () => {
        const { api } = buildPingcraft({ ...getConnectionOptions(pingcraft), pingcraftApiUrl: opts.apiUrl });
        const result = await runOrchestrator({
          api,
          formData: fileToFormData(file),
          projectId: opts.project,
          autoImport: opts.autoImport,
          force: opts.force,
          log: (msg) => logProgress(msg),
        });
        emitSingle(result, buildOutputContext(opts));
      }),
    );

  // ---- 查询类 ----
  pingcraft
    .command('record')
    .description('导入记录')
    .command('list')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        emitList((await api.listRecords() as { values?: unknown[] } | unknown[]) as never, buildOutputContext(opts));
      }),
    );

  pingcraft
    .command('stats')
    .description('项目统计')
    .argument('<projectId>')
    .option('--json', 'JSON 输出')
    .action((projectId: string, opts: OutputOptions) =>
      runHandler(async () => {
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        emitSingle(await api.stats(projectId), buildOutputContext(opts));
      }),
    );

  pingcraft
    .command('metadata')
    .description('元数据概览')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        emitSingle(await api.metadataOverview(), buildOutputContext(opts));
      }),
    );

  pingcraft
    .command('model')
    .description('AI 模型配置')
    .command('list')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        emitList((await api.listModels() as { values?: unknown[] } | unknown[]) as never, buildOutputContext(opts));
      }),
    );

  pingcraft
    .command('user')
    .description('用户信息')
    .command('info')
    .option('--json', 'JSON 输出')
    .action((opts: OutputOptions) =>
      runHandler(async () => {
        const { api } = buildPingcraft(getConnectionOptions(pingcraft));
        emitSingle(await api.userInfo(), buildOutputContext(opts));
      }),
    );
}
