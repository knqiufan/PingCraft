/**
 * 同步增量比较工具：判断本地缓存是否需要更新。
 * 纯逻辑函数，从 sync.js 抽出以便单元测试。
 */

/** 提取 PingCode 对象的更新时间，用于增量同步判断 */
export function remoteUpdatedAt(obj) {
  return obj?.updated_at || obj?.updatedAt || obj?.last_modified || null;
}

/** 规范化更新时间为可比较字符串（ISO 或时间戳字符串） */
export function normUpdateKey(v) {
  if (!v) return '';
  return String(v);
}

/**
 * 判断本地缓存是否需要更新：
 *   1. 本地已归档但远端重新出现 → 需要更新（取消归档）
 *   2. 远端有 updated_at 且与本地不同 → 需要更新
 *   3. 远端无 updated_at 时，比较 title/description 内容是否变化
 *
 * @param {object} existing - 本地缓存行（含 is_archived, remote_updated_at, title, description）
 * @param {object} remoteItem - PingCode 返回的对象
 * @param {string|null} remoteUpdated - 远端更新时间
 * @returns {boolean}
 */
export function needsUpdate(existing, remoteItem, remoteUpdated) {
  // 归档项重新出现，强制更新以取消归档
  if (existing?.is_archived) return true;

  // 时间戳比较
  const remoteKey = normUpdateKey(remoteUpdated);
  const localKey = normUpdateKey(existing?.remote_updated_at);
  if (remoteKey && remoteKey !== localKey) return true;

  // 无时间戳时回退到内容比较（标题或描述变化即更新）
  if (!remoteKey) {
    if (remoteItem?.title !== existing?.title) return true;
    const remoteDesc = remoteItem?.description || null;
    const localDesc = existing?.description || null;
    if (remoteDesc !== localDesc) return true;
  }

  return false;
}
