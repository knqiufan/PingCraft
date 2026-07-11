import express from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ensureFreshToken } from '../middleware/tokenRefresh.js';
import type { AuthedRequest } from '../types/authRequest.js';
import type { User } from '../models/index.js';
import { getWorkItems } from '../services/pingcode.js';
import { WorkItemType, WorkItemState, WorkItemPriority, SyncedProject } from '../models/index.js';
import { success } from '../utils/response.js';
import { analyzeProjectStats } from '../services/statsAnalyzer.js';
import { workloadToHours, extractWorkItemIds } from '../utils/workItem.js';

const router = express.Router();

interface StatsCacheEntry {
  data: any;
  expireAt: number;
}

/**
 * 统计数据内存缓存（P3-5.4）。
 * TTL 默认 5 分钟，避免大项目每次请求都拉全量工作项。
 * key: `${userId}:${projectId}`，value: { data, expireAt }
 */
const STATS_CACHE_TTL_MS = parseInt(process.env.STATS_CACHE_TTL_MS || '300000', 10); // 5 分钟
const statsCache = new Map<string, StatsCacheEntry>();

function getCachedStats(userId: string, projectId: string): any {
  const key = `${userId}:${projectId}`;
  const entry = statsCache.get(key);
  if (entry && entry.expireAt > Date.now()) {
    return entry.data;
  }
  statsCache.delete(key);
  return null;
}

function setCachedStats(userId: string, projectId: string, data: any): void {
  statsCache.set(`${userId}:${projectId}`, {
    data,
    expireAt: Date.now() + STATS_CACHE_TTL_MS,
  });
}

/** 使指定项目的统计缓存失效（同步/导入后调用） */
export function invalidateStatsCache(userId: string, projectId?: string | null): void {
  if (projectId) {
    statsCache.delete(`${userId}:${projectId}`);
  } else {
    // 无 projectId 时清除该用户所有项目的缓存
    for (const key of statsCache.keys()) {
      if (key.startsWith(`${userId}:`)) statsCache.delete(key);
    }
  }
}

/** 名称映射集合 */
interface NameMaps {
  typeMap: Map<string, string>;
  stateMap: Map<string, { name: string; type: string }>;
  priorityMap: Map<string, string>;
}

/**
 * 从本地元数据表构建 ID -> 名称 的映射
 */
async function buildNameMaps(userId: string, projectId: string): Promise<NameMaps> {
  const [types, states, priorities] = await Promise.all([
    WorkItemType.findAll({ where: { user_id: userId, project_id: projectId } }),
    WorkItemState.findAll({ where: { user_id: userId, project_id: projectId } }),
    WorkItemPriority.findAll({ where: { user_id: userId, project_id: projectId } }),
  ]);

  return {
    typeMap: new Map(types.map((t) => [t.id, t.name])),
    stateMap: new Map(states.map((s) => [s.id, { name: s.name, type: s.type || '' }])),
    priorityMap: new Map(priorities.map((p) => [p.id, p.name])),
  };
}

function mapToSortedArray(map: Map<string, number>, order: 'desc' | 'asc' = 'desc'): Array<{ name: string; value: number }> {
  const arr = Array.from(map, ([name, value]) => ({ name, value }));
  arr.sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value));
  return arr;
}

function buildStateDistribution(stateMap: Map<string, number>): {
  groups: { todo: number; inProgress: number; done: number; other: number };
  details: Array<{ name: string; type: string; count: number }>;
  total: number;
  completionRate: number;
} {
  const groups = { todo: 0, inProgress: 0, done: 0, other: 0 };
  const details: Array<{ name: string; type: string; count: number }> = [];

  for (const [key, count] of stateMap) {
    const [name, type] = key.split('|');
    details.push({ name, type, count });

    if (type === 'todo' || type === 'register') groups.todo += count;
    else if (type === 'in_progress' || type === 'processing') groups.inProgress += count;
    else if (type === 'done' || type === 'completed' || type === 'resolved') groups.done += count;
    else groups.other += count;
  }

  const total = groups.todo + groups.inProgress + groups.done + groups.other;
  return {
    groups,
    details,
    total,
    completionRate: total > 0 ? Math.round((groups.done / total) * 100) : 0,
  };
}

/**
 * 聚合工作项统计数据
 */
