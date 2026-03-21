/**
 * 全局配置：从环境变量读取，统一导出
 */
export const config = {
  /** API 基础地址 */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  /** 应用标题 */
  appTitle: import.meta.env.VITE_APP_TITLE || 'PingCraft',
  /** 是否开发环境 */
  isDev: import.meta.env.DEV,
  /** 是否生产环境 */
  isProd: import.meta.env.PROD,
} as const
