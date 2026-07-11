import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Mock ImportRecord 模型
vi.mock('../../models/index.js', () => ({
  ImportRecord: {
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

// Mock sequelize Op
vi.mock('sequelize', () => ({
  Op: { ne: Symbol('ne') },
}));

import { cleanupDemandFiles } from '../uploadCleanup.js';
import { ImportRecord } from '../../models/index.js';

// 使用临时目录测试文件清理逻辑
const TMP_DIR = path.resolve('./tmp-cleanup-test');

describe('cleanupDemandFiles()', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // 每次测试重建临时目录
    await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(TMP_DIR, { recursive: true });
    ImportRecord.findAll.mockResolvedValue([]);
  });

  it('应删除超过 TTL 的文件', async () => {
    const oldFile = path.resolve(TMP_DIR, 'old.txt');
    await fs.writeFile(oldFile, 'old content');
    // 将修改时间设为 40 天前
    const oldDate = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    await fs.utimes(oldFile, oldDate, oldDate);

    const result = await cleanupDemandFiles({
      ttlHours: 30 * 24,
      now: new Date(),
      dir: TMP_DIR,
    });

    expect(result.deleted).toBe(1);
    await expect(fs.access(oldFile)).rejects.toThrow();
  });

  it('应保留未过期的文件', async () => {
    const newFile = path.resolve(TMP_DIR, 'new.txt');
    await fs.writeFile(newFile, 'new content');

    const result = await cleanupDemandFiles({
      ttlHours: 30 * 24,
      now: new Date(),
      dir: TMP_DIR,
    });

    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(1);
    await expect(fs.access(newFile)).resolves.toBeUndefined();
  });

  it('应保留被导入记录引用的文件（即使超过 TTL）', async () => {
    const referencedFile = path.resolve(TMP_DIR, 'referenced.txt');
    await fs.writeFile(referencedFile, 'referenced');
    const oldDate = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    await fs.utimes(referencedFile, oldDate, oldDate);

    ImportRecord.findAll.mockResolvedValue([{ original_file_path: referencedFile }]);

    const result = await cleanupDemandFiles({
      ttlHours: 30 * 24,
      now: new Date(),
      dir: TMP_DIR,
    });

    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(1);
    await expect(fs.access(referencedFile)).resolves.toBeUndefined();
  });

  it('目录不存在时返回空结果', async () => {
    const result = await cleanupDemandFiles({
      ttlHours: 24,
      dir: '/nonexistent/path/xyz',
    });
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
  });

  afterEach(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });
});
