import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { seekdbClient } from '../services/db.js';
import {
  createWorkItemsBatch,
  createProject,
  getProjects,
} from '../services/pingcode.js';
import { success } from '../utils/response.js';

const router = express.Router();

/**
 * 生成项目标识符（identifier）
 * 规则：大写字母/数字/下划线/连接线，不超过15字符
 */
function generateProjectIdentifier(projectName) {
  // 移除特殊字符，保留字母、数字、空格
  const cleaned = projectName
    .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
    .trim();
  
  // 如果是中文名称，取拼音首字母或使用时间戳
  const hasChineseChar = /[\u4e00-\u9fa5]/.test(cleaned);
  if (hasChineseChar) {
    // 简单处理：使用 PRJ + 时间戳后6位
    const timestamp = Date.now().toString().slice(-6);
    return `PRJ${timestamp}`;
  }
  
  // 英文名称：取首字母大写，最多15字符
  const identifier = cleaned
    .toUpperCase()
    .replace(/\s+/g, '_')
    .slice(0, 15);
  
  return identifier || `PRJ${Date.now().toString().slice(-6)}`;
}

/**
 * 将 ISO 日期字符串或 Date 转换为 Unix 时间戳（秒）
 */
function toUnixTimestamp(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'number') {
    // 如果已经是时间戳，检查是毫秒还是秒
    return dateInput > 9999999999 ? Math.floor(dateInput / 1000) : dateInput;
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

/** 匹配最相似的项目 */
router.post('/match-project', requireAuth, async (req, res, next) => {
  const { requirements } = req.body;
  if (!requirements || !requirements.length) {
    return res.status(400).json({ success: false, error: '请提供需求列表' });
  }

  try {
    const projectColl = await seekdbClient.getCollection({ name: 'projects' });
    
    // 提取所有唯一的项目名称
    const uniqueProjectNames = [...new Set(requirements.map(r => r.project_name))];
    
    // 为每个项目名称匹配最相似的 PingCode 项目
    const allMatches = [];
    for (const projectName of uniqueProjectNames) {
      const results = await projectColl.query({
        queryTexts: [projectName],
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
router.post('/check-duplicates', requireAuth, async (req, res, next) => {
  const { items, projectId } = req.body;
  if (!items || !items.length || !projectId) {
    return res.status(400).json({ success: false, error: '参数不完整' });
  }

  try {
    const workItemColl = await seekdbClient.getCollection({ name: 'work_items' });

    const checkedItems = [];
    for (const item of items) {
      const results = await workItemColl.query({
        queryTexts: [item.title],
        where: { project_id: projectId },
        nResults: 1,
      });

      let match = null;
      if (results.ids[0].length > 0) {
        match = {
          id: results.ids[0][0],
          title: results.metadatas[0][0].title,
        };
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
router.post('/import', requireAuth, async (req, res, next) => {
  const { items, projectId, autoCreateProject = true } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ success: false, error: '请提供工作项列表' });
  }

  const { access_token, domain, pingcode_user_id } = req.user;

  try {
    // 获取现有项目列表用于匹配
    const projectsRes = await getProjects(access_token, domain);
    const existingProjects = Array.isArray(projectsRes)
      ? projectsRes
      : (projectsRes?.values || []);
    const projectMap = new Map(existingProjects.map((p) => [p.id, p]));
    const projectNameMap = new Map(
      existingProjects.map((p) => [p.name.toLowerCase(), p])
    );

    // 按项目分组工作项
    const itemsByProject = new Map();
    for (const item of items) {
      const key = projectId || item.project_name || '未分类项目';
      if (!itemsByProject.has(key)) {
        itemsByProject.set(key, []);
      }
      itemsByProject.get(key).push(item);
    }

    const results = { success: 0, failed: 0, errors: [], createdProjects: [] };

    for (const [projectKey, projectItems] of itemsByProject) {
      let targetProjectId = null;

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
              domain
            );
            targetProjectId = newProject.id;
            results.createdProjects.push({
              id: newProject.id,
              name: newProject.name,
            });
            console.log(`[Import] 自动创建项目: ${newProject.name} (${newProject.id})`);
          } catch (createErr) {
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

      // 构建 PingCode API 所需的工作项数据
      const pingcodeItems = projectItems.map((i) => {
        const payload = {
          project_id: targetProjectId,
          title: i.title,
          // type_id 是必填字段，默认使用 story
          type_id: i.type_id || 'story',
        };

        // 可选字段
        if (i.description) payload.description = i.description;
        if (i.priority_id) payload.priority_id = i.priority_id;
        if (i.state_id) payload.state_id = i.state_id;

        // 负责人：优先使用传入的，否则使用当前用户
        if (i.assignee_id || pingcode_user_id) {
          payload.assignee_id = i.assignee_id || pingcode_user_id;
        }

        // 时间字段：转换为 Unix 时间戳（秒）
        const startAt = toUnixTimestamp(i.start_at);
        if (startAt) payload.start_at = startAt;

        const endAt = toUnixTimestamp(i.end_at);
        if (endAt) payload.end_at = endAt;

        // 预估工时（PingCode 使用 estimated_workload 字段）
        if (typeof i.estimated_hours === 'number' && i.estimated_hours > 0) {
          payload.estimated_workload = i.estimated_hours;
        }

        // 自定义属性
        if (i.properties && Object.keys(i.properties).length > 0) {
          payload.properties = i.properties;
        }

        return payload;
      });

      // 批量创建工作项
      const batchResult = await createWorkItemsBatch(
        access_token,
        pingcodeItems,
        domain
      );
      results.success += batchResult.success;
      results.failed += batchResult.failed;
      results.errors.push(...batchResult.errors);
    }

    res.json(success({ result: results }, '导入完成'));
  } catch (e) {
    next(e);
  }
});

export default router;
