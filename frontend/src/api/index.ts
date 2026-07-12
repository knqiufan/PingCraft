import axios, { type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { config } from '@/config'

/** PingCode 授权过期错误去重标记（避免并发请求重复弹出提示） */
let pingcodeAuthExpiredShown = false

const request = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  // 跨域开发时需携带 Cookie，否则 /auth/login-url 种下的 oauth_* 无法在回调时带回
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (reqConfig) => {
    const token = localStorage.getItem('local_token')
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`
    }
    if (config.isDev) {
      console.log('[Request]', reqConfig.method?.toUpperCase(), reqConfig.url)
    }
    return reqConfig
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    if (config.isDev) {
      console.log('[Response]', response.config.url, response.status)
    }
    // 滑动续期：后端在 token 即将过期时通过 X-Refreshed-Token 响应头下发新 token
    const refreshedToken = response.headers?.['x-refreshed-token']
    if (refreshedToken) {
      localStorage.setItem('local_token', refreshedToken)
    }
    return response.data
  },
  (error: AxiosError<{ error?: string; code?: string }>) => {
    const status = error.response?.status
    const message = error.response?.data?.error || error.message || '请求失败'
    const errorCode = error.response?.data?.code
    // PingCode 授权过期消息去重：同一时刻多个并发请求可能同时返回该错误，只提示一次
    const isPingcodeAuthExpired = status === 401 && errorCode === 'PINGCODE_AUTH_EXPIRED'

    if (status === 401) {
      // PingCode 授权过期（非本地 JWT 过期）：保持本地登录态，仅提示重新连接 PingCode
      if (isPingcodeAuthExpired) {
        if (!pingcodeAuthExpiredShown) {
          pingcodeAuthExpiredShown = true
          ElMessage.error(message)
          // 短暂延时后重置标记，允许后续不同的错误再次提示
          setTimeout(() => { pingcodeAuthExpiredShown = false }, 3000)
        }
      } else {
        // 本地 JWT 过期：清除登录态并跳转登录页
        localStorage.removeItem('local_token')
        localStorage.removeItem('username')
        localStorage.removeItem('isAdmin')
        localStorage.removeItem('roles')
        const isLoginRequest = error.config?.url?.includes('/auth/local/login')
        if (!isLoginRequest) {
          ElMessage.error(message)
        }
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    } else {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  }
)

export default request
