import { seekdbClient } from './db.js';
import { chunk } from '../utils/array.js';
import {
  SyncedProject,
  SyncedWorkItem,
  WorkItemType,
  WorkItemState,
  WorkItemProperty,
  WorkItemPriority,
} from '../models/index.js';

const SEEK_DELETE_BATCH = 200;

async function deleteSeekVectors(collectionName: string, compositeIds: string[]): Promise<void> {
  if (!compositeIds.length) return;
  const coll = await seekdbClient.getCollection({ name: collectionName });
  for (const batch of chunk(compositeIds, SEEK_DELETE_BATCH)) {
    await coll.delete({ ids: batch });
  }
}

export interface ClearSyncedResult {
  projects: number;
  workItems: number;
  types: number;
  states: number;
  properties: number;
  priorities: number;
}

/**
 * 清除当前用户从 PingCode 同步到本地的数据（关系表 + SeekDB 向量），不含导入记录。
 * 包括已标记归档（is_archived）的记录，即全量清除后下次同步可重建。
 */
export async function clearUserSyncedData(userId: string): Promise<ClearSyncedResult> {
  const [projRows, wiRows] = await Promise.all([
    SyncedProject.findAll({ where: { user_id: userId }, attributes: ['id'] }),
    SyncedWorkItem.findAll({ where: { user_id: userId }, attributes: ['id'] }),
  ]);

  const projectVecIds = projRows.map((r) => `${userId}_${r.id}`);
  const workItemVecIds = wiRows.map((r) => `${userId}_${r.id}`);

  await deleteSeekVectors('projects', projectVecIds);
  await deleteSeekVectors('work_items', workItemVecIds);

  const [
    deletedProjects,
    deletedWorkItems,
    deletedTypes,
    deletedStates,
    deletedProperties,
    deletedPriorities,
  ] = await Promise.all([
    SyncedProject.destroy({ where: { user_id: userId } }),
    SyncedWorkItem.destroy({ where: { user_id: userId } }),
    WorkItemType.destroy({ where: { user_id: userId } }),
    WorkItemState.destroy({ where: { user_id: userId } }),
    WorkItemProperty.destroy({ where: { user_id: userId } }),
    WorkItemPriority.destroy({ where: { user_id: userId } }),
  ]);

  return {
    projects: deletedProjects,
    workItems: deletedWorkItems,
    types: deletedTypes,
    states: deletedStates,
    properties: deletedProperties,
    priorities: deletedPriorities,
  };
}
