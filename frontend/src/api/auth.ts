import request from './index'
import type { LoginResponse, LoginUrlResponse } from './types'

/** 本地登录 */
export function login(data: { username: string; password: string }) {
  return request.post<any, LoginResponse>('/auth/local/login', data)
}

/** 本地注册 */
export function register(data: { username: string; password: string }) {
  return request.post<any, { success: boolean; message?: string }>('/auth/local/register', data)
}

/** 获取 PingCode 授权 URL */
export function getLoginUrl() {
  return request.get<any, LoginUrlResponse>('/auth/login-url')
}

/** 企业授权：client_credentials 换取 access_token */
export function connectEnterprisePingcode() {
  return request.post<any, { success: boolean; message?: string }>(
    '/auth/pingcode/enterprise-token'
  )
}
