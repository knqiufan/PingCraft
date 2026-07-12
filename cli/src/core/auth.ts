/**
 * 凭证存取（L1 core）。
 *
 * 凭证（access_token / refresh_token / expires_at）按 profile 存于配置文件
 * `profiles.<name>.token`，文件 0o600。本阶段为文件方案；keyring 作为增强项放 Phase 5。
 *
 * 读写均通过 `config.ts` 的 readConfigFile/writeConfigFile，保证单一文件路径与 schema 一致。
 */
import { readConfigFile, writeConfigFile, type ConfigFile, type ProfileConfig } from './config.js';

/** 凭证（运行时驼峰命名；落盘为 token.{access_token,refresh_token,expires_at}） */
export interface Credentials {
  accessToken?: string;
  refreshToken?: string;
  /** ISO 时间字符串 */
  expiresAt?: string;
}

/** 读取指定 profile 的凭证（无 profile / 无 token 时返回空对象） */
export function loadCredentials(profileName: string, filePath?: string): Credentials {
  const file = readConfigFile(filePath);
  const token = file.profiles[profileName]?.token ?? {};
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at,
  };
}

/** 确保指定 profile 存在（返回可变的引用副本结构） */
function withProfile(file: ConfigFile, name: string): { file: ConfigFile; profile: ProfileConfig } {
  const profiles = { ...file.profiles };
  const profile: ProfileConfig = profiles[name] ? { ...profiles[name] } : {};
  // 深拷贝 token，避免写回时污染
  if (profile.token) profile.token = { ...profile.token };
  profiles[name] = profile;
  return { file: { ...file, profiles }, profile };
}

/** 写入/更新指定 profile 的凭证（合并：未提供字段保留原值，空串清空） */
export function saveCredentials(profileName: string, creds: Credentials, filePath?: string): void {
  const file = readConfigFile(filePath);
  const { file: next, profile } = withProfile(file, profileName);
  profile.token = {
    ...(profile.token ?? {}),
    ...(creds.accessToken !== undefined ? { access_token: creds.accessToken } : {}),
    ...(creds.refreshToken !== undefined ? { refresh_token: creds.refreshToken } : {}),
    ...(creds.expiresAt !== undefined ? { expires_at: creds.expiresAt } : {}),
  };
  writeConfigFile(next, filePath);
}

/** 清除指定 profile 的凭证（保留其它连接配置） */
export function clearCredentials(profileName: string, filePath?: string): void {
  const file = readConfigFile(filePath);
  if (!file.profiles[profileName]) return;
  const profiles = { ...file.profiles };
  const profile: ProfileConfig = { ...profiles[profileName] };
  delete profile.token;
  profiles[profileName] = profile;
  writeConfigFile({ ...file, profiles }, filePath);
}

/**
 * 判断 token 是否已过期（含提前量）。
 * @param expiresAt ISO 时间字符串
 * @param skewMin 提前量（分钟），默认 5：距过期 5 分钟内即视为过期，触发刷新
 * @returns 无 expiresAt 时返回 false（交给 API 401 触发刷新）
 */
export function isExpired(expiresAt?: string, skewMin = 5): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() + skewMin * 60 * 1000 >= ts;
}
