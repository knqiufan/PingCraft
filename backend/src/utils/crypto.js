/**
 * 对称加密工具：AES-256-GCM
 *
 * 用于加密存储敏感字段（OAuth token、client_secret、LLM api_key 等）。
 * 密钥从环境变量 ENCRYPTION_KEY 读取；开发环境若无配置则派生一个固定 dev key（仅本地使用）。
 *
 * 加密后格式：`enc:v1:<iv_base64>:<ciphertext_base64>:<authTag_base64>`
 * decrypt() 遇到非加密格式（明文旧数据）会原样返回，保证平滑迁移。
 */
import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';

/** 解析 32 字节主密钥：优先 hex/base64，否则按 SHA-256 派生 */
function resolveKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) {
    // 开发环境兜底：派生固定 key（生产环境必须设置 ENCRYPTION_KEY）
    return crypto.createHash('sha256').update('pingcraft_dev_encryption_key').digest();
  }
  // hex（64 字符）或 base64（44 字符）直接使用
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 32) return buf;
  // 其他格式派生为 32 字节
  return crypto.createHash('sha256').update(raw).digest();
}

let _key = null;
function getKey() {
  if (!_key) _key = resolveKey();
  return _key;
}

/** 重置缓存的密钥（主要供测试切换 ENCRYPTION_KEY 后使用） */
export function _resetKey() {
  _key = null;
}

/** 是否为加密格式（以 enc:v1: 前缀开头） */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * 加密明文，返回 `enc:v1:<iv>:<ciphertext>:<tag>` 格式字符串。
 * 传入 null/undefined/空串原样返回。
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  if (plaintext === '') return '';
  const str = String(plaintext);
  if (isEncrypted(str)) return str; // 避免重复加密

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

/**
 * 解密加密字符串。若输入不是加密格式（明文旧数据），原样返回。
 */
export function decrypt(value) {
  if (typeof value !== 'string' || !isEncrypted(value)) return value;

  try {
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return value;
    const [ivB64, ctB64, tagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // 解密失败（密钥变更等），返回原值避免崩溃
    console.warn('[Crypto] 解密失败，可能密钥已变更或数据损坏，返回原值');
    return value;
  }
}

/**
 * 对 API Key 等敏感串做脱敏：保留首尾少量字符，中间用 **** 代替。
 * `sk-abcd1234efgh` → `sk-ab****efgh`
 */
export function maskSecret(value) {
  if (!value || typeof value !== 'string') return '';
  // 先解密（如果存储时被加密），再脱敏
  const plain = isEncrypted(value) ? decrypt(value) : value;
  if (!plain) return '';
  if (plain.length <= 8) return '****';
  const head = plain.slice(0, Math.min(6, Math.floor(plain.length / 4)));
  const tail = plain.slice(-4);
  return `${head}****${tail}`;
}
