import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getProjects,
  getWorkItems,
  getMyself,
  getWorkItemTypes,
  getWorkItemStates,
  getWorkItemProperties,
  getWorkItemPriorities,
} from '../services/pingcode.js';
import { seekdbClient } from '../services/db.js';
import {
  WorkItemType,
  WorkItemState,
  WorkItemProperty,
  WorkItemPriority,
  SyncedProject,
  SyncedWorkItem,
} from '../models/index.js';
import { success } from '../utils/response.js';
import { appConfig } from '../config/index.js';

const router = express.Router();
const { syncWorkItemBatchSize, syncBatchDelayMs } = appConfig.seekdb;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** 确保元数据表有数据：无则拉取并入库 */
async function ensureMetadata(userId, accessToken, domain, projectList) {
  const count = await WorkItemType.count({ where: { user_id: userId } });
  if (count > 0) return;

  console.log('[Sync] 元数据表为空，开始获取并入库...');
  for (const proj of projectList) {
    await fetchAndStoreMetadataForProject(userId, accessToken, domain, proj.id);
  }
}

async function fetchAndStoreMetadataForProject(userId, accessToken, domain, projectId) {
  const typesRes = await getWorkItemTypes(accessToken, projectId, domain);
  const typeList = Array.isArray(typesRes) ? typesRes : (typesRes?.values || []);

  for (const t of typeList) {
    await WorkItemType.findOrCreate({
      where: { id: t.id, project_id: projectId, user_id: userId },
      defaults: { name: t.name || t.id, group: t.group || '' },
    });
  }

  for (const t of typeList) {
    const [statesRes, propsRes] = await Promise.all([
      getWorkItemStates(accessToken, projectId, t.id, domain),
      getWorkItemProperties(accessToken, projectId, t.id, domain),
    ]);
    const stateList = Array.isArray(statesRes) ? statesRes : (statesRes?.values || []);
    const propList = Array.isArray(propsRes) ? propsRes : (propsRes?.values || []);

    for (const s of stateList) {
      await WorkItemState.findOrCreate({
        where: {
          id: s.id,
          project_id: projectId,
          work_item_type_id: t.id,
          user_id: userId,
        },
        defaults: {
          name: s.name || '',
          type: s.type || '',
          color: s.color || '',
        },
      });
    }

    for (const p of propList) {
      await WorkItemProperty.findOrCreate({
        where: {
          id: p.id,
          project_id: projectId,
          work_item_type_id: t.id,
          user_id: userId,
        },
        defaults: {
          name: p.name || p.id,
          type: p.type || '',
          options: p.options || null,
        },
      });
    }
  }

  const prioRes = await getWorkItemPriorities(accessToken, projectId, domain);
  const prioList = Array.isArray(prioRes) ? prioRes : (prioRes?.values || []);
  for (const p of prioList) {
    await WorkItemPriority.findOrCreate({
      where: { id: p.id, project_id: projectId, user_id: userId },
      defaults: { name: p.name || p.id },
    });
  }
}

/** 同步 PingCode 项目和工作项（增量：仅新增入向量库与关系库） */
router.post('/sync-data', requireAuth, async (req, res, next) => {
  const user = req.user;
  const userId = user.id;
  const accessToken = user.access_token;
  const domain = user.domain;

  if (!accessToken) {
    return res.status(400).json({ success: false, error: '未连接 PingCode，请先完成授权' });
  }

  try {
    const myself = await getMyself(accessToken, domain);
    if (myself) {
      await user.update({
        pingcode_user_id: myself.id,
        pingcode_user_name: myself.name,
        pingcode_display_name: myself.display_name,
        pingcode_email: myself.email,
        pingcode_avatar: myself.avatar,
      });
    }

    const projectsRes = await getProjects(accessToken, domain);
    const projectList = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.values || []);

    await ensureMetadata(userId, accessToken, domain, projectList);

    const existingProjectRows = await SyncedProject.findAll({
      where: { user_id: userId },
      attributes: ['id'],
    });
    const existingProjectIds = new Set(existingProjectRows.map((r) => r.id));
    const newProjects = projectList.filter((p) => !existingProjectIds.has(p.id));

    const projectColl = await seekdbClient.getCollection({ name: 'projects' });

    if (newProjects.length > 0) {
      await SyncedProject.bulkCreate(
        newProjects.map((p) => ({
          id: p.id,
          user_id: userId,
          name: p.name,
          description: p.description || null,
        }))
      );
      await projectColl.upsert({
        ids: newProjects.map((p) => p.id),
        documents: newProjects.map(
          (p) => `Project: ${p.name}\nDescription: ${p.description || ''}`
        ),
        metadatas: newProjects.map((p) => ({ id: p.id, name: p.name })),
      });
      console.log(`[Sync] 新增 ${newProjects.length} 个项目`);
    }

    const existingWorkItemRows = await SyncedWorkItem.findAll({
      where: { user_id: userId },
      attributes: ['id'],
    });
    const existingWorkItemIds = new Set(existingWorkItemRows.map((r) => r.id));
    let totalNewItems = 0;
    const workItemColl = await seekdbClient.getCollection({ name: 'work_items' });

    for (const proj of projectList) {
      const itemsRes = await getWorkItems(accessToken, proj.id, domain);
      const itemList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.values || []);

      const newItems = itemList.filter((item) => !existingWorkItemIds.has(item.id));
      if (newItems.length === 0) continue;

      await SyncedWorkItem.bulkCreate(
        newItems.map((item) => ({
          id: item.id,
          user_id: userId,
          project_id: proj.id,
          title: item.title,
          identifier: item.identifier || null,
        }))
      );

      newItems.forEach((item) => existingWorkItemIds.add(item.id));
      totalNewItems += newItems.length;

      const batches = chunk(newItems, syncWorkItemBatchSize);
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        await workItemColl.upsert({
          ids: batch.map((item) => item.id),
          documents: batch.map(
            (item) => `Title: ${item.title}\nDescription: ${item.description || ''}`
          ),
          metadatas: batch.map((item) => ({
            id: item.id,
            project_id: proj.id,
            title: item.title,
          })),
        });
        if (i < batches.length - 1) await sleep(syncBatchDelayMs);
      }
    }

    if (totalNewItems > 0) {
      console.log(`[Sync] 新增 ${totalNewItems} 个工作项`);
    }

    const totalProjects = (existingProjectRows.length + newProjects.length);
    const totalWorkItems = existingWorkItemRows.length + totalNewItems;

    res.json(
      success(
        {
          projects: totalProjects,
          workItems: totalWorkItems,
          addedProjects: newProjects.length,
          addedWorkItems: totalNewItems,
        },
        '同步完成'
      )
    );
  } catch (e) {
    next(e);
  }
});

export default router;
