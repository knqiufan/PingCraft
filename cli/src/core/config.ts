/**
 * 配置管理（L1 core）—— 三源合并 + 多 profile。
 *
 * 优先级（低 → 高）：配置文件（`~/.pingcode/config.json`）← 环境变量（`PINGCODE_*`）← 命令行参数。
 *
 * 配置文件 schema 用 Zod 校验。凭证（token）与连接配置同居一个文件、按 profile 隔离；
 * `auth.ts` 负责凭证的读写，本模块负责读取与三源合并。
 *
 * 说明：实施方案提到 cosmiconfig。鉴于"固定全局路径 + 需回写凭证"的实际场景，
 * 直读 fs + Zod 校验更简单且读写路径一致；cosmiconfig 的多目录搜索优势在此用例不显著，
 * 故本阶段采用直读方案（若 Phase 2 需多目录搜索再引入）。
 */
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CliError, ExitCode, ErrorCode } from './errors.js';

/** PingCode 开放平台默认地址 */
export const DEFAULT_HOST = 'https://open.pingcode.com';

/** 默认 profile 名 */
export const DEFAULT_PROFILE_NAME = 'default';

/** 单个 profile 的 token 凭证 */
export const tokenSchema = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  /** ISO 时间字符串 */
  expires_at: z.string().optional(),
});

/** 单个 profile 的连接配置（含凭证） */
export const profileSchema = z.object({
  host: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  redirect_uri: z.string().optional(),
  pingcraft_api_url: z.string().optional(),
  token: tokenSchema.optional(),
});

/** 配置文件整体结构 */
export const configFileSchema = z.object({
  default_profile: z.string().optional(),
  profiles: z.record(z.string(), profileSchema).default({}),
});

export type TokenInfo = z.infer<typeof tokenSchema>;
export type ProfileConfig = z.infer<typeof profileSchema>;
export type ConfigFile = z.infer<typeof configFileSchema>;

/** 三源合并后的解析结果（命令实际使用） */
export interface ResolvedProfile {
  name: string;
  host: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  pingcraftApiUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

/** 配置文件路径（可被 PINGCODE_CONFIG_FILE 覆盖，便于测试） */
export function getConfigFilePath(override?: string): string {
  return override || process.env.PINGCODE_CONFIG_FILE || path.join(os.homedir(), '.pingcode', 'config.json');
}

/** 空配置（文件不存在或解析失败时的安全回退） */
function emptyConfig(): ConfigFile {
  return { default_profile: undefined, profiles: {} };
}

/**
 * 读取并校验配置文件。文件不存在时返回空配置（非错误）。
 * 解析/校验失败时抛 CliError(ARGS)，便于上层以退出码 2 反馈。
 */
export function readConfigFile(filePath?: string): ConfigFile {
  const resolved = getConfigFilePath(filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyConfig();
    throw new CliError({
      message: `读取配置文件失败：${resolved} — ${(err as Error).message}`,
      code: ErrorCode.GENERIC,
      exitCode: ExitCode.GENERIC,
      cause: err,
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new CliError({
      message: `配置文件 JSON 解析失败：${resolved} — ${(err as Error).message}`,
      code: ErrorCode.ARGS,
      exitCode: ExitCode.ARGS,
      cause: err,
    });
  }

  const parsed = configFileSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new CliError({
      message: `配置文件校验失败：${resolved} — ${detail}`,
      code: ErrorCode.ARGS,
      exitCode: ExitCode.ARGS,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/** 目录与文件权限：0o600（仅属主读写） */
const CONFIG_FILE_MODE = 0o600;

/**
 * 写入配置文件（创建目录、设置 0o600 权限）。
 * @internal 供 auth.ts 复用
 */
export function writeConfigFile(config: ConfigFile, filePath?: string): void {
  const resolved = getConfigFilePath(filePath);
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${resolved}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf-8', mode: CONFIG_FILE_MODE });
  fs.renameSync(tmp, resolved);
  // rename 不保留 mode 时强制设置
  try {
    fs.chmodSync(resolved, CONFIG_FILE_MODE);
  } catch {
    /* 非 POSIX（如部分 Windows）无 chmod，忽略 */
  }
}

export interface LoadConfigOptions {
  /** --profile */
  profile?: string;
  /** 命令行参数覆盖（最高优先级） */
  host?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  redirectUri?: string;
  pingcraftApiUrl?: string;
  /** 配置文件路径（测试用） */
  configFilePath?: string;
}

/** 解析生效的 profile 名 */
export function resolveProfileName(opts: LoadConfigOptions, file: ConfigFile): string {
  return opts.profile || process.env.PINGCODE_PROFILE || file.default_profile || DEFAULT_PROFILE_NAME;
}

/** 取第一个非空值（优先级从高到低） */
function pick(...values: Array<string | undefined>): string | undefined {
  return values.find((v) => v !== undefined && v !== '') as string | undefined;
}

/**
 * 三源合并，返回命令可直接使用的 ResolvedProfile。
 *
 * 字段优先级：args > env > 文件 profile。host 缺省回退到 DEFAULT_HOST。
 */
export function loadConfig(opts: LoadConfigOptions = {}): ResolvedProfile {
  const file = readConfigFile(opts.configFilePath);
  const name = resolveProfileName(opts, file);
  const fileProfile = file.profiles[name] ?? {};
  const fileToken = fileProfile.token ?? {};

  const host = pick(opts.host, process.env.PINGCODE_HOST, fileProfile.host) || DEFAULT_HOST;
  const clientId = pick(opts.clientId, process.env.PINGCODE_CLIENT_ID, fileProfile.client_id);
  const clientSecret = pick(opts.clientSecret, process.env.PINGCODE_CLIENT_SECRET, fileProfile.client_secret);
  const redirectUri = pick(opts.redirectUri, process.env.PINGCODE_REDIRECT_URI, fileProfile.redirect_uri);
  const pingcraftApiUrl = pick(opts.pingcraftApiUrl, process.env.PINGCRAFT_API_URL, fileProfile.pingcraft_api_url);
  const accessToken = pick(opts.accessToken, process.env.PINGCODE_ACCESS_TOKEN, fileToken.access_token);
  const refreshToken = pick(undefined, process.env.PINGCODE_REFRESH_TOKEN, fileToken.refresh_token);
  const expiresAt = pick(undefined, undefined, fileToken.expires_at);

  return {
    name,
    host,
    clientId,
    clientSecret,
    redirectUri,
    pingcraftApiUrl,
    accessToken,
    refreshToken,
    expiresAt,
  };
}
