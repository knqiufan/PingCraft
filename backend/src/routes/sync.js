import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ensureFreshToken } from '../middleware/tokenRefresh.js';
import { getProjects, getWorkItems, getMyself } from '../services/pingcode.js';
import { seekdbClient } from '../services/db.js';
import { SyncedProject, SyncedWorkItem } from '../models/index.js';
import { success } from '../utils/response.js';
import { appConfig } from '../config/index.js';
import { chunk } from '../utils/array.js';
import { remoteUpdatedAt, needsUpdate } from '../utils/syncCompare.js';
import { ensureMetadata } from '../services/metadata.js';
import { clearUserSyncedData } from '../services/clearSyncedData.js';
import { invalidateStatsCache } from './stats.js';
import { logAudit } from '../services/auditLog.js';

const router = express.Router();
const { syncWorkItemBatchSize, syncBatchDelayMs } = appConfig.seekdb;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 增量同步 PingCode 项目和工作项到本地（关系表 + 向量库）。
 *
 * 同步策略（P1-3.4）：
 *   - 新增：本地不存在的工作项/项目入库
 *   - 更新：remote_updated_at 变化的项目/工作项，更新关系表并重新 upsert 向量
 *   - 软删除：PingCode 侧已不存在的本地记录，标记 is_archived = true 并从向量库移除
 */
