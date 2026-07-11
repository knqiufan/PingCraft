import express from 'express';
import fs from 'fs/promises';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { ImportRecord, ImportRecordItem } from '../models/index.js';
import { success } from '../utils/response.js';
import { Op } from 'sequelize';

const router = express.Router();

/** 获取用户的导入记录列表 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, pageSize = 20, status } = req.query;

    const where = { user_id: userId };
    if (status) where.status = status;

    const offset = (Number(page) - 1) * Number(pageSize);

    const { count, rows } = await ImportRecord.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(pageSize),
      offset,
    });

    res.json(success({
      list: rows,
      total: count,
      page: Number(page),
      pageSize: Number(pageSize),
    }));
  } catch (e) {
    next(e);
  }
});

/** 获取单个导入记录详情 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    res.json(success(record));
  } catch (e) {
    next(e);
  }
});

/** 创建导入记录 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      file_name,
      requirements_count,
      projects_count,
      target_project_id,
      target_project_name,
    } = req.body;

    const record = await ImportRecord.create({
      id: crypto.randomUUID(),
      user_id: userId,
      file_name,
      requirements_count,
      projects_count: projects_count || 0,
      target_project_id,
      target_project_name,
      status: 'analyzed',
    });

    res.json(success(record, '记录创建成功'));
  } catch (e) {
    next(e);
  }
});

/** 更新导入记录状态 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    const { imported_count, failed_count, status, error_message } = req.body;

    await record.update({
      ...(imported_count !== undefined && { imported_count }),
      ...(failed_count !== undefined && { failed_count }),
      ...(status && { status }),
      ...(error_message !== undefined && { error_message }),
    });

    res.json(success(record, '更新成功'));
  } catch (e) {
    next(e);
  }
});

/** 删除导入记录 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    // 删除关联的原需求文档文件
    if (record.original_file_path) {
      await fs.unlink(record.original_file_path).catch(() => {
        // 文件不存在或删除失败，忽略错误
      });
    }

    // 级联删除会自动删除关联的 ImportRecordItem
    await record.destroy();
    res.json(success(null, '删除成功'));
  } catch (e) {
    next(e);
  }
});

/** 获取导入记录的工作项明细列表 */
router.get('/:id/items', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, pageSize = 50, status } = req.query;

    // 先验证记录是否属于当前用户
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    // 构建查询条件
    const where = { record_id: req.params.id };
    if (status) where.status = status;

    const offset = (Number(page) - 1) * Number(pageSize);

    const { count, rows } = await ImportRecordItem.findAndCountAll({
      where,
      order: [['createdAt', 'ASC']],
      limit: Number(pageSize),
      offset,
    });

    res.json(success({
      list: rows,
      total: count,
      page: Number(page),
      pageSize: Number(pageSize),
    }));
  } catch (e) {
    next(e);
  }
});

/** 获取原需求文档内容 */
router.get('/:id/content', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 先验证记录是否属于当前用户
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    if (!record.original_file_path) {
      return res.status(404).json({ 
        success: false, 
        error: '原需求文档不存在（可能是旧版本记录）' 
      });
    }

    // 读取文件内容
    let content = '';
    try {
      content = await fs.readFile(record.original_file_path, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ 
          success: false, 
          error: '原需求文档文件已被删除' 
        });
      }
      throw err;
    }

    res.json(success({
      content,
      file_name: record.file_name,
      file_path: record.original_file_path,
    }));
  } catch (e) {
    next(e);
  }
});

/** 从导入记录恢复分析结果（返回工作项列表，用于继续编辑和导入） */
router.get('/:id/restore', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    const items = await ImportRecordItem.findAll({
      where: { record_id: record.id },
      order: [['createdAt', 'ASC']],
    });

    const requirements = items.map(item => ({
      id: item.id,
      project_name: item.project_name || record.target_project_name || '',
      title: item.title,
      description: item.description || '',
      // 从明细还原真实值，不再硬编码 Medium / 8h / now()
      priority: item.priority || 'Medium',
      estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : 8,
      start_at: item.start_at || new Date().toISOString(),
      end_at: item.end_at || null,
      type_id: item.type_id || 'story',
      assignee_name: item.assignee_name || null,
      assignee_id: item.assignee_id || null,
      solution_suggestion: item.solution_suggestion || '',
      status: item.status === 'success' ? 'imported' : 'new',
    }));

    res.json(success({
      requirements,
      record_id: record.id,
      file_name: record.file_name,
      target_project_id: record.target_project_id,
      target_project_name: record.target_project_name,
    }, '恢复成功'));
  } catch (e) {
    next(e);
  }
});

/**
 * 导出导入记录的工作项为 CSV（P3-5.5）。
 * 包含标题、描述、优先级、工时、负责人、状态等字段，便于协作和存档。
 */
router.get('/:id/export', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const record = await ImportRecord.findOne({
      where: { id: req.params.id, user_id: userId },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    const items = await ImportRecordItem.findAll({
      where: { record_id: record.id },
      order: [['createdAt', 'ASC']],
    });

    const headers = [
      '项目名称', '标题', '类型', '优先级', '预估工时(小时)',
      '负责人', '开始时间', '截止时间', '导入状态', 'PingCode标识',
      '描述', '解决方案建议',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // CSV 注入防护：以 = + - @ 开头的值在 Excel 中会被解释为公式，
      // 前缀单引号使其被视为纯文本（A2）
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      // 包含逗号、换行、引号的值需要用双引号包裹并转义内部引号
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = items.map((item) => [
      item.project_name || '',
      item.title || '',
      item.type_id || '',
      item.priority || item.priority_id || '',
      item.estimated_hours ?? '',
      item.assignee_name || '',
      item.start_at || '',
      item.end_at || '',
      item.status || '',
      item.pingcode_identifier || '',
      item.description || '',
      item.solution_suggestion || '',
    ].map(escapeCsv).join(','));

    // BOM 头确保 Excel 正确识别 UTF-8 编码
    const csv = '﻿' + headers.join(',') + '\n' + rows.join('\n');
    const safeFileName = (record.file_name || 'export').replace(/[^\w一-龥.-]/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

export default router;
