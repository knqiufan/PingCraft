import express from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ensureFreshToken } from '../middleware/tokenRefresh.js';
import type { AuthedRequest } from '../types/authRequest.js';
import { seekdbClient } from '../services/db.js';
import {
  createWorkItemsBatch,
  createProject,
  getProjects,
  updateWorkItem,
} from '../services/pingcode.js';
import { ImportRecord, ImportRecordItem, WorkItemType, WorkItemPriority } from '../models/index.js';
import type { ImportRecordStatus } from '../models/ImportRecord.js';
import { success } from '../utils/response.js';
import { generateProjectIdentifier, toUnixTimestamp, resolveTypeId, resolvePriorityId } from '../utils/workItem.js';
import { fetchAndStoreMetadataForProject } from '../services/metadata.js';
import { buildImportPayload, getProjectMembersCached } from '../services/importHelper.js';
import { invalidateStatsCache } from './stats.js';

const router = express.Router();

/**
 * 根据项目元数据构建 type name -> type id 映射表
 * 允许通过 name（如 "story"）或 group（如 "story"）查找真实 UUID
 */
async function buildTypeNameMap(userId: string, projectId: string): Promise<Map<string, string>> {
  const types = await WorkItemType.findAll({
    where: { user_id: userId, project_id: projectId },
    attributes: ['id', 'name', 'group'],
  });
  const map = new Map<string, string>();
  for (const t of types) {
    if (t.name) map.set(t.name.toLowerCase(), t.id);
    if (t.group) map.set(t.group.toLowerCase(), t.id);
  }
  return map;
}

/**
 * 根据项目元数据构建 priority name -> priority id 映射表
 * 支持中英文匹配（如 "High" -> "高"，"Medium" -> "中"，"Low" -> "低"）
 */
async function buildPriorityNameMap(userId: string, projectId: string): Promise<Map<string, string>> {
  const priorities = await WorkItemPriority.findAll({
    where: { user_id: userId, project_id: projectId },
    attributes: ['id', 'name'],
  });
  const map = new Map<string, string>();
  const aliasMap: Record<string, string[]> = {
    high: ['高', '紧急', 'urgent', 'critical', 'high'],
    medium: ['中', '普通', 'normal', 'medium'],
    low: ['低', 'low', 'minor'],
  };
  for (const p of priorities) {
    if (p.name) {
      map.set(p.name.toLowerCase(), p.id);
      for (const [level, aliases] of Object.entries(aliasMap)) {
        if (aliases.includes(p.name.toLowerCase()) || aliases.includes(p.name)) {
          map.set(level, p.id);
        }
      }
    }
  }
  return map;
}

/** 导入结果聚合 */
interface ImportResults {
  success: number;
  failed: number;
  errors: any[];
  createdProjects: Array<{ id: string; name: string }>;
}

/** 匹配最相似的项目 */
router.post('/match-project', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const { requirements } = req.body;
  if (!requirements || !requirements.length) {
    return res.status(400).json({ success: false, error: '请提供需求列表' });
  }

  try {
    const projectColl = await seekdbClient.getCollection({ name: 'projects' });
    const userId = req.user!.id;

    // 提取所有唯一的项目名称
    const uniqueProjectNames: string[] = [...new Set((requirements as any[]).map((r: any) => r.project_name))];

    // 为每个项目名称匹配最相似的 PingCode 项目
    const allMatches: any[] = [];
    for (const projectName of uniqueProjectNames) {
      const results: any = await projectColl.query({
        queryTexts: [projectName],
        where: { user_id: userId },
        nResults: 3,
      });

      if (results.ids[0].length > 0) {
        const topMatch = {
          id: results.ids[0][0],
          name: results.metadatas[0][0].name,
          score: results.distances ? results.distances[0][0] : 0,
          suggestedName: projectName,
        };
        allMatches.push(topMatch);
      }
    }

    // 按匹配度排序，返回前 5 个
    const matches = allMatches
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    res.json(success({ matches, projectNames: uniqueProjectNames }, '项目匹配完成'));
  } catch (e) {
    next(e);
  }
});

