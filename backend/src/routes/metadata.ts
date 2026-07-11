import express from 'express';
import type { Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/auth.js';
import type { AuthedRequest } from '../types/authRequest.js';
import {
  WorkItemType,
  WorkItemState,
  WorkItemProperty,
  WorkItemPriority,
  SyncedProject,
  SyncedWorkItem,
} from '../models/index.js';
import { success } from '../utils/response.js';

const router = express.Router();

// 获取项目名称映射的辅助函数
async function getProjectNameMap(userId: string, projectIds: string[]): Promise<Map<string, string>> {
  if (!projectIds || projectIds.length === 0) return new Map();

  const projects = await SyncedProject.findAll({
    where: {
      user_id: userId,
      id: { [Op.in]: projectIds },
    },
    attributes: ['id', 'name'],
  });

  return new Map(projects.map((p) => [p.id, p.name]));
}

// 为结果添加项目名称
async function enrichWithProjectName(
  userId: string,
  items: any[],
  projectIdField = 'project_id',
): Promise<any[]> {
  const projectIds = [...new Set(items.map((item) => item[projectIdField]))];
  const nameMap = await getProjectNameMap(userId, projectIds);

  return items.map((item) => ({
    ...item.toJSON(),
    project_name: nameMap.get(item[projectIdField]) || item[projectIdField],
  }));
}

router.get('/types', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id as string | undefined;
    const where: Record<string, any> = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemType.findAll({ where, order: [['id', 'ASC']] });
    const enrichedList = await enrichWithProjectName(userId, list);
    res.json(success(enrichedList));
  } catch (e) {
    next(e);
  }
});

router.get('/states', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id as string | undefined;
    const where: Record<string, any> = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemState.findAll({ where, order: [['id', 'ASC']] });
    const enrichedList = await enrichWithProjectName(userId, list);
    res.json(success(enrichedList));
  } catch (e) {
    next(e);
  }
});

router.get('/properties', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id as string | undefined;
    const where: Record<string, any> = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemProperty.findAll({ where, order: [['id', 'ASC']] });
    const enrichedList = await enrichWithProjectName(userId, list);
    res.json(success(enrichedList));
  } catch (e) {
    next(e);
  }
});

router.get('/priorities', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id as string | undefined;
    const where: Record<string, any> = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemPriority.findAll({ where, order: [['id', 'ASC']] });
    const enrichedList = await enrichWithProjectName(userId, list);
    res.json(success(enrichedList));
  } catch (e) {
    next(e);
  }
});

router.get('/projects', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const list = await SyncedProject.findAll({
      where: { user_id: req.user!.id, is_archived: false },
      order: [['name', 'ASC']],
    });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/work-items', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const projectId = req.query.project_id as string | undefined;
    const where: Record<string, any> = { user_id: userId, is_archived: false };
    if (projectId) where.project_id = projectId;

    const list = await SyncedWorkItem.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    const enrichedList = await enrichWithProjectName(userId, list);
    res.json(success(enrichedList));
  } catch (e) {
    next(e);
  }
});

router.get('/user-info', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const u = req.user!;
    res.json(
      success({
        id: u.pingcode_user_id,
        name: u.pingcode_user_name,
        display_name: u.pingcode_display_name,
        email: u.pingcode_email,
        avatar: u.pingcode_avatar,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/** 统计概览：项目数、工作项数、类型数、状态数 */
router.get('/overview', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const [projectsCount, workItemsCount, typesCount, statesCount] = await Promise.all([
      SyncedProject.count({ where: { user_id: userId, is_archived: false } }),
      SyncedWorkItem.count({ where: { user_id: userId, is_archived: false } }),
      WorkItemType.count({ where: { user_id: userId } }),
      WorkItemState.count({ where: { user_id: userId } }),
    ]);

    res.json(
      success({
        projects: projectsCount,
        workItems: workItemsCount,
        types: typesCount,
        states: statesCount,
      }),
    );
  } catch (e) {
    next(e);
  }
});

export default router;
