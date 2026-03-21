import request from './index'
import type { ConfigInfo, PingCodeGrantType } from './types'

/** 获取配置（含连接状态） */
export function getConfig() {
  return request.get<any, ConfigInfo>('/api/config')
}

/** 保存配置 */
export function saveConfig(data: {
  client_id: string
  client_secret: string
  grant_type: PingCodeGrantType
}) {
  return request.post<any, { success: boolean; message?: string }>('/api/config', data)
}