/** 检查重复工作项 */
router.post('/check-duplicates', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const { items, projectId } = req.body;
  if (!items || !items.length || !projectId) {
    return res.status(400).json({ success: false, error: '参数不完整' });
  }

  try {
    const workItemColl = await seekdbClient.getCollection({ name: 'work_items' });
    const userId = req.user!.id;

    // 查重相似度阈值（P3-5.14）：低于此分数的匹配视为无重复，可通过 DUPLICATE_SIMILARITY_THRESHOLD 配置
    const similarityThreshold = parseFloat(process.env.DUPLICATE_SIMILARITY_THRESHOLD || '0.75');

    const checkedItems: any[] = [];
    for (const item of items) {
      const results: any = await workItemColl.query({
        queryTexts: [item.title],
        where: { $and: [{ project_id: projectId }, { user_id: userId }] },
        nResults: 1,
      });

      let match = null;
      if (results.ids[0].length > 0) {
        // SeekDB 返回的是距离，需要转换为相似度分数
        // 距离范围通常是 0-2，值越小越相似
        // 转换为相似度：1 - (distance / 2)
        const distance = results.distances?.[0]?.[0] || 0;
        const score = Math.max(0, 1 - (distance / 2));

        // 仅当相似度达到阈值时才视为重复匹配
        if (score >= similarityThreshold) {
          match = {
            id: results.ids[0][0],
            title: results.metadatas[0][0].title,
            score: score, // 添加相似度分数
          };
        }
      }

      checkedItems.push({ ...item, match });
    }

    res.json(success({ items: checkedItems }, '去重检查完成'));
  } catch (e) {
    next(e);
  }
});

/**
 * 批量导入工作项到 PingCode
 *
 * 逻辑：
 * 1. 如果提供了 projectId，直接使用该项目
 * 2. 如果未提供 projectId 或项目不存在，尝试按 project_name 查找或创建项目
 * 3. 构建符合 PingCode API 的工作项数据（必填 type_id，时间戳格式等）
 */
