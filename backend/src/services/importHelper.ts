/**
 * 导入工作项的共享逻辑（供 /import 与 /import-stream 复用，消除重复代码 P2-4.1）。
 *
 * 职责：
 *   - 解析负责人姓名 → assignee_id（P1-3.2）
 *   - 将 solution_suggestion 拼入 description（P1-3.3）
 *   - 构建符合 PingCode API 的 payload（含工时单位转换、自定义属性、时间戳）
 */
import { getProjectMembers } from './pingcode.js';
import { resolveAssigneeId, ProjectMember } from '../utils/assignee.js';
import { toUnixTimestamp, hoursToWorkload } from '../utils/workItem.js';

/** 前端传入的工作项（字段可能部分缺失） */
export interface ImportItemInput {
  id: string;
  title: string;
  description?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  state_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  estimated_hours?: number | null;
  solution_suggestion?: string | null;
  properties?: Record<string, unknown> | null;
}

/** buildImportPayload 上下文 */
export interface ImportContext {
  targetProjectId: string;
  resolvedTypeId: string;
  resolvedPriorityId: string | null;
  members?: ProjectMember[];
  pingcodeUserId?: string | null;
}

/**
 * 拉取项目成员并缓存 assignee_name → assignee_id 的映射结果。
 * 为减少 PingCode API 调用，同一项目的成员列表只拉取一次。
 *
 * @returns 成员列表（拉取失败时返回空数组）
 */
export async function getProjectMembersCached(
  accessToken: string,
  projectId: string,
  domain: string,
  cache: Map<string, ProjectMember[]>,
): Promise<ProjectMember[]> {
  if (cache.has(projectId)) return cache.get(projectId)!;
  let members: ProjectMember[] = [];
  try {
    const res = await getProjectMembers(accessToken, projectId, domain);
    members = Array.isArray(res) ? res : (res?.values || []);
  } catch (e) {
    console.warn(`[ImportHelper] 获取项目 ${projectId} 成员失败，负责人将回退到当前用户:`, (e as Error).message);
  }
  cache.set(projectId, members);
  return members;
}

/**
 * 将 solution_suggestion 拼接到 description 末尾（P1-3.3）。
 * 仅当 solution_suggestion 非空时追加。
 */
function appendSolutionSuggestion(
  description: string | null | undefined,
  solutionSuggestion?: string | null,
): string {
  const desc = description || '';
  const suggestion = solutionSuggestion?.trim();
  if (!suggestion) return desc;
  const separator = desc ? '\n\n' : '';
  return `${desc}${separator}【解决方案建议】\n${suggestion}`;
}

/**
 * 构建单个工作项的 PingCode 创建 payload（含 _local_id 用于关联本地记录）。
 */
export function buildImportPayload(item: ImportItemInput, ctx: ImportContext): Record<string, unknown> {
  const { targetProjectId, resolvedTypeId, resolvedPriorityId, members, pingcodeUserId } = ctx;

  // 负责人解析：优先用显式 assignee_id，其次从 assignee_name 模糊匹配，最后回退当前用户
  let assigneeId = item.assignee_id || null;
  if (!assigneeId && item.assignee_name && members?.length) {
    assigneeId = resolveAssigneeId(item.assignee_name, members);
  }
  if (!assigneeId && pingcodeUserId) {
    assigneeId = pingcodeUserId;
  }

  const payload: Record<string, unknown> = {
    _local_id: item.id,
    project_id: targetProjectId,
    title: item.title,
    type_id: resolvedTypeId,
  };

  // description 追加 solution_suggestion
  const fullDescription = appendSolutionSuggestion(item.description, item.solution_suggestion);
  if (fullDescription) payload.description = fullDescription;

  if (resolvedPriorityId) payload.priority_id = resolvedPriorityId;
  if (item.state_id) payload.state_id = item.state_id;
  if (assigneeId) payload.assignee_id = assigneeId;

  const startAt = toUnixTimestamp(item.start_at);
  if (startAt) payload.start_at = startAt;

  const endAt = toUnixTimestamp(item.end_at);
  if (endAt) payload.end_at = endAt;

  // 预估工时：小时 → PingCode workload 单位
  const workload = hoursToWorkload(item.estimated_hours);
  if (workload !== null) payload.estimated_workload = workload;

  // 自定义属性
  if (item.properties && Object.keys(item.properties).length > 0) {
    payload.properties = item.properties;
  }

  return payload;
}
