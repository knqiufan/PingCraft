/**
 * 命令层公共设施（L3）。
 *
 * 职责：
 *  - 全局/连接选项读取（--profile/--host 经 optsWithGlobals）
 *  - 输出上下文构建（--json/--fields/--quiet）
 *  - `buildClient`：config → auth → sdk client 全链路装配（含令牌缓存与刷新回写）
 *  - `runHandler`：统一错误归一化 + stderr 机器可读输出 + 退出码
 */
import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, readConfigFile, writeConfigFile, type ResolvedProfile } from '../core/config.js';
import { loadCredentials, saveCredentials } from '../core/auth.js';
import { CliError, ExitCode, ErrorCode, emitError, toCliError } from '../core/errors.js';
import type { OutputContext } from '../core/output.js';
import {
  createClient,
  createPingcraftClient,
  createPingcraftApi,
  createAuthModule,
  createProjectsModule,
  createWorkItemsModule,
  createWorkItemMetaModule,
  createWorkItemSubResourcesModule,
  createWorkItemSchemeModule,
  createSprintsModule,
  createReleasesModule,
  createKanbansModule,
  createWaterfallModule,
  createDirectoryModule,
  createCommonResourcesModule,
  createLogsModule,
  createWikiModule,
  type PingCodeClient,
  type AuthModule,
  type ProjectsModule,
  type WorkItemsModule,
  type WorkItemMetaModule,
  type WorkItemSubResourcesModule,
  type WorkItemSchemeModule,
  type SprintsModule,
  type ReleasesModule,
  type KanbansModule,
  type WaterfallModule,
  type DirectoryModule,
  type CommonResourcesModule,
  type LogsModule,
  type WikiModule,
  type TokenResponse,
} from '../sdk/index.js';

/** 连接相关选项（--profile/--host 为全局；--client-id/--client-secret/--redirect-uri 由 auth 命令传入） */
export interface ConnectionOptions {
  profile?: string;
  host?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  pingcraftApiUrl?: string;
}

/** 输出选项（定义在具体命令上） */
export interface OutputOptions {
  json?: boolean;
  fields?: string;
  quiet?: boolean;
}

/** 列表分页选项 */
export interface ListOptions {
  page?: string;
  pageSize?: string;
  all?: boolean;
}

/** 读取连接选项（--profile/--host），来自 program 根的全局选项 */
export function getConnectionOptions(cmd: Command): ConnectionOptions {
  const g = cmd.optsWithGlobals() as ConnectionOptions;
  return { profile: g.profile, host: g.host };
}

/** 解析 --fields（逗号分隔） */
export function parseFields(spec?: string): string[] | undefined {
  if (!spec) return undefined;
  const fields = spec.split(',').map((s) => s.trim()).filter(Boolean);
  return fields.length > 0 ? fields : undefined;
}

/** 从命令输出选项构建 OutputContext */
export function buildOutputContext(opts: OutputOptions): OutputContext {
  return {
    json: opts.json,
    fields: parseFields(opts.fields),
    quiet: opts.quiet,
  };
}

/** 从 token 响应计算 ISO 过期时间 */
function computeExpiresAt(expiresIn?: number): string | undefined {
  if (!Number.isFinite(expiresIn) || (expiresIn ?? 0) <= 0) return undefined;
  return new Date(Date.now() + (expiresIn as number) * 1000).toISOString();
}

/** 将 token 响应落盘所需的凭证片段 */
export function tokenResponseToCredentials(token: TokenResponse): { accessToken: string; refreshToken?: string; expiresAt?: string } {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: computeExpiresAt(token.expires_in),
  };
}