router.post('/import', requireAuth, ensureFreshToken, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const { items, projectId, autoCreateProject = true } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ success: false, error: '请提供工作项列表' });
  }

  const { access_token, domain, pingcode_user_id } = req.user!;

  try {
    // 校验 record_id 归属当前用户
    let recordBelongsToUser = false;
    if (req.body.record_id) {
      const record = await ImportRecord.findOne({
        where: { id: req.body.record_id, user_id: req.user!.id },
        attributes: ['id'],
      });
      recordBelongsToUser = !!record;
      if (!record) {
        console.warn(`[Import] record_id ${req.body.record_id} 不属于用户 ${req.user!.id}，将跳过记录更新`);
      }
    }

    // 获取现有项目列表用于匹配
    const projectsRes = await getProjects(access_token, domain);
    const existingProjects: any[] = Array.isArray(projectsRes)
      ? projectsRes
      : (projectsRes?.values || []);
    const projectMap = new Map(existingProjects.map((p) => [p.id, p]));
    const projectNameMap = new Map(
      existingProjects.map((p) => [p.name.toLowerCase(), p]),
    );

    // 按项目分组工作项
    const itemsByProject = new Map<string, any[]>();
    for (const item of items) {
      const key = projectId || item.project_name || '未分类项目';
      if (!itemsByProject.has(key)) {
        itemsByProject.set(key, []);
      }
      itemsByProject.get(key)!.push(item);
    }

    const results: ImportResults = { success: 0, failed: 0, errors: [], createdProjects: [] };
    // 项目成员缓存（projectId → members[]），同一次导入内复用
    const membersCache = new Map<string, any[]>();

    for (const [projectKey, projectItems] of itemsByProject) {
      let targetProjectId: string | null = null;

      // 情况1：直接使用传入的 projectId
      if (projectId && projectMap.has(projectId)) {
        targetProjectId = projectId;
      }
      // 情况2：按名称查找现有项目
      else {
        const existingProject = projectNameMap.get(projectKey.toLowerCase());
        if (existingProject) {
          targetProjectId = existingProject.id;
        }
        // 情况3：自动创建新项目
        else if (autoCreateProject) {
          try {
            const newProject = await createProject(
              access_token,
              {
                name: projectKey,
                type: 'scrum', // 默认使用 scrum 类型
                identifier: generateProjectIdentifier(projectKey),
                description: `由需求分析工具自动创建`,
                assignee_id: pingcode_user_id || undefined,
              },
              domain,
            );
            targetProjectId = newProject.id;
            results.createdProjects.push({
              id: newProject.id,
              name: newProject.name,
            });
            console.log(`[Import] 自动创建项目: ${newProject.name} (${newProject.id})`);

            // 为新项目拉取并存储元数据，确保后续 type_id / priority_id 能正确解析
            const metaCounts = await fetchAndStoreMetadataForProject(
              req.user!.id, access_token, domain, targetProjectId,
            );
            console.log(`[Import] 新项目元数据同步: +${metaCounts.types} types, +${metaCounts.priorities} priorities`);
          } catch (createErr: any) {
            const errMsg = createErr.response?.data?.message || createErr.message;
            console.error(`[Import] 创建项目失败: ${projectKey}`, errMsg);
            // 项目创建失败，该分组的所有工作项都标记为失败
            for (const item of projectItems) {
              results.failed++;
              results.errors.push({
                item: item.title,
                error: `项目创建失败: ${errMsg}`,
              });
            }
            continue;
          }
        } else {
          // 不自动创建，标记失败
          for (const item of projectItems) {
            results.failed++;
            results.errors.push({
              item: item.title,
              error: `项目 "${projectKey}" 不存在且未启用自动创建`,
            });
          }
          continue;
        }
      }

      // 查询项目元数据，建立 name -> id 映射表
      const typeNameMap = await buildTypeNameMap(req.user!.id, targetProjectId!);
      const priorityNameMap = await buildPriorityNameMap(req.user!.id, targetProjectId!);
      // 拉取项目成员用于负责人姓名解析（同一项目只拉一次）
      const members = await getProjectMembersCached(access_token, targetProjectId!, domain, membersCache);

      // 构建 PingCode API 所需的工作项数据（公共逻辑集中在 importHelper.buildImportPayload）
      const pingcodeItems = projectItems.map((i) => {
        const resolvedTypeId = resolveTypeId(i.type_id, typeNameMap);
        const resolvedPriorityId = resolvePriorityId(i.priority_id, i.priority, priorityNameMap);
        return buildImportPayload(i, {
          targetProjectId: targetProjectId!,
          resolvedTypeId,
          resolvedPriorityId,
          members,
          pingcodeUserId: pingcode_user_id,
        });
      });

      // 批量创建工作项
      const batchResult = await createWorkItemsBatch(
        access_token,
        pingcodeItems,
        domain,
      );
      results.success += batchResult.success;
      results.failed += batchResult.failed;
      results.errors.push(...batchResult.errors);

      // 更新导入明细状态（如果提供了 record_id）
      if (req.body.record_id && recordBelongsToUser) {
        for (const created of batchResult.created || []) {
          if (created.local_id) {
            await ImportRecordItem.update(
              {
                status: 'success',
                pingcode_id: created.pingcode_id,
                pingcode_identifier: created.pingcode_identifier,
              },
              { where: { id: created.local_id, record_id: req.body.record_id } },
            ).catch((err: any) => {
              console.error('[Import] 更新明细状态失败:', err.message);
            });
          }
        }

        for (const error of batchResult.errors || []) {
          if (error.local_id) {
            await ImportRecordItem.update(
              {
                status: 'failed',
                error_message: error.error,
              },
              { where: { id: error.local_id, record_id: req.body.record_id } },
            ).catch((err: any) => {
              console.error('[Import] 更新明细状态失败:', err.message);
            });
          }
        }
      }
    }

    // 更新导入记录（如果提供了 record_id 且归属当前用户）
    if (req.body.record_id && recordBelongsToUser) {
      try {
        let finalStatus: ImportRecordStatus = 'success';
        if (results.failed > 0 && results.success > 0) {
          finalStatus = 'partial_success';
        } else if (results.failed > 0 && results.success === 0) {
          finalStatus = 'failed';
        }

        await ImportRecord.update(
          {
            imported_count: results.success,
            failed_count: results.failed,
            status: finalStatus,
            error_message: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
          },
          { where: { id: req.body.record_id, user_id: req.user!.id } },
        );
      } catch (err: any) {
        console.error('[Import] 更新导入记录失败:', err.message);
      }
    }

    // 导入后清除统计缓存（数据已变更，A1）
    invalidateStatsCache(req.user!.id);

    res.json(success({ result: results }, '导入完成'));
  } catch (e) {
    next(e);
  }
});

