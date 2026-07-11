import { describe, it, expect } from 'vitest';
import { resolveAssigneeId } from '../assignee.js';

const members = [
  { id: 'u1', name: 'zhangsan', display_name: '张三' },
  { id: 'u2', name: 'lisi', display_name: '李四' },
  { id: 'u3', name: 'wangwu', display_name: '王五' },
];

describe('resolveAssigneeId()', () => {
  it('精确匹配 name（忽略大小写）', () => {
    expect(resolveAssigneeId('zhangsan', members)).toBe('u1');
    expect(resolveAssigneeId('ZhangSan', members)).toBe('u1');
  });

  it('精确匹配 display_name', () => {
    expect(resolveAssigneeId('张三', members)).toBe('u1');
    expect(resolveAssigneeId('李四', members)).toBe('u2');
  });

  it('包含匹配（姓名片段，需 ≥ 2 字符避免短名误匹配）', () => {
    expect(resolveAssigneeId('张三', members)).toBe('u1'); // 精确匹配
    expect(resolveAssigneeId('lisi', members)).toBe('u2'); // 精确匹配
    // 包含匹配：关键词 ≥ 2 字符
    expect(resolveAssigneeId('zhang', members)).toBe('u1');
    expect(resolveAssigneeId('wang', members)).toBe('u3');
  });

  it('单字符关键词不做模糊匹配（避免短名误匹配）', () => {
    // 单字符 '张' 可能匹配张三/张四/张五... 故不做模糊匹配
    expect(resolveAssigneeId('张', members)).toBeNull();
    expect(resolveAssigneeId('l', members)).toBeNull();
  });

  it('无匹配时返回 null', () => {
    expect(resolveAssigneeId('不存在的人', members)).toBeNull();
  });

  it('assigneeName 为空时返回 null', () => {
    expect(resolveAssigneeId(null, members)).toBeNull();
    expect(resolveAssigneeId('', members)).toBeNull();
    expect(resolveAssigneeId('   ', members)).toBeNull();
  });

  it('成员列表为空时返回 null', () => {
    expect(resolveAssigneeId('张三', [])).toBeNull();
    expect(resolveAssigneeId('张三', null)).toBeNull();
    expect(resolveAssigneeId('张三', undefined)).toBeNull();
  });

  it('优先返回精确匹配而非包含匹配', () => {
    // wangwu 精确匹配应优先于 wang（包含匹配）
    const members2 = [
      { id: 'a', name: 'wang', display_name: '小王' },
      { id: 'b', name: 'wangwu', display_name: '王五' },
    ];
    expect(resolveAssigneeId('wangwu', members2)).toBe('b');
  });
});
