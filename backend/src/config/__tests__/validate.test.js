import { describe, it, expect, vi } from 'vitest';

/**
 * 测试配置校验逻辑（P3-5.13 + P0-2.3 生产环境密钥守卫）。
 * validate.js 导入 config/index.js（依赖 dotenv），这里 mock appConfig 来隔离。
 */
vi.mock('../index.js', () => ({
  appConfig: {
    env: 'development',
    jwt: { secret: 'dev_secret_key' },
    pingcode: { host: 'http://example.com' },
  },
}));

describe('validateRequiredConfig()', () => {
  it('开发环境 + 默认 JWT_SECRET + 有 PINGCODE_HOST → 无错误', async () => {
    const { validateRequiredConfig } = await import('../validate.js');
    const errors = validateRequiredConfig();
    expect(errors).toHaveLength(0);
  });

  it('开发环境 + PINGCODE_HOST 为空 → 仅警告不报错', async () => {
    const mod = await import('../index.js');
    const original = mod.appConfig.pingcode.host;
    mod.appConfig.pingcode.host = '';
    const { validateRequiredConfig } = await import('../validate.js');
    const errors = validateRequiredConfig();
    expect(errors).toHaveLength(0); // 不报错
    mod.appConfig.pingcode.host = original;
  });

  it('生产环境 + 默认 JWT_SECRET → 报错', async () => {
    const mod = await import('../index.js');
    const originalEnv = mod.appConfig.env;
    mod.appConfig.env = 'production';
    delete process.env.ENCRYPTION_KEY;
    const { validateRequiredConfig } = await import('../validate.js');
    const errors = validateRequiredConfig();
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
    expect(errors.some((e) => e.includes('ENCRYPTION_KEY'))).toBe(true);
    mod.appConfig.env = originalEnv;
  });

  it('生产环境 + 已设 ENCRYPTION_KEY + 强 JWT_SECRET → 无密钥相关错误', async () => {
    const mod = await import('../index.js');
    const originalEnv = mod.appConfig.env;
    const originalSecret = mod.appConfig.jwt.secret;
    mod.appConfig.env = 'production';
    mod.appConfig.jwt.secret = 'a-strong-random-secret';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    const { validateRequiredConfig } = await import('../validate.js');
    const errors = validateRequiredConfig();
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(false);
    expect(errors.some((e) => e.includes('ENCRYPTION_KEY'))).toBe(false);
    mod.appConfig.env = originalEnv;
    mod.appConfig.jwt.secret = originalSecret;
    delete process.env.ENCRYPTION_KEY;
  });
});