function aggregateWorkItems(items: any[], nameMaps: NameMaps): any {
  const { typeMap, stateMap, priorityMap } = nameMaps;

  const assigneeDistribution = new Map<string, number>();
  const typeDistribution = new Map<string, number>();
  const priorityDistribution = new Map<string, number>();
  const stateDistribution = new Map<string, number>();
  const assigneeWorkload = new Map<string, number>();
  const typeWorkload = new Map<string, number>();

  for (const item of items) {
    const assigneeName = item.assignees?.[0]?.name
      || item.assignee?.name
      || item.assignee?.id
      || item.assignee_id
      || '未分配';
    const { typeId, priorityId, stateId } = extractWorkItemIds(item);
    const typeName = typeMap.get(typeId || '') || '未知类型';
    const priorityName = (priorityId && priorityMap.get(priorityId)) || '未设置';
    const stateInfo = stateId ? stateMap.get(stateId) : null;
    const stateName = stateInfo?.name || '未知状态';
    const stateType = stateInfo?.type || 'unknown';
    const hours = workloadToHours(item.estimated_workload);

    // 人员分布
    assigneeDistribution.set(assigneeName, (assigneeDistribution.get(assigneeName) || 0) + 1);

    // 类型分布
    typeDistribution.set(typeName, (typeDistribution.get(typeName) || 0) + 1);

    // 优先级分布
    priorityDistribution.set(priorityName, (priorityDistribution.get(priorityName) || 0) + 1);

    // 状态分布（用于完成进度）
    const stateKey = `${stateName}|${stateType}`;
    stateDistribution.set(stateKey, (stateDistribution.get(stateKey) || 0) + 1);

    // 人员工时
    assigneeWorkload.set(assigneeName, (assigneeWorkload.get(assigneeName) || 0) + hours);

    // 类型工时
    typeWorkload.set(typeName, (typeWorkload.get(typeName) || 0) + hours);
  }

  return {
    assigneeDistribution: mapToSortedArray(assigneeDistribution),
    typeDistribution: mapToSortedArray(typeDistribution),
    priorityDistribution: mapToSortedArray(priorityDistribution),
    stateDistribution: buildStateDistribution(stateDistribution),
    workloadByAssignee: mapToSortedArray(assigneeWorkload, 'desc'),
    workloadByType: mapToSortedArray(typeWorkload, 'desc'),
  };
}

/**
 * 获取项目统计数据的核心逻辑（供路由和 AI 分析复用）。
 * 使用内存缓存（TTL 5 分钟）避免重复拉取全量工作项（P3-5.4）。
 */
export async function getProjectStatsData(user: User, projectId: string): Promise<any> {
  const userId = user.id;

  // 命中缓存直接返回
  const cached = getCachedStats(userId, projectId);
  if (cached) return cached;

  const accessToken = user.access_token;
  const domain = user.domain ?? undefined;

  const project = await SyncedProject.findOne({
    where: { id: projectId, user_id: userId },
  });
  if (!project) {
    throw Object.assign(new Error('项目不存在'), { status: 404 });
  }

  const [items, nameMaps] = await Promise.all([
    getWorkItems(accessToken!, projectId, domain),
    buildNameMaps(userId, projectId),
  ]);

  const stats = aggregateWorkItems(items, nameMaps);

  const data = {
    project: { id: project.id, name: project.name },
    totalItems: items.length,
    totalEstimatedHours: items.reduce((sum, i) => sum + workloadToHours(i.estimated_workload), 0),
    ...stats,
  };

  setCachedStats(userId, projectId, data);
  return data;
}

/** GET /api/stats/:projectId - 获取项目统计数据 */
router.get('/:projectId', requireAuth, ensureFreshToken, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getProjectStatsData(req.user!, req.params.projectId as string);
    res.json(success(data));
  } catch (e: any) {
    if (e.status === 404) return res.status(404).json({ success: false, error: e.message });
    next(e);
  }
});

/** POST /api/stats/ai-analyze - AI 统计分析 */
router.post('/ai-analyze', requireAuth, ensureFreshToken, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: '缺少 projectId 参数' });
    }

    const statsData = await getProjectStatsData(req.user!, projectId);
    const report = await analyzeProjectStats(statsData, req.user!.id);
    res.json(success({ report, stats: statsData }));
  } catch (e: any) {
    if (e.status === 404) return res.status(404).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
