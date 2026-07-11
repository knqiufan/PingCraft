/**
 * 工作项相关工具函数
 */

/** 工时单位配置：minute / hour / day（与 PingCode 企业设置一致） */
type WorkloadUnit = 'minute' | 'hour' | 'day';

function getWorkloadUnit(): WorkloadUnit {
  const unit = (process.env.PINGCODE_WORKLOAD_UNIT || 'hour').toLowerCase();
  return (['minute', 'hour', 'day'] as const).includes(unit as WorkloadUnit)
    ? (unit as WorkloadUnit)
    : 'hour';
}

/** 每单位对应的小时数 */
const UNIT_TO_HOURS: Record<WorkloadUnit, number> = {
  minute: 1 / 60,
  hour: 1,
  day: 8,
};

/**
 * 将「小时」转换为 PingCode estimated_workload 所需单位（配置项 PINGCODE_WORKLOAD_UNIT）。
 * 默认 'hour'（向后兼容），可配置为 'minute' / 'day'。
 */
export function hoursToWorkload(hours: unknown): number | null {
  if (typeof hours !== 'number' || !isFinite(hours) || hours <= 0) return null;
  const unit = getWorkloadUnit();
  const factor = UNIT_TO_HOURS[unit];
  return Math.round((hours / factor) * 1000) / 1000;
}

/**
 * 将 PingCode estimated_workload（按配置单位）转换回「小时」，用于统计展示。
 */
export function workloadToHours(workload: unknown): number {
  if (typeof workload !== 'number' || !isFinite(workload) || workload <= 0) return 0;
  const unit = getWorkloadUnit();
  const factor = UNIT_TO_HOURS[unit];
  return Math.round(workload * factor * 1000) / 1000;
}

/** extractWorkItemIds 返回的 ID 三元组 */
export interface WorkItemIds {
  typeId: string | null;
  priorityId: string | null;
  stateId: string | null;
}

/**
 * 从 PingCode 工作项对象中提取类型/优先级/状态 ID。
 * 兼容两种返回结构：
 *   - 扁平：item.work_item_type_id / item.priority_id / item.state_id
 *   - 嵌套（PingCode 实际结构）：item.type.id / item.priority.id / item.state.id
 *
 * 当字段为对象时仅取 .id，避免把整个对象当 ID 传入 Map 查找。
 */
export function extractWorkItemIds(item: Record<string, any> | null | undefined): WorkItemIds {
  if (!item) return { typeId: null, priorityId: null, stateId: null };
  const rawType = item.work_item_type_id || item.type_id || item.type;
  const rawPriority = item.priority_id || item.priority;
  const rawState = item.state_id || item.state;

  const typeId = typeof rawType === 'object' ? (rawType?.id || null) : (rawType || null);
  const priorityId = typeof rawPriority === 'object' ? (rawPriority?.id || null) : (rawPriority || null);
  const stateId = typeof rawState === 'object' ? (rawState?.id || null) : (rawState || null);

  return { typeId, priorityId, stateId };
}

/**
 * 生成项目标识符（identifier）
 * 加入随机后缀避免同一时间并发创建项目时发生碰撞（PingCode 要求 identifier 企业内唯一）。
 */
export function generateProjectIdentifier(projectName: string): string {
  const cleaned = projectName
    .replace(/[^\w\s一-龥]/g, '')
    .trim();

  const hasChineseChar = /[一-龥]/.test(cleaned);
  // 4 位随机字母数字后缀，碰撞概率极低（36^4 ≈ 170 万）
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  if (hasChineseChar || !cleaned) {
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    return `PRJ${timestamp}${randomSuffix}`;
  }

  const base = cleaned
    .toUpperCase()
    .replace(/\s+/g, '_')
    .slice(0, 10);
  // 组合后不超过 15 字符（base 最多 10 + 分隔 + 4 随机）
  return `${base}_${randomSuffix}`;
}

/**
 * 将 ISO 日期字符串或 Date 转换为 Unix 时间戳（秒）
 */
export function toUnixTimestamp(dateInput: string | number | Date | null | undefined): number | null {
  if (!dateInput) return null;
  if (typeof dateInput === 'number') {
    return dateInput > 9999999999 ? Math.floor(dateInput / 1000) : dateInput;
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

/** UUID 正则（标准 36 字符 / 32 字符无连字符）和 MongoDB ObjectId（24 位 hex） */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UUID_SHORT_RE = /^[0-9a-fA-F]{32}$/;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** 判断字符串是否为 UUID / ObjectId 形式（已经是可以直接使用的 ID，无需再映射） */
export function isUuidLike(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return UUID_RE.test(value) || OBJECT_ID_RE.test(value) || UUID_SHORT_RE.test(value);
}

/**
 * 解析 type_id：若已经是 UUID/ObjId 直接返回，否则按名称查映射表。
 */
export function resolveTypeId(typeId: string | null | undefined, typeNameMap: Map<string, string>): string {
  if (!typeId) return typeNameMap.get('story') || 'story';
  if (isUuidLike(typeId)) return typeId;
  const mapped = typeNameMap.get(typeId.toLowerCase());
  return mapped || typeNameMap.get('story') || typeId;
}

/**
 * 解析 priority_id：若已经是 UUID/ObjId 直接返回，否则按名称查映射表。
 */
export function resolvePriorityId(
  priorityId: string | null | undefined,
  priorityName: string | null | undefined,
  priorityNameMap: Map<string, string>,
): string | null {
  if (priorityId && isUuidLike(priorityId)) return priorityId;
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
