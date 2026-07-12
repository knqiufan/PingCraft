import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { readItems } from '../input.js';
import { CliError } from '../errors.js';

function tmpFile(data: unknown): string {
  const p = path.join(os.tmpdir(), `pc-input-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(data));
  return p;
}

describe('readItems()', () => {
  let file: string | undefined;
  afterEach(() => {
    if (file) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* noop */
      }
    }
    file = undefined;
  });

  it('从 --file 读取 JSON 数组', async () => {
    file = tmpFile([{ a: 1 }, { a: 2 }]);
    const items = await readItems({ file });
    expect(items).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('文件 JSON 解析失败抛 CliError(2)', async () => {
    file = path.join(os.tmpdir(), `pc-input-bad-${Date.now()}.json`);
    fs.writeFileSync(file, '{ not json');
    await expect(readItems({ file })).rejects.toMatchObject({ exitCode: 2 });
  });

  it('非数组 JSON 抛 CliError(2)', async () => {
    file = tmpFile({ not: 'array' });
    await expect(readItems({ file })).rejects.toMatchObject({ exitCode: 2 });
  });

  it('文件不存在抛 CliError(2)', async () => {
    await expect(readItems({ file: '/no/such/file.json' })).rejects.toMatchObject({ exitCode: 2 });
  });

  it('未提供 --file/--stdin 抛 CliError', async () => {
    await expect(readItems({})).rejects.toBeInstanceOf(CliError);
  });

  it('从 stdin 读取 JSON 数组', async () => {
    const original = Object.getOwnPropertyDescriptor(process, 'stdin');
    const stream = Readable.from('[{"x":1}]');
    Object.defineProperty(process, 'stdin', { value: stream, configurable: true });
    try {
      const items = await readItems<{ x: number }>({ stdin: true });
      expect(items).toEqual([{ x: 1 }]);
    } finally {
      if (original) Object.defineProperty(process, 'stdin', original);
    }
  });
});
