/**
 * 操作审计日志（P3-5.9）。
 *
 * 记录敏感操作的审计轨迹（谁、何时、做了什么、结果如何），
 * 便于安全审查与问题追溯。
 *
 * 采用轻量的内存 + 控制台输出方案（避免引入额外存储依赖）。
 * 生产环境可替换为持久化存储（如写入 DB 或发送到日志服务）。
 */

const MAX_LOG_ENTRIES = 1000;
const auditEntries = [];

/**
 * 记录一条审计日志。
 * @param {object} entry
 * @param {string} entry.userId - 操作者 ID
 * @param {string} entry.username - 操作者用户名
 * @param {string} entry.action - 操作类型（如 'DELETE_USER'、'CLEAR_SYNC_DATA'、'UPDATE_ROLE'）
 * @param {string} [entry.resource] - 操作目标（如 'user:xxx'、'sync-data'）
 * @param {object} [entry.detail] - 附加详情
 * @param {'success'|'failed'} [entry.result='success'] - 操作结果
 */
export function logAudit(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    userId: entry.userId || 'unknown',
    username: entry.username || 'unknown',
    action: entry.action,
    resource: entry.resource || '',
    detail: entry.detail || {},
    result: entry.result || 'success',
  };

  auditEntries.push(record);
  // 保持日志条数上限，超出时移除最早的
  if (auditEntries.length > MAX_LOG_ENTRIES) {
    auditEntries.shift();
  }

  // 控制台输出（生产环境可接入外部日志聚合）
  const level = record.result === 'failed' ? 'warn' : 'log';
  console[level](
    `[Audit] ${record.timestamp} | ${record.username}(${record.userId}) | ${record.action} | ${record.resource} | ${record.result}`,
    record.detail && Object.keys(record.detail).length > 0 ? JSON.stringify(record.detail) : ''
  );
}

/**
 * 查询审计日志（最新优先）。
 * @param {object} [filters]
 * @param {string} [filters.userId] - 按用户过滤
 * @param {string} [filters.action] - 按操作类型过滤
 * @param {number} [filters.limit=100] - 返回条数
 * @returns {Array} 审计日志条目
 */
export function getAuditLogs(filters = {}) {
  const { userId, action, limit = 100 } = filters;
  let result = [...auditEntries].reverse(); // 最新优先
  if (userId) result = result.filter((e) => e.userId === userId);
  if (action) result = result.filter((e) => e.action === action);
  return result.slice(0, limit);
}