/** SSE 导入：实时推送导入进度 */
router.post('/import-stream', requireAuth, ensureFreshToken, async (req: AuthedRequest, res: Response) => {
  const { items, projectId, autoCreateProject = true, record_id } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ success: false, error: '请提供工作项列表' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  function sendEvent(event: string, data: any): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const { access_token, domain, pingcode_user_id } = req.user!;

  try {
    let recordBelongsToUser = false;
    if (record_id) {
      const record = await ImportRecord.findOne({
        where: { id: record_id, user_id: req.user!.id },
        attributes: ['id'],
      });
      recordBelongsToUser = !!record;
    }

    const projectsRes = await getProjects(access_token, domain);
    const existingProjects: any[] = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.values || []);
    const projectMap = new Map(existingProjects.map((p) => [p.id, p]));
    const projectNameMap = new Map(existingProjects.map((p) => [p.name.toLowerCase(), p]));

    const itemsByProject = new Map<string, any[]>();
    for (const item of items) {
      const key = projectId || item.project_name || '未分类项目';
      if (!itemsByProject.has(key)) itemsByProject.set(key, []);
      itemsByProject.get(key)!.push(item);
    }

    const results: ImportResults = { success: 0, failed: 0, errors: [], createdProjects: [] };
    const totalItems = items.length;
    let processedItems = 0;
    // 项目成员缓存（projectId → members[]），同一次导入内复用
    const membersCache = new Map<string, any[]>();

    sendEvent('start', { total: totalItems });

    for (const [projectKey, projectItems] of itemsByProject) {
      let targetProjectId: string | null = null;

      if (projectId && projectMap.has(projectId)) {
        targetProjectId = projectId;
      } else {
        const existing = projectNameMap.get(projectKey.toLowerCase());
        if (existing) {
          targetProjectId = existing.id;
        } else if (autoCreateProject) {
          try {
            const newProject = await createProject(access_token, {
              name: projectKey,
              type: 'scrum',
              identifier: generateProjectIdentifier(projectKey),
              description: '由需求分析工具自动创建',
              assignee_id: pingcode_user_id || undefined,
            }, domain);
            targetProjectId = newProject.id;
            results.createdProjects.push({ id: newProject.id, name: newProject.name });
            sendEvent('project_created', { name: newProject.name });

            const metaCounts = await fetchAndStoreMetadataForProject(
              req.user!.id, access_token, domain, targetProjectId,
            );
            console.log(`[Import-Stream] 新项目元数据同步: +${metaCounts.types} types, +${metaCounts.priorities} priorities`);
          } catch (err: any) {
            const errMsg = err.response?.data?.message || err.message;
            for (const item of projectItems) {
              results.failed++;
              processedItems++;
              sendEvent('progress', {
                current: processedItems, total: totalItems,
                title: item.title, status: 'failed', error: `项目创建失败: ${errMsg}`,
              });
            }
            continue;
          }
        } else {
          for (const item of projectItems) {
            results.failed++;
            processedItems++;
            sendEvent('progress', {
              current: processedItems, total: totalItems,
              title: item.title, status: 'failed', error: `项目不存在`,
            });
          }
          continue;
        }
      }

      const typeNameMap = await buildTypeNameMap(req.user!.id, targetProjectId!);
      const priorityNameMap = await buildPriorityNameMap(req.user!.id, targetProjectId!);
      const members = await getProjectMembersCached(access_token, targetProjectId!, domain, membersCache);

      const pingcodeItems = projectItems.map((i) => {
        const resolvedTypeId = resolveTypeId(i.type_id, typeNameMap);
        const resolvedPriorityId = resolvePriorityId(i.priority_id, i.priority, priorityNameMap);
        return buildImportPayload(i, {
          targetProjectId: targetProjectId!,
          resolvedTypeId,
          resolvedPriorityId,
          members,
          pingcodeUserId: pingcode_user_id,
        });
      });

      const batchResult = await createWorkItemsBatch(
        access_token, pingcodeItems, domain,
        (current, total, itemInfo) => {
          processedItems++;
          sendEvent('progress', {
            current: processedItems, total: totalItems,
            title: itemInfo.title, status: itemInfo.status,
            error: itemInfo.error || null,
          });
        },
      );
      results.success += batchResult.success;
      results.failed += batchResult.failed;
      results.errors.push(...batchResult.errors);

      if (record_id && recordBelongsToUser) {
        for (const created of batchResult.created || []) {
          if (created.local_id) {
            await ImportRecordItem.update(
              { status: 'success', pingcode_id: created.pingcode_id, pingcode_identifier: created.pingcode_identifier },
              { where: { id: created.local_id, record_id } },
            ).catch(() => {});
          }
        }
        for (const error of batchResult.errors || []) {
          if (error.local_id) {
            await ImportRecordItem.update(
              { status: 'failed', error_message: error.error },
              { where: { id: error.local_id, record_id } },
            ).catch(() => {});
          }
        }
      }
    }

    if (record_id && recordBelongsToUser) {
      let finalStatus: ImportRecordStatus = 'success';
      if (results.failed > 0 && results.success > 0) finalStatus = 'partial_success';
      else if (results.failed > 0 && results.success === 0) finalStatus = 'failed';

      await ImportRecord.update(
        {
          imported_count: results.success, failed_count: results.failed,
          status: finalStatus,
          error_message: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        },
        { where: { id: record_id, user_id: req.user!.id } },
      ).catch(() => {});
    }

    // 导入后清除统计缓存（数据已变更，A1）
    invalidateStatsCache(req.user!.id);

    sendEvent('complete', { result: results });
    res.end();
  } catch (e: any) {
    sendEvent('error', { message: e.message });
    res.end();
  }
});

