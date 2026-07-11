/**
 * 上传文件清理服务（P2-4.9）。
 *
 * 定期清理 uploads/demand 目录中超过 TTL 的历史需求文档，
 * 避免长期运行导致磁盘膨胀。
 *
 * 清理策略：
 *   - 扫描 demand 目录下所有文件
 *   - 删除修改时间超过 DEMAND_FILE_TTL_HOURS（默认 30 天）的文件
 *   - 仍被 ImportRecord.original_file_path 引用的文件永不删除（用户随时查看原需求文档）
 *   - 未过期的未引用文件暂时保留，等待下次清理
 *
 * 注意：删除导入记录时会级联清理其 original_file_path（见 records.js DELETE /:id）。
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op } from 'sequelize';
import { ImportRecord } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMAND_DIR = path.resolve(__dirname, '../../uploads/demand');
const DEFAULT_TTL_HOURS = 30 * 24; // 30 天

export interface CleanupResult {
  deleted: number;
  skipped: number;
  errors: number;
}

export interface CleanupOptions {
  /** 文件保留时长（小时） */
  ttlHours?: number;
  /** 当前时间（供测试注入） */
  now?: Date;
  /** 目录路径（供测试注入） */
  dir?: string;
}

/**
 * 清理过期的 demand 文件。
 */
export async function cleanupDemandFiles(options: CleanupOptions = {}): Promise<CleanupResult> {
  const ttlHours = options.ttlHours ?? (Number(process.env.DEMAND_FILE_TTL_HOURS) || DEFAULT_TTL_HOURS);
  const now = options.now || new Date();
  const dir = options.dir || DEMAND_DIR;
  const ttlMs = ttlHours * 3600 * 1000;

  const result: CleanupResult = { deleted: 0, skipped: 0, errors: 0 };

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return result; // 目录不存在，无需清理
    throw e;
  }

  // 收集仍被导入记录引用的文件路径，这些文件不清理（规范化路径以避免比较不一致）
  const referencedRecords = await ImportRecord.findAll({
    attributes: ['original_file_path'],
    where: { original_file_path: { [Op.ne]: null } },
  }).catch(() => []);
  const referencedPaths = new Set(
    referencedRecords
      .map((r) => r.original_file_path)
      .filter(Boolean)
      .map((p) => path.normalize(p as string)),
  );

  for (const file of files) {
    const filePath = path.normalize(path.resolve(dir, file));
    if (referencedPaths.has(filePath)) {
      result.skipped++;
      continue;
    }

    try {
      const stat = await fs.stat(filePath);
      if (now.getTime() - stat.mtimeMs > ttlMs) {
        await fs.unlink(filePath);
        result.deleted++;
      } else {
        result.skipped++;
      }
    } catch {
      // 文件可能已被删除或无权限，记录错误继续
      result.errors++;
    }
  }

  return result;
}

/**
 * 启动定时清理任务（每小时执行一次）。
 * 在服务启动时调用，返回定时器引用以便测试或优雅关闭。
 */
export function startCleanupSchedule(
  intervalMs = 60 * 60 * 1000,
): { initialTimer: NodeJS.Timeout; timer: NodeJS.Timeout } {
  // 首次延迟 5 分钟执行，避免启动时立即触发 IO
  const initialDelay = 5 * 60 * 1000;

  const runOnce = async () => {
    try {
      const result = await cleanupDemandFiles();
      if (result.deleted > 0) {
        console.log(`[UploadCleanup] 清理 ${result.deleted} 个过期需求文档`);
      }
    } catch (e) {
      console.error('[UploadCleanup] 清理失败:', (e as Error).message);
    }
  };

  const initialTimer = setTimeout(runOnce, initialDelay);
  const timer = setInterval(runOnce, intervalMs);

  return { initialTimer, timer };
}
