import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { parseFile } from '../services/parser.js';
import { analyzeRequirements, analyzeRequirementsStream } from '../services/agent.js';
import { ImportRecord, ImportRecordItem } from '../models/index.js';

const router = express.Router();

// 使用绝对路径，避免依赖进程 CWD（P2-4.8）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DEMAND_DIR = path.resolve(UPLOADS_DIR, 'demand');

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** 多文件上传（P3-5.7）：最多 10 个文件，每个最大 10MB */
const uploadMulti = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
}).array('files', 10);

/**
 * 解码文件名（处理 UTF-8 编码的中文文件名）
 * Multer 使用 busboy 解析 multipart，originalname 可能是 Latin1 编码
 */
function decodeFileName(originalname) {
  try {
    // 尝试将 Latin1 编码的字符串转换为 UTF-8
    const decoded = Buffer.from(originalname, 'latin1').toString('utf8');
    // 检查解码后是否为有效的 UTF-8 字符串
    if (decoded && !decoded.includes('\ufffd')) {
      return decoded;
    }
    return originalname;
  } catch {
    return originalname;
  }
}

/**
 * 生成安全的文件名（移除不允许的字符）
 */
function sanitizeFileName(fileName) {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

/** 上传文件并分析需求 */
router.post('/analyze', requireAuth, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传文件' });
  }

  const filePath = req.file.path;
  // 解码文件名，修复中文乱码问题
  const fileName = decodeFileName(req.file.originalname);

  try {
    const text = await parseFile(filePath, fileName);

    // 清理临时文件
    await fs.unlink(filePath).catch(() => {});

    // 保存原需求文档到 uploads/demand 目录（绝对路径）
    const timestamp = Date.now();
    const safeFileName = sanitizeFileName(path.basename(fileName, path.extname(fileName)));
    const demandFilePath = path.resolve(DEMAND_DIR, `${safeFileName}-${timestamp}.txt`);

    await fs.mkdir(DEMAND_DIR, { recursive: true });
    await fs.writeFile(demandFilePath, text, 'utf-8');

    const requirements = await analyzeRequirements(text, req.user.id);

    // 为每条需求添加唯一 ID
    const data = requirements.map((item) => ({
      ...item,
      id: uuidv4(),
      status: 'new',
    }));

    // 创建导入记录
    const uniqueProjectNames = [...new Set(requirements.map(r => r.project_name))];
    const recordId = uuidv4();
    const record = await ImportRecord.create({
      id: recordId,
      user_id: req.user.id,
      file_name: fileName,
      original_file_path: demandFilePath,
      requirements_count: requirements.length,
      projects_count: uniqueProjectNames.length,
      status: 'analyzed',
    });

    // 批量创建导入明细记录（完整保存 AI 提取的所有字段，确保恢复时不丢失）
    if (data.length > 0) {
      const recordItems = data.map((item) => ({
        id: item.id,
        record_id: recordId,
        title: item.title || '',
        description: item.description || '',
        project_name: item.project_name || '',
        type_id: item.type_id || '',
        priority_id: item.priority_id || '',
        priority: item.priority || 'Medium',
        estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : null,
        start_at: item.start_at || null,
        end_at: item.end_at || null,
        assignee_name: item.assignee_name || null,
        assignee_id: item.assignee_id || null,
        solution_suggestion: item.solution_suggestion || '',
        status: 'pending',
      }));
      await ImportRecordItem.bulkCreate(recordItems);
    }

    // 在响应中返回记录ID
    res.json({ success: true, data, record_id: record.id });
  } catch (e) {
    // 确保临时文件被清理
    await fs.unlink(filePath).catch(() => {});
    next(e);
  }
});

/**
 * 流式分析需求文档（P3-5.8）。
 * 通过 SSE 推送分析进度和部分结果，大文档分析时前端可实时展示已提取的工作项。
 */