/**
 * 更新单个 PingCode 工作项（P3-5.2：工作项更新/编辑能力）。
 * 支持 PATCH 语义：仅传入需要更新的字段。
 */
router.patch('/work-items/:id', requireAuth, ensureFreshToken, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params as { id: string };
  if (!id) {
    return res.status(400).json({ success: false, error: '缺少工作项 ID' });
  }

  const allowedFields = [
    'title', 'description', 'state_id', 'priority_id', 'assignee_id',
    'start_at', 'end_at', 'estimated_workload', 'parent_id',
  ];
  const updateData: Record<string, any> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ success: false, error: '未提供可更新的字段' });
  }

  // 时间字段转换为 Unix 时间戳
  if (updateData.start_at !== undefined) {
    updateData.start_at = toUnixTimestamp(updateData.start_at);
  }
  if (updateData.end_at !== undefined) {
    updateData.end_at = toUnixTimestamp(updateData.end_at);
  }

  try {
    const { access_token, domain } = req.user!;
    const result = await updateWorkItem(access_token, id, updateData, domain);
    res.json(success(result, '更新成功'));
  } catch (e: any) {
    const status = e.response?.status || 500;
    const message = e.response?.data?.message || e.message;
    res.status(status).json({ success: false, error: message });
  }
});

export default router;
