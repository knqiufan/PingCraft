/**
 * 生成项目标识符（identifier）
 */
export function generateProjectIdentifier(projectName) {
  const cleaned = projectName
    .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
    .trim();

  const hasChineseChar = /[\u4e00-\u9fa5]/.test(cleaned);
  if (hasChineseChar) {
    const timestamp = Date.now().toString().slice(-6);
    return `PRJ${timestamp}`;
  }

  const identifier = cleaned
    .toUpperCase()
    .replace(/\s+/g, '_')
    .slice(0, 15);

  return identifier || `PRJ${Date.now().toString().slice(-6)}`;
}

/**
 * 将 ISO 日期字符串或 Date 转换为 Unix 时间戳（秒）
 */
export function toUnixTimestamp(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'number') {
    return dateInput > 9999999999 ? Math.floor(dateInput / 1000) : dateInput;
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

/**
 * 解析 type_id
 */
export function resolveTypeId(typeId, typeNameMap) {
  if (!typeId) return typeNameMap.get('story') || 'story';
  if (typeId.includes('-') && typeId.length > 20) return typeId;
  const mapped = typeNameMap.get(typeId.toLowerCase());
  return mapped || typeNameMap.get('story') || typeId;
}

/**
 * 解析 priority_id
 */
export function resolvePriorityId(priorityId, priorityName, priorityNameMap) {
  if (priorityId && priorityId.includes('-') && priorityId.length > 20) return priorityId;
  if (priorityId) {
    const mapped = priorityNameMap.get(priorityId.toLowerCase());
    if (mapped) return mapped;
  }
  if (priorityName) {
    const mapped = priorityNameMap.get(priorityName.toLowerCase());
    if (mapped) return mapped;
  }
  return null;
}
