import { describe, it, expect } from 'vitest';
import {
  generateProjectIdentifier,
  toUnixTimestamp,
  resolveTypeId,
  resolvePriorityId,
  hoursToWorkload,
  workloadToHours,
  isUuidLike,
} from '../workItem.js';

describe('generateProjectIdentifier()', () => {
  it('should generate identifier for English name with random suffix', () => {
    const id = generateProjectIdentifier('My Project');
    // 格式：MY_PROJECT_XXXX（4 位随机后缀）
    expect(id).toMatch(/^MY_PROJECT_[A-Z0-9]{4}$/);
  });

  it('should generate PRJ prefix for Chinese name with random suffix', () => {
    const id = generateProjectIdentifier('测试项目');
    // 中文项目名：PRJ + base36 时间戳 + 4 位随机后缀
    expect(id).toMatch(/^PRJ[A-Z0-9]{4}[A-Z0-9]{4}$/);
  });

  it('should generate PRJ prefix for empty string', () => {
    const id = generateProjectIdentifier('   ');
    expect(id).toMatch(/^PRJ[A-Z0-9]{8}$/);
  });

  it('should truncate to 15 characters', () => {
    const id = generateProjectIdentifier('A Very Long Project Name Here');
    expect(id.length).toBeLessThanOrEqual(15);
  });

  it('should be unique across rapid successive calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateProjectIdentifier('测试'));
    }
    // 100 次调用应全部唯一（碰撞概率极低）
    expect(ids.size).toBe(100);
  });
});

describe('hoursToWorkload() / workloadToHours()', () => {
  const originalUnit = process.env.PINGCODE_WORKLOAD_UNIT;
  afterEach(() => {
    process.env.PINGCODE_WORKLOAD_UNIT = originalUnit;
  });

  it('should convert hours to workload with default unit (hour)', () => {
    delete process.env.PINGCODE_WORKLOAD_UNIT;
    expect(hoursToWorkload(8)).toBe(8);
  });

  it('should handle invalid inputs', () => {
    expect(hoursToWorkload(0)).toBeNull();
    expect(hoursToWorkload(-1)).toBeNull();
    expect(hoursToWorkload(null)).toBeNull();
    expect(hoursToWorkload(NaN)).toBeNull();
  });

  it('should round-trip convert with default unit', () => {
    delete process.env.PINGCODE_WORKLOAD_UNIT;
    const hours = 16;
    expect(workloadToHours(hoursToWorkload(hours))).toBe(hours);
  });

  it('should convert to minutes when PINGCODE_WORKLOAD_UNIT=minute', () => {
    process.env.PINGCODE_WORKLOAD_UNIT = 'minute';
    // 1.5 小时 = 90 分钟
    expect(hoursToWorkload(1.5)).toBe(90);
    expect(workloadToHours(90)).toBe(1.5);
  });

  it('should convert to days when PINGCODE_WORKLOAD_UNIT=day', () => {
    process.env.PINGCODE_WORKLOAD_UNIT = 'day';
    // 16 小时 = 2 人天
    expect(hoursToWorkload(16)).toBe(2);
    expect(workloadToHours(2)).toBe(16);
  });

  it('should ignore invalid unit and default to hour', () => {
    process.env.PINGCODE_WORKLOAD_UNIT = 'invalid';
    expect(hoursToWorkload(8)).toBe(8);
  });
});

describe('isUuidLike()', () => {
  it('should match standard UUID', () => {
    expect(isUuidLike('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('should match 32-char hex without dashes', () => {
    expect(isUuidLike('a1b2c3d4e5f67890abcdef1234567890')).toBe(true);
  });

  it('should match MongoDB ObjectId (24 hex)', () => {
    expect(isUuidLike('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('should not match short type IDs', () => {
    expect(isUuidLike('story')).toBe(false);
    expect(isUuidLike('task')).toBe(false);
  });

  it('should not match the old heuristic that used "-" + length', () => {
    // 旧逻辑：包含 '-' 且长度 > 20 才判为 UUID，会误判这类字符串
    expect(isUuidLike('some-random-identifier')).toBe(false);
  });
});

describe('toUnixTimestamp()', () => {
  it('should convert ISO string', () => {
    const ts = toUnixTimestamp('2024-01-01T00:00:00Z');
    expect(ts).toBe(1704067200);
  });

  it('should convert Date object', () => {
    const ts = toUnixTimestamp(new Date('2024-01-01T00:00:00Z'));
    expect(ts).toBe(1704067200);
  });

  it('should pass through seconds-level timestamp', () => {
    const ts = toUnixTimestamp(1704067200);
    expect(ts).toBe(1704067200);
  });

  it('should convert milliseconds-level timestamp to seconds', () => {
    const ts = toUnixTimestamp(1704067200000);
    expect(ts).toBe(1704067200);
  });

  it('should return null for null/undefined', () => {
    expect(toUnixTimestamp(null)).toBeNull();
    expect(toUnixTimestamp(undefined)).toBeNull();
  });

  it('should return null for invalid date string', () => {
    expect(toUnixTimestamp('not-a-date')).toBeNull();
  });
});

describe('resolveTypeId()', () => {
  const typeNameMap = new Map([
    ['story', 'uuid-story'],
    ['bug', 'uuid-bug'],
  ]);

  it('should return UUID directly if it looks like a UUID', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(resolveTypeId(uuid, typeNameMap)).toBe(uuid);
  });

  it('should map name to ID', () => {
    expect(resolveTypeId('story', typeNameMap)).toBe('uuid-story');
    expect(resolveTypeId('Bug', typeNameMap)).toBe('uuid-bug');
  });

  it('should fallback to story when typeId is empty', () => {
    expect(resolveTypeId(null, typeNameMap)).toBe('uuid-story');
    expect(resolveTypeId(undefined, typeNameMap)).toBe('uuid-story');
  });

  it('should fallback to typeId if not found in map', () => {
    const emptyMap = new Map();
    expect(resolveTypeId('unknown', emptyMap)).toBe('unknown');
  });
});

describe('resolvePriorityId()', () => {
  const priorityNameMap = new Map([
    ['high', 'uuid-high'],
    ['medium', 'uuid-medium'],
    ['低', 'uuid-low'],
  ]);

  it('should return UUID directly', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(resolvePriorityId(uuid, null, priorityNameMap)).toBe(uuid);
  });

  it('should map priorityId name', () => {
    expect(resolvePriorityId('high', null, priorityNameMap)).toBe('uuid-high');
  });

  it('should map priorityName when priorityId not found', () => {
    expect(resolvePriorityId(null, '低', priorityNameMap)).toBe('uuid-low');
  });

  it('should return null when nothing matches', () => {
    expect(resolvePriorityId(null, null, priorityNameMap)).toBeNull();
  });
});
