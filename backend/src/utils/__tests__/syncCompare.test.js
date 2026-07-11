import { describe, it, expect } from 'vitest';
import { remoteUpdatedAt, normUpdateKey, needsUpdate } from '../syncCompare.js';

describe('remoteUpdatedAt()', () => {
  it('应提取 updated_at 字段', () => {
    expect(remoteUpdatedAt({ updated_at: '2024-01-01T00:00:00Z' })).toBe('2024-01-01T00:00:00Z');
  });

  it('应回退到 updatedAt / last_modified', () => {
    expect(remoteUpdatedAt({ updatedAt: 't1' })).toBe('t1');
    expect(remoteUpdatedAt({ last_modified: 't2' })).toBe('t2');
  });

  it('无字段时返回 null', () => {
    expect(remoteUpdatedAt({})).toBeNull();
    expect(remoteUpdatedAt(null)).toBeNull();
  });
});

describe('needsUpdate()', () => {
  it('归档项重新出现时应返回 true（C1 修复）', () => {
    const existing = { is_archived: true, remote_updated_at: 't1', title: 'A', description: 'x' };
    const remote = { title: 'A', description: 'x' };
    expect(needsUpdate(existing, remote, 't1')).toBe(true);
  });

  it('时间戳变化时应返回 true', () => {
    const existing = { is_archived: false, remote_updated_at: 't1', title: 'A', description: 'x' };
    const remote = { title: 'A', description: 'x' };
    expect(needsUpdate(existing, remote, 't2')).toBe(true);
  });

  it('时间戳相同且内容相同时应返回 false', () => {
    const existing = { is_archived: false, remote_updated_at: 't1', title: 'A', description: 'x' };
    const remote = { title: 'A', description: 'x' };
    expect(needsUpdate(existing, remote, 't1')).toBe(false);
  });

  it('无时间戳但标题变化时应返回 true（I2 修复：内容比较）', () => {
    const existing = { is_archived: false, remote_updated_at: null, title: '旧标题', description: 'x' };
    const remote = { title: '新标题', description: 'x' };
    expect(needsUpdate(existing, remote, null)).toBe(true);
  });

  it('无时间戳但描述变化时应返回 true', () => {
    const existing = { is_archived: false, remote_updated_at: null, title: 'A', description: '旧描述' };
    const remote = { title: 'A', description: '新描述' };
    expect(needsUpdate(existing, remote, null)).toBe(true);
  });

  it('无时间戳且内容相同时应返回 false', () => {
    const existing = { is_archived: false, remote_updated_at: null, title: 'A', description: 'x' };
    const remote = { title: 'A', description: 'x' };
    expect(needsUpdate(existing, remote, null)).toBe(false);
  });

  it('null 和 undefined description 应视为相等', () => {
    const existing = { is_archived: false, remote_updated_at: null, title: 'A', description: null };
    const remote = { title: 'A', description: undefined };
    expect(needsUpdate(existing, remote, null)).toBe(false);
  });
});
