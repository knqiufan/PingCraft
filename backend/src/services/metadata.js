import {
  getWorkItemTypes,
  getWorkItemStates,
  getWorkItemProperties,
  getWorkItemPriorities,
} from './pingcode.js';
import {
  WorkItemType,
  WorkItemState,
  WorkItemProperty,
  WorkItemPriority,
} from '../models/index.js';

const CONCURRENCY_LIMIT = 3;

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let index = 0;

  async function runNext() {
    const i = index++;
    if (i >= tasks.length) return;
    results[i] = await tasks[i]();
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => runNext()));
  return results;
}

/**
 * 拉取并存储单个项目的全部元数据（types / states / properties / priorities）
 * 支持增量写入：已存在的记录会被跳过
 */
export async function fetchAndStoreMetadataForProject(
  userId, accessToken, domain, projectId,
  existingTypeIds = new Set(),
  existingStateIds = new Set(),
  existingPropertyIds = new Set(),
  existingPriorityIds = new Set()
) {
  const counts = { types: 0, states: 0, properties: 0, priorities: 0 };

  const typesRes = await getWorkItemTypes(accessToken, projectId, domain);
  const typeList = Array.isArray(typesRes) ? typesRes : (typesRes?.values || []);

  const newTypes = typeList.filter(t => !existingTypeIds.has(`${projectId}:${t.id}`));
  if (newTypes.length > 0) {
    await WorkItemType.bulkCreate(
      newTypes.map(t => ({
        id: t.id, project_id: projectId, user_id: userId,
        name: t.name || t.id, group: t.group || '',
      })),
      { ignoreDuplicates: true }
    );
    newTypes.forEach(t => existingTypeIds.add(`${projectId}:${t.id}`));
    counts.types = newTypes.length;
  }

  const statesBatch = [];
  const propsBatch = [];

  await Promise.all(typeList.map(async (t) => {
    const [statesRes, propsRes] = await Promise.all([
      getWorkItemStates(accessToken, projectId, t.id, domain),
      getWorkItemProperties(accessToken, projectId, t.id, domain),
    ]);
    const stateList = Array.isArray(statesRes) ? statesRes : (statesRes?.values || []);
    const propList = Array.isArray(propsRes) ? propsRes : (propsRes?.values || []);

    for (const s of stateList) {
      const key = `${projectId}:${t.id}:${s.id}`;
      if (existingStateIds.has(key)) continue;
      statesBatch.push({
        id: s.id, project_id: projectId, work_item_type_id: t.id,
        user_id: userId, name: s.name || '', type: s.type || '', color: s.color || '',
      });
      existingStateIds.add(key);
    }

    for (const p of propList) {
      const key = `${projectId}:${t.id}:${p.id}`;
      if (existingPropertyIds.has(key)) continue;
      propsBatch.push({
        id: p.id, project_id: projectId, work_item_type_id: t.id,
        user_id: userId, name: p.name || p.id, type: p.type || '',
        options: p.options || null,
      });
      existingPropertyIds.add(key);
    }
  }));

  if (statesBatch.length > 0) {
    await WorkItemState.bulkCreate(statesBatch, { ignoreDuplicates: true });
    counts.states = statesBatch.length;
  }
  if (propsBatch.length > 0) {
    await WorkItemProperty.bulkCreate(propsBatch, { ignoreDuplicates: true });
    counts.properties = propsBatch.length;
  }

  const prioRes = await getWorkItemPriorities(accessToken, projectId, domain);
  const prioList = Array.isArray(prioRes) ? prioRes : (prioRes?.values || []);
  const newPrios = prioList.filter(p => !existingPriorityIds.has(`${projectId}:${p.id}`));
  if (newPrios.length > 0) {
    await WorkItemPriority.bulkCreate(
      newPrios.map(p => ({
        id: p.id, project_id: projectId, user_id: userId, name: p.name || p.id,
      })),
      { ignoreDuplicates: true }
    );
    newPrios.forEach(p => existingPriorityIds.add(`${projectId}:${p.id}`));
    counts.priorities = newPrios.length;
  }

  return counts;
}

/**
 * 批量确保多个项目的元数据（增量同步）
 */
export async function ensureMetadata(userId, accessToken, domain, projectList) {
  console.log('[Sync] 开始增量同步元数据...');

  const [existingTypes, existingStates, existingProperties, existingPriorities] = await Promise.all([
    WorkItemType.findAll({ where: { user_id: userId }, attributes: ['id', 'project_id'] }),
    WorkItemState.findAll({ where: { user_id: userId }, attributes: ['id', 'project_id', 'work_item_type_id'] }),
    WorkItemProperty.findAll({ where: { user_id: userId }, attributes: ['id', 'project_id', 'work_item_type_id'] }),
    WorkItemPriority.findAll({ where: { user_id: userId }, attributes: ['id', 'project_id'] }),
  ]);

  const existingTypeIds = new Set(existingTypes.map(t => `${t.project_id}:${t.id}`));
  const existingStateIds = new Set(existingStates.map(s => `${s.project_id}:${s.work_item_type_id}:${s.id}`));
  const existingPropertyIds = new Set(existingProperties.map(p => `${p.project_id}:${p.work_item_type_id}:${p.id}`));
  const existingPriorityIds = new Set(existingPriorities.map(p => `${p.project_id}:${p.id}`));

  const tasks = projectList.map((proj) => () =>
    fetchAndStoreMetadataForProject(
      userId, accessToken, domain, proj.id,
      existingTypeIds, existingStateIds, existingPropertyIds, existingPriorityIds,
    )
  );

  const allCounts = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
  const totals = allCounts.reduce(
    (acc, c) => ({
      types: acc.types + (c?.types || 0),
      states: acc.states + (c?.states || 0),
      properties: acc.properties + (c?.properties || 0),
      priorities: acc.priorities + (c?.priorities || 0),
    }),
    { types: 0, states: 0, properties: 0, priorities: 0 }
  );

  console.log(`[Sync] 元数据增量同步完成：+${totals.types} types, +${totals.states} states, +${totals.properties} properties, +${totals.priorities} priorities`);
}
