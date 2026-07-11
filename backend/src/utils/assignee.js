/**
 * 将负责人姓名（assignee_name）解析为 PingCode 用户 ID（assignee_id）。
 *
 * 匹配策略（按优先级）：
 *   1. 精确匹配 name / display_name（忽略大小写、首尾空格）
 *   2. 包含匹配（assignee_name 出现在 name 或 display_name 中，或反之）
 *   3. 无匹配 → 返回 null（调用方回退到当前用户）
 *
 * @param {string|null} assigneeName - 从需求文档识别的负责人姓名
 * @param {Array} members - PingCode 成员列表，每项形如 { id, name, display_name, email, ... }
 * @returns {string|null} 匹配到的成员 ID，未匹配返回 null
 */
export function resolveAssigneeId(assigneeName, members) {
  if (!assigneeName || !Array.isArray(members) || members.length === 0) {
    return null;
  }

  const normalized = String(assigneeName).trim().toLowerCase();
  if (!normalized) return null;

  // 1. 精确匹配（忽略大小写）
  for (const m of members) {
    const name = String(m.name || '').trim().toLowerCase();
    const displayName = String(m.display_name || '').trim().toLowerCase();
    if (name === normalized || displayName === normalized) {
      return m.id;
    }
  }

  // 2. 包含匹配（仅在姓名/关键词 ≥ 2 字符时启用，避免短名误匹配）
  if (normalized.length >= 2) {
    for (const m of members) {
      const name = String(m.name || '').trim().toLowerCase();
      const displayName = String(m.display_name || '').trim().toLowerCase();
      if (
        (name.length >= 2 && (name.includes(normalized) || normalized.includes(name))) ||
        (displayName.length >= 2 && (displayName.includes(normalized) || normalized.includes(displayName)))
      ) {
        return m.id;
      }
    }
  }

  return null;
}
