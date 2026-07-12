/**
 * 安全日志（L2 sdk，只读）。
 *
 * 路径：`/security/login_logs` + `/security/audit_logs`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type PageParams } from '../types.js';

export interface LogEntry {
  id?: string;
  [k: string]: unknown;
}

export function createLogsModule(client: PingCodeClient) {
  return {
    async login(params: PageParams = {}) {
      const data = await client.get('/security/login_logs', { params: { page_index: params.pageIndex, page_size: params.pageSize } });
      return extractList<LogEntry>(data as never);
    },
    async audit(params: PageParams = {}) {
      const data = await client.get('/security/audit_logs', { params: { page_index: params.pageIndex, page_size: params.pageSize } });
      return extractList<LogEntry>(data as never);
    },
  };
}

export type LogsModule = ReturnType<typeof createLogsModule>;