router.post('/sync-data', requireAuth, ensureFreshToken, async (req, res, next) => {
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

    /* ---- 项目同步（新增 + 更新 + 软删除） ---- */
    const existingProjects = await SyncedProject.findAll({
      where: { user_id: userId },
    });
    const existingProjectMap = new Map(existingProjects.map((p) => [p.id, p]));
    const remoteProjectIds = new Set(projectList.map((p) => p.id));

    const newProjects = [];
    const updatedProjectIds = []; // 需要重新 upsert 向量的项目 ID
    const archivedProjectIds = []; // PingCode 侧已不存在的本地项目

    for (const p of projectList) {
      const existing = existingProjectMap.get(p.id);
      const remoteUpdated = remoteUpdatedAt(p);
      if (!existing) {
        newProjects.push(p);
      } else if (needsUpdate(existing, p, remoteUpdated)) {
        updatedProjectIds.push(p.id);
      }
    }
    // 软删除：本地有但 PingCode 侧已不存在的项目
    for (const existing of existingProjects) {
      if (!remoteProjectIds.has(existing.id) && !existing.is_archived) {
        archivedProjectIds.push(existing.id);
      }
    }

    const projectColl = await seekdbClient.getCollection({ name: 'projects' });

    // 新增项目
    if (newProjects.length > 0) {
      await SyncedProject.bulkCreate(
        newProjects.map((p) => ({
          id: p.id,
          user_id: userId,
          name: p.name,
          description: p.description || null,
          remote_updated_at: remoteUpdatedAt(p) || null,
        }))
      );
      await projectColl.upsert({
        ids: newProjects.map((p) => `${userId}_${p.id}`),
        documents: newProjects.map(
          (p) => `Project: ${p.name}\nDescription: ${p.description || ''}`
        ),
        metadatas: newProjects.map((p) => ({ id: p.id, name: p.name, user_id: userId })),
      });
    }

    // 更新已变更的项目（名称/描述/更新时间）
    if (updatedProjectIds.length > 0) {
      const toUpdate = projectList.filter((p) => updatedProjectIds.includes(p.id));
      for (const p of toUpdate) {
        await SyncedProject.update(
          {
            name: p.name,
            description: p.description || null,
            remote_updated_at: remoteUpdatedAt(p) || null,
            is_archived: false,
          },
          { where: { id: p.id, user_id: userId } }
        );
      }
      await projectColl.upsert({
        ids: toUpdate.map((p) => `${userId}_${p.id}`),
        documents: toUpdate.map(
          (p) => `Project: ${p.name}\nDescription: ${p.description || ''}`
        ),
        metadatas: toUpdate.map((p) => ({ id: p.id, name: p.name, user_id: userId })),
      });
    }

    // 软删除项目（标记 + 移除向量）
    if (archivedProjectIds.length > 0) {
      await SyncedProject.update(
        { is_archived: true },
        { where: { id: archivedProjectIds, user_id: userId } }
      );
      await projectColl.delete({
        ids: archivedProjectIds.map((id) => `${userId}_${id}`),
      });
    }

    console.log(
      `[Sync] 项目：+${newProjects.length} 新增，~${updatedProjectIds.length} 更新，×${archivedProjectIds.length} 归档`
    );

    /* ---- 工作项同步（新增 + 更新 + 软删除） ---- */
    const existingWorkItems = await SyncedWorkItem.findAll({
      where: { user_id: userId },
    });
    const existingWorkItemMap = new Map(existingWorkItems.map((w) => [w.id, w]));
    const workItemColl = await seekdbClient.getCollection({ name: 'work_items' });

    let totalNewItems = 0;
    let totalUpdatedItems = 0;
    const allRemoteWorkItemIds = new Set();
    const itemsToVector = []; // 需要重新 upsert 向量的工作项（新增 + 更新）

    // I3: 逐项目拉取，单个项目失败不影响其余项目的同步
    for (const proj of projectList) {
      let itemList;
      try {
        itemList = await getWorkItems(accessToken, proj.id, domain);
      } catch (projErr) {
        console.warn(`[Sync] 项目 ${proj.id} 工作项拉取失败，跳过:`, projErr.message);
        continue;
      }

      for (const item of itemList) {
        allRemoteWorkItemIds.add(item.id);
        const existing = existingWorkItemMap.get(item.id);
        const remoteUpdated = remoteUpdatedAt(item);

        if (!existing) {
          // 新增
          itemsToVector.push({ item, projId: proj.id, isNew: true });
        } else if (needsUpdate(existing, item, remoteUpdated)) {
          // 更新（标题/描述/更新时间变化，或归档项重新出现）
          itemsToVector.push({ item, projId: proj.id, isNew: false });
        }
      }
    }

    // 批量写入关系表（新增）和更新（变更）
    const newItems = itemsToVector.filter((x) => x.isNew).map((x) => x.item);
    const changedItems = itemsToVector.filter((x) => !x.isNew).map((x) => x.item);

    if (newItems.length > 0) {
      await SyncedWorkItem.bulkCreate(
        newItems.map((item) => {
          const projId = itemsToVector.find((x) => x.item === item)?.projId || item.project_id;
          return {
            id: item.id,
            user_id: userId,
            project_id: projId,
            title: item.title,
            description: item.description || null,
            identifier: item.identifier || null,
            remote_updated_at: remoteUpdatedAt(item) || null,
          };
        })
      );
      totalNewItems = newItems.length;
    }

    for (const item of changedItems) {
      const projId = itemsToVector.find((x) => x.item === item)?.projId || item.project_id;
      await SyncedWorkItem.update(
        {
          title: item.title,
          description: item.description || null,
          identifier: item.identifier || null,
          project_id: projId,
          remote_updated_at: remoteUpdatedAt(item) || null,
          is_archived: false,
        },
        { where: { id: item.id, user_id: userId } }
      );
    }
    totalUpdatedItems = changedItems.length;

    // 重新 upsert 向量（新增 + 变更）
    if (itemsToVector.length > 0) {
      const batches = chunk(itemsToVector, syncWorkItemBatchSize);
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        await workItemColl.upsert({
          ids: batch.map((x) => `${userId}_${x.item.id}`),
          documents: batch.map(
            (x) => `Title: ${x.item.title}\nDescription: ${x.item.description || ''}`
          ),
          metadatas: batch.map((x) => ({
            id: x.item.id,
            project_id: x.projId,
            title: x.item.title,
            user_id: userId,
          })),
        });
        if (i < batches.length - 1) await sleep(syncBatchDelayMs);
      }
    }

    // 软删除：本地有但 PingCode 侧已不存在的工作项
    const archivedWorkItemIds = [];
    for (const existing of existingWorkItems) {
      if (!allRemoteWorkItemIds.has(existing.id) && !existing.is_archived) {
        archivedWorkItemIds.push(existing.id);
      }
    }
    if (archivedWorkItemIds.length > 0) {
      await SyncedWorkItem.update(
        { is_archived: true },
        { where: { id: archivedWorkItemIds, user_id: userId } }
      );
      // 从向量库移除
      const vecIds = chunk(archivedWorkItemIds, 200).map((batch) =>
        batch.map((id) => `${userId}_${id}`)
      );
      for (const batchIds of vecIds) {
        await workItemColl.delete({ ids: batchIds });
      }
    }

    if (totalNewItems > 0 || totalUpdatedItems > 0 || archivedWorkItemIds.length > 0) {
      console.log(
        `[Sync] 工作项：+${totalNewItems} 新增，~${totalUpdatedItems} 更新，×${archivedWorkItemIds.length} 归档`
      );
    }

    // I1: 修复 totalProjects 重复计入 updated 项目（updated 项目已在 existingProjects 非归档计数中）
    const totalProjects = existingProjects.filter((p) => !p.is_archived).length +
      newProjects.length - archivedProjectIds.length;
    const activeWorkItems = existingWorkItems.filter((w) => !w.is_archived).length;
    const totalWorkItems = activeWorkItems + totalNewItems - archivedWorkItemIds.length;

    // 同步后清除该用户的统计缓存（数据已变更）
    invalidateStatsCache(userId);

    res.json(
      success(
        {
          projects: Math.max(0, totalProjects),
          workItems: Math.max(0, totalWorkItems),
          addedProjects: newProjects.length,
          addedWorkItems: totalNewItems,
          updatedWorkItems: totalUpdatedItems,
          archivedProjects: archivedProjectIds.length,
          archivedWorkItems: archivedWorkItemIds.length,
        },
        '同步完成'
      )
    );
  } catch (e) {
    next(e);
  }
});

/** 清除当前用户从 PingCode 同步到本地的数据（不含导入记录） */
router.delete('/sync-data', requireAuth, async (req, res, next) => {
  try {
    const result = await clearUserSyncedData(req.user.id);
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: 'CLEAR_SYNC_DATA',
      resource: 'sync-data',
      detail: result,
    });
    invalidateStatsCache(req.user.id);
    res.json(success(result, '已清除本地同步数据'));
  } catch (e) {
    next(e);
  }
});

export default router;
