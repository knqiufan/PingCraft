import { describe, it, expect, beforeEach } from 'vitest';
import { logAudit, getAuditLogs } from '../auditLog.js';

describe('auditLog', () => {
  beforeEach(() => {
    // getAuditLogs returns from the module's internal array;
    // we test relative behavior since the array is module-scoped
  });

  it('应记录审计日志并通过 getAuditLogs 查询', () => {
    logAudit({
      userId: 'u1',
      username: 'admin',
      action: 'DELETE_USER',
      resource: 'user:u2',
      detail: { deletedUsername: 'testuser' },
    });

    const logs = getAuditLogs({});
    expect(logs.length).toBeGreaterThan(0);
    const entry = logs.find((e) => e.action === 'DELETE_USER' && e.userId === 'u1');
    expect(entry).toBeDefined();
    expect(entry.username).toBe('admin');
    expect(entry.resource).toBe('user:u2');
    expect(entry.result).toBe('success');
    expect(entry.detail.deletedUsername).toBe('testuser');
    expect(entry.timestamp).toBeDefined();
  });

  it('应记录 failed 结果', () => {
    logAudit({
      userId: 'u1',
      username: 'admin',
      action: 'CLEAR_SYNC_DATA',
      result: 'failed',
    });

    const logs = getAuditLogs({ action: 'CLEAR_SYNC_DATA' });
    expect(logs.some((e) => e.result === 'failed')).toBe(true);
  });

  it('应按 userId 过滤', () => {
    logAudit({ userId: 'userA', username: 'a', action: 'ACTION_X' });
    logAudit({ userId: 'userB', username: 'b', action: 'ACTION_X' });

    const logs = getAuditLogs({ userId: 'userA', action: 'ACTION_X' });
    expect(logs.every((e) => e.userId === 'userA')).toBe(true);
  });

  it('应按 limit 限制返回条数', () => {
    for (let i = 0; i < 10; i++) {
      logAudit({ userId: 'u-limit', username: 'u', action: 'ACTION_LIMIT' });
    }
    const logs = getAuditLogs({ action: 'ACTION_LIMIT', limit: 3 });
    expect(logs.length).toBeLessThanOrEqual(3);
  });

  it('默认 result 为 success', () => {
    logAudit({ userId: 'u1', username: 'a', action: 'ACTION_DEFAULT' });
    const logs = getAuditLogs({ action: 'ACTION_DEFAULT' });
    expect(logs[0].result).toBe('success');
  });
});
