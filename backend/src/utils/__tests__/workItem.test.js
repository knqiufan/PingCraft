import { describe, it, expect } from 'vitest';
import {
  generateProjectIdentifier,
  toUnixTimestamp,
  resolveTypeId,
  resolvePriorityId,
} from '../workItem.js';

describe('generateProjectIdentifier()', () => {
  it('should generate identifier for English name', () => {
    const id = generateProjectIdentifier('My Project');
    expect(id).toBe('MY_PROJECT');
  });

  it('should generate PRJ prefix for Chinese name', () => {
    const id = generateProjectIdentifier('测试项目');
    expect(id).toMatch(/^PRJ\d{6}$/);
  });

  it('should generate PRJ prefix for empty string', () => {
    const id = generateProjectIdentifier('   ');
    expect(id).toMatch(/^PRJ\d{6}$/);
  });

  it('should truncate to 15 characters', () => {
    const id = generateProjectIdentifier('A Very Long Project Name Here');
    expect(id.length).toBeLessThanOrEqual(15);
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