router.post('/analyze-stream', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传文件' });
  }

  const filePath = req.file.path;
  const fileName = decodeFileName(req.file.originalname);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  function sendEvent(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const text = await parseFile(filePath, fileName);
    await fs.unlink(filePath).catch(() => {});

    // 保存原需求文档
    const timestamp = Date.now();
    const safeFileName = sanitizeFileName(path.basename(fileName, path.extname(fileName)));
    const demandFilePath = path.resolve(DEMAND_DIR, `${safeFileName}-${timestamp}.txt`);
    await fs.mkdir(DEMAND_DIR, { recursive: true });
    await fs.writeFile(demandFilePath, text, 'utf-8');

    sendEvent('progress', { stage: 'analyzing', message: '正在分析需求文档...' });

    const requirements = await analyzeRequirementsStream(text, req.user.id, (partial) => {
      sendEvent('progress', {
        stage: 'extracting',
        message: `已提取 ${partial.length} 个工作项...`,
        count: partial.length,
      });
    });

    const data = requirements.map((item) => ({
      ...item,
      id: uuidv4(),
      status: 'new',
    }));

    const uniqueProjectNames = [...new Set(requirements.map((r) => r.project_name))];
    const recordId = uuidv4();
    const record = await ImportRecord.create({
      id: recordId,
      user_id: req.user.id,
      file_name: fileName,
      original_file_path: demandFilePath,
      requirements_count: requirements.length,
      projects_count: uniqueProjectNames.length,
      status: 'analyzed',
    });

    if (data.length > 0) {
      const recordItems = data.map((item) => ({
        id: item.id,
        record_id: recordId,
        title: item.title || '',
        description: item.description || '',
        project_name: item.project_name || '',
        type_id: item.type_id || '',
        priority_id: item.priority_id || '',
        priority: item.priority || 'Medium',
        estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : null,
        start_at: item.start_at || null,
        end_at: item.end_at || null,
        assignee_name: item.assignee_name || null,
        assignee_id: item.assignee_id || null,
        solution_suggestion: item.solution_suggestion || '',
        status: 'pending',
      }));
      await ImportRecordItem.bulkCreate(recordItems);
    }

    sendEvent('complete', { data, record_id: record.id });
    res.end();
  } catch (e) {
    await fs.unlink(filePath).catch(() => {});
    sendEvent('error', { message: e.message });
    res.end();
  }
});

/**
 * 多文件批量分析（P3-5.7）。
 * 接收多个文件，合并解析后统一分析，适合批量上传多个需求文档合并处理的场景。
 */
router.post('/analyze-multi', requireAuth, (req, res, next) => {
  uploadMulti(req, res, async (multerErr) => {
    if (multerErr) {
      return res.status(400).json({ success: false, error: multerErr.message });
    }
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: '请上传至少一个文件' });
    }

    try {
      // 逐个解析文件并合并文本
      const parts = [];
      const fileNames = [];
      for (const file of files) {
        const decodedName = decodeFileName(file.originalname);
        const text = await parseFile(file.path, decodedName);
        parts.push(`# 文件: ${decodedName}\n\n${text}`);
        fileNames.push(decodedName);
        await fs.unlink(file.path).catch(() => {});
      }
      const combinedText = parts.join('\n\n---\n\n');

      // 保存合并后的原文档
      const timestamp = Date.now();
      const safeFileName = sanitizeFileName(fileNames.join('_'));
      const demandFilePath = path.resolve(DEMAND_DIR, `${safeFileName.slice(0, 80)}-${timestamp}.txt`);
      await fs.mkdir(DEMAND_DIR, { recursive: true });
      await fs.writeFile(demandFilePath, combinedText, 'utf-8');

      const requirements = await analyzeRequirements(combinedText, req.user.id);
      const data = requirements.map((item) => ({
        ...item,
        id: uuidv4(),
        status: 'new',
      }));

      const uniqueProjectNames = [...new Set(requirements.map((r) => r.project_name))];
      const recordId = uuidv4();
      const record = await ImportRecord.create({
        id: recordId,
        user_id: req.user.id,
        file_name: fileNames.join(', '),
        original_file_path: demandFilePath,
        requirements_count: requirements.length,
        projects_count: uniqueProjectNames.length,
        status: 'analyzed',
      });

      if (data.length > 0) {
        const recordItems = data.map((item) => ({
          id: item.id,
          record_id: recordId,
          title: item.title || '',
          description: item.description || '',
          project_name: item.project_name || '',
          type_id: item.type_id || '',
          priority: item.priority || 'Medium',
          estimated_hours: typeof item.estimated_hours === 'number' ? item.estimated_hours : null,
          start_at: item.start_at || null,
          end_at: item.end_at || null,
          assignee_name: item.assignee_name || null,
          assignee_id: item.assignee_id || null,
          solution_suggestion: item.solution_suggestion || '',
          status: 'pending',
        }));
        await ImportRecordItem.bulkCreate(recordItems);
      }

      res.json({ success: true, data, record_id: record.id });
    } catch (e) {
      // 清理所有临时文件
      if (files) {
        for (const f of files) await fs.unlink(f.path).catch(() => {});
      }
      next(e);
    }
  });
});

export default router;