/** 读文件构造 FormData（Node 22 全局 FormData + Blob） */
export function fileToFormData(filePath: string, fieldName = 'file'): FormData {
  if (!fs.existsSync(filePath)) {
    throw new CliError({ message: `文件不存在：${filePath}`, code: ErrorCode.ARGS, exitCode: ExitCode.ARGS });
  }
  const form = new FormData();
  form.append(fieldName, new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  return form;
}

/** 客户端装配结果 */
export interface ClientBundle {
  profile: ResolvedProfile;
  client: PingCodeClient;
  auth: AuthModule;
  projects: ProjectsModule;
  workItems: WorkItemsModule;
  workItemMeta: WorkItemMetaModule;
  workItemSubResources: WorkItemSubResourcesModule;
  workItemScheme: WorkItemSchemeModule;
  sprints: SprintsModule;
  releases: ReleasesModule;
  kanbans: KanbansModule;
  waterfall: WaterfallModule;
  directory: DirectoryModule;
  commonResources: CommonResourcesModule;
  logs: LogsModule;
  wiki: WikiModule;
}

/**
 * 装配 SDK 客户端全链路。
 *
 * - 令牌在内存缓存（避免每次请求读文件）；refreshToken 刷新后回写磁盘。
 * - 仅当 profile 同时具备 clientId 与 clientSecret 时启用自动刷新；否则 401 直接抛（交由用户重新登录）。
 */
export function buildClient(conn: ConnectionOptions = {}): ClientBundle {
  const profile = loadConfig({
    profile: conn.profile,
    host: conn.host,
    clientId: conn.clientId,
    clientSecret: conn.clientSecret,
    redirectUri: conn.redirectUri,
  });
  let cached = loadCredentials(profile.name);

  // late-binding：client 先建（creds 引用 authRef），auth 再由 client 构造后赋值
  let authRef: AuthModule;

  const canRefresh = Boolean(profile.clientId && profile.clientSecret);

  const client = createClient({
    host: profile.host,
    credentials: {
      getToken: async () => cached.accessToken,
      refreshToken: canRefresh
        ? async () => {
            if (!cached.refreshToken) {
              throw new CliError({
                message: '无 refresh_token，请重新登录（pingcode auth login/token）',
                code: ErrorCode.UNAUTHORIZED,
                exitCode: ExitCode.UNAUTHORIZED,
              });
            }
            const token = await authRef.refresh({
              refreshToken: cached.refreshToken,
              clientId: profile.clientId!,
              clientSecret: profile.clientSecret!,
            });
            cached = {
              accessToken: token.access_token,
              refreshToken: token.refresh_token ?? cached.refreshToken,
              expiresAt: computeExpiresAt(token.expires_in),
            };
            saveCredentials(profile.name, cached);
          }
        : undefined,
    },
  });

  const auth = createAuthModule(client, { host: profile.host, redirectUri: profile.redirectUri });
  authRef = auth;

  return {
    profile,
    client,
    auth,
    projects: createProjectsModule(client),
    workItems: createWorkItemsModule(client),
    workItemMeta: createWorkItemMetaModule(client),
    workItemSubResources: createWorkItemSubResourcesModule(client),
    workItemScheme: createWorkItemSchemeModule(client),
    sprints: createSprintsModule(client),
    releases: createReleasesModule(client),
    kanbans: createKanbansModule(client),
    waterfall: createWaterfallModule(client),
    directory: createDirectoryModule(client),
    commonResources: createCommonResourcesModule(client),
    logs: createLogsModule(client),
    wiki: createWikiModule(client),
  };
}

// ---- PingCraft 后端客户端装配 ----

/** PingCraft JWT 存取（与 PingCode OAuth token 分离，存于 profile.pingcraft_token） */
export function loadPingcraftToken(profileName: string): string | undefined {
  return readConfigFile().profiles[profileName]?.pingcraft_token;
}

export function savePingcraftToken(profileName: string, token: string): void {
  const file = readConfigFile();
  const profiles = { ...file.profiles };
  profiles[profileName] = { ...(profiles[profileName] ?? {}), pingcraft_token: token };
  writeConfigFile({ ...file, profiles });
}

/** PingCraft 客户端 + API 装配 */
export interface PingcraftBundle {
  profile: ResolvedProfile;
  api: ReturnType<typeof createPingcraftApi>;
}

export function buildPingcraft(conn: ConnectionOptions = {}): PingcraftBundle {
  const profile = loadConfig({ profile: conn.profile, host: conn.host });
  const baseURL = profile.pingcraftApiUrl ?? 'http://localhost:3000';
  const client = createPingcraftClient({ baseURL, getToken: () => loadPingcraftToken(profile.name) });
  return { profile, api: createPingcraftApi(client) };
}

/** 测试用：runHandler 调 process.exit 时抛出的信号（便于断言退出码） */
export class ExitSignal extends Error {
  /** 退出码（cmd-driver 与测试读取此字段） */
  readonly code: number;
  /** 退出码别名，供 index.ts 的 exitCodeForError 统一识别 */
  readonly exitCode: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = 'ExitSignal';
    this.code = code;
    this.exitCode = code;
  }
}

/**
 * 统一 handler 包装：捕获错误 → 归一化为 CliError → stderr 机器可读输出 → process.exit(code)。
 *
 * 成功时不做任何事（进程自然退出，退出码 0）。
 */
export async function runHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const code = emitError(toCliError(err));
    // 以 ExitSignal 抛出便于测试捕获；生产环境直接 process.exit
    try {
      process.exit(code);
    } catch {
      throw new ExitSignal(code);
    }
  }
}
