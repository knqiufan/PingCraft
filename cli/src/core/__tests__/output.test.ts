import { describe, it, expect } from 'vitest';
import { emitList, emitSingle, selectFields, logProgress } from '../output.js';

function collectingStream(): { stream: NodeJS.WritableStream; out: () => string } {
  let buf = '';
  const stream = {
    write: (s: string) => {
      buf += s;
      return true;
    },
  } as unknown as NodeJS.WritableStream;
  return { stream, out: () => buf };
}

const ROWS = [
  { id: 'p1', name: 'Alpha', visibility: 'open' },
  { id: 'p2', name: 'Beta', visibility: 'private' },
];

describe('selectFields()', () => {
  it('按 fields 选择并排序', () => {
    expect(selectFields({ a: 1, b: 2, c: 3 }, ['c', 'a'])).toEqual({ c: 3, a: 1 });
  });
  it('无 fields 返回全部键拷贝', () => {
    expect(selectFields({ a: 1 })).toEqual({ a: 1 });
  });
});

describe('emitList()', () => {
  it('--json 输出成功包络（含 pagination）', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { json: true, tty: false, stream }, { page: 0, pageSize: 30, total: 2 });
    const parsed = JSON.parse(out());
    expect(parsed).toEqual({
      success: true,
      data: [
        { id: 'p1', name: 'Alpha', visibility: 'open' },
        { id: 'p2', name: 'Beta', visibility: 'private' },
      ],
      pagination: { page: 0, pageSize: 30, total: 2 },
    });
  });

  it('非 TTY 默认 JSON', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { tty: false, stream });
    const parsed = JSON.parse(out());
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(2);
  });

  it('--quiet 仅输出 id 列', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { quiet: true, tty: false, stream });
    expect(out()).toBe('p1\np2\n');
  });

  it('--fields 裁剪列', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { json: true, fields: ['id', 'name'], tty: false, stream });
    const parsed = JSON.parse(out());
    expect(parsed.data).toEqual([
      { id: 'p1', name: 'Alpha' },
      { id: 'p2', name: 'Beta' },
    ]);
  });

  it('TTY 默认表格输出（含表头）', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { tty: true, stream });
    const text = out();
    expect(text).toContain('id');
    expect(text).toContain('Alpha');
    expect(text).toContain('Beta');
  });

  it('CSV 格式含表头与行', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { format: 'csv', fields: ['id', 'name'], tty: false, stream });
    const text = out().trim();
    const lines = text.split('\n');
    expect(lines[0]).toBe('id,name');
    expect(lines[1]).toBe('p1,Alpha');
    expect(lines[2]).toBe('p2,Beta');
  });

  it('YAML 格式', () => {
    const { stream, out } = collectingStream();
    emitList(ROWS, { format: 'yaml', fields: ['id', 'name'], tty: false, stream });
    expect(out()).toContain('id: p1');
    expect(out()).toContain('name: Alpha');
  });
});

describe('emitSingle()', () => {
  it('--json 包络', () => {
    const { stream, out } = collectingStream();
    emitSingle({ id: 'w1', title: 'T', status: 'open' }, { json: true, tty: false, stream });
    expect(JSON.parse(out())).toEqual({ success: true, data: { id: 'w1', title: 'T', status: 'open' } });
  });

  it('TTY 输出 key-value 表格', () => {
    const { stream, out } = collectingStream();
    emitSingle({ id: 'w1', title: 'T' }, { tty: true, stream });
    const text = out();
    expect(text).toContain('id');
    expect(text).toContain('w1');
    expect(text).toContain('title');
  });

  it('--fields 裁剪', () => {
    const { stream, out } = collectingStream();
    emitSingle({ id: 'w1', title: 'T', secret: 'x' }, { json: true, fields: ['id'], tty: false, stream });
    expect(JSON.parse(out()).data).toEqual({ id: 'w1' });
  });
});

describe('logProgress()', () => {
  it('写入 stream（默认 stderr 走进程流）', () => {
    const { stream, out } = collectingStream();
    logProgress('doing x', stream);
    expect(out()).toBe('doing x\n');
  });
});
