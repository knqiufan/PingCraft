/**
 * 启动时配置校验
 *
 * 生产环境强制要求：
 *   - JWT_SECRET 不能使用默认值
 *   - ENCRYPTION_KEY 必须设置（敏感字段加密密钥）
 *
 * 开发环境对 PINGCODE_HOST 缺失等给出警告但不阻断启动。
 *
 * @returns {string[]} 错误消息数组，空数组表示校验通过
 */
import { appConfig } from './index.js';

const DEFAULT_JWT_SECRET = 'dev_secret_key';

export function validateRequiredConfig() {
  const errors = [];
  const isProd = appConfig.env === 'production';

  // JWT_SECRET 不能为默认值（开发环境也警告）
  if (!appConfig.jwt.secret) {
    errors.push('JWT_SECRET 未设置，请配置应用签名密钥');
  } else if (isProd && appConfig.jwt.secret === DEFAULT_JWT_SECRET) {
    errors.push('生产环境不能使用默认 JWT_SECRET，请设置强随机值');
  }

  // 生产环境强制要求 ENCRYPTION_KEY
  if (isProd && !process.env.ENCRYPTION_KEY) {
    errors.push(
      '生产环境必须设置 ENCRYPTION_KEY（敏感字段加密密钥），' +
      '生成方式：node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // PINGCODE_HOST 为空时 OAuth URL 构造会抛错（仅警告）
  if (!appConfig.pingcode.host) {
    if (isProd) {
      errors.push('PINGCODE_HOST 未设置，PingCode OAuth 与 API 调用将无法工作');
    } else {
      console.warn('[Config] PINGCODE_HOST 未设置，PingCode 相关功能（OAuth/同步/导入）将不可用');
    }
  }

  return errors;
}
