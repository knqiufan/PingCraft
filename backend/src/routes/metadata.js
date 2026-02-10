import express from 'express';
import { requireAuth } from '../middleware/auth.js';
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

router.get('/types', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.query.project_id;
    const where = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemType.findAll({ where, order: [['id', 'ASC']] });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/states', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.query.project_id;
    const where = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemState.findAll({ where, order: [['id', 'ASC']] });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/properties', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.query.project_id;
    const where = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemProperty.findAll({ where, order: [['id', 'ASC']] });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/priorities', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.query.project_id;
    const where = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await WorkItemPriority.findAll({ where, order: [['id', 'ASC']] });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/projects', requireAuth, async (req, res, next) => {
  try {
    const list = await SyncedProject.findAll({
      where: { user_id: req.user.id },
      order: [['name', 'ASC']],
    });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/work-items', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectId = req.query.project_id;
    const where = { user_id: userId };
    if (projectId) where.project_id = projectId;

    const list = await SyncedWorkItem.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    res.json(success(list));
  } catch (e) {
    next(e);
  }
});

router.get('/user-info', requireAuth, async (req, res, next) => {
  try {
    const u = req.user;
    res.json(
      success({
        id: u.pingcode_user_id,
        name: u.pingcode_user_name,
        display_name: u.pingcode_display_name,
        email: u.pingcode_email,
        avatar: u.pingcode_avatar,
      })
    );
  } catch (e) {
    next(e);
  }
});

/** 统计概览：项目数、工作项数、类型数、状态数 */
router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [projectsCount, workItemsCount, typesCount, statesCount] = await Promise.all([
      SyncedProject.count({ where: { user_id: userId } }),
      SyncedWorkItem.count({ where: { user_id: userId } }),
      WorkItemType.count({ where: { user_id: userId } }),
      WorkItemState.count({ where: { user_id: userId } }),
    ]);

    res.json(
      success({
        projects: projectsCount,
        workItems: workItemsCount,
        types: typesCount,
        states: statesCount,
      })
    );
  } catch (e) {
    next(e);
  }
});

export default router;
