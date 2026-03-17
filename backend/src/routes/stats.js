import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ensureFreshToken } from '../middleware/tokenRefresh.js';
import { getWorkItems } from '../services/pingcode.js';
import { WorkItemType, WorkItemState, WorkItemPriority, SyncedProject } from '../models/index.js';
import { success } from '../utils/response.js';
import { analyzeProjectStats } from '../services/statsAnalyzer.js';

const router = express.Router();

/**
 * 从本地元数据表构建 ID -> 名称 的映射
 */
async function buildNameMaps(userId, projectId) {
  const [types, states, priorities] = await Promise.all([
    WorkItemType.findAll({ where: { user_id: userId, project_id: projectId } }),
    WorkItemState.findAll({ where: { user_id: userId, project_id: projectId } }),
    WorkItemPriority.findAll({ where: { user_id: userId, project_id: projectId } }),
  ]);

  return {
    typeMap: new Map(types.map(t => [t.id, t.name])),
    stateMap: new Map(states.map(s => [s.id, { name: s.name, type: s.type }])),
    priorityMap: new Map(priorities.map(p => [p.id, p.name])),
  };
}

/**
 * 聚合工作项统计数据
 */
function aggregateWorkItems(items, nameMaps) {
  const { typeMap, stateMap, priorityMap } = nameMaps;

  const assigneeDistribution = new Map();
  const typeDistribution = new Map();
  const priorityDistribution = new Map();
  const stateDistribution = new Map();
  const assigneeWorkload = new Map();
  const typeWorkload = new Map();

  for (const item of items) {
    const assigneeName = item.assignees?.[0]?.name
      || item.assignee?.name
      || item.assignee_id
      || '未分配';
    const typeName = typeMap.get(item.work_item_type_id) || typeMap.get(item.type_id) || '未知类型';
    const priorityName = priorityMap.get(item.priority_id) || '未设置';
    const stateInfo = stateMap.get(item.state_id);
    const stateName = stateInfo?.name || '未知状态';
    const stateType = stateInfo?.type || 'unknown';
    const hours = item.estimated_workload || 0;

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

function mapToSortedArray(map, order = 'desc') {
  const arr = Array.from(map, ([name, value]) => ({ name, value }));
  arr.sort((a, b) => order === 'desc' ? b.value - a.value : a.value - b.value);
  return arr;
}

function buildStateDistribution(stateMap) {
  const groups = { todo: 0, inProgress: 0, done: 0, other: 0 };
  const details = [];

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
 * 获取项目统计数据的核心逻辑（供路由和 AI 分析复用）
 */
export async function getProjectStatsData(user, projectId) {
  const accessToken = user.access_token;
  const domain = user.domain;
  const userId = user.id;

  const project = await SyncedProject.findOne({
    where: { id: projectId, user_id: userId },
  });
  if (!project) {
    throw Object.assign(new Error('项目不存在'), { status: 404 });
  }

  const [items, nameMaps] = await Promise.all([
    getWorkItems(accessToken, projectId, domain),
    buildNameMaps(userId, projectId),
  ]);

  const stats = aggregateWorkItems(items, nameMaps);

  return {
    project: { id: project.id, name: project.name },
    totalItems: items.length,
    totalEstimatedHours: items.reduce((sum, i) => sum + (i.estimated_workload || 0), 0),
    ...stats,
  };
}

/** GET /api/stats/:projectId - 获取项目统计数据 */
router.get('/:projectId', requireAuth, ensureFreshToken, async (req, res, next) => {
  try {
    const data = await getProjectStatsData(req.user, req.params.projectId);
    res.json(success(data));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ success: false, error: e.message });
    next(e);
  }
});

/** POST /api/stats/ai-analyze - AI 统计分析 */
router.post('/ai-analyze', requireAuth, ensureFreshToken, async (req, res, next) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: '缺少 projectId 参数' });
    }

    const statsData = await getProjectStatsData(req.user, projectId);
    const report = await analyzeProjectStats(statsData, req.user.id);
    res.json(success({ report, stats: statsData }));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ success: false, error: e.message });
    next(e);
  }
});

export default router;
