import { describe, it, expect } from 'vitest';
// 直接从 workItem 工具模块导入，避免复制逻辑导致测试与实现脱节
import { extractWorkItemIds } from '../../utils/workItem.js';

describe('PingCode 工作项字段映射（P0-2.2）', () => {
  it('应从嵌套结构提取 type/priority/state ID（PingCode 实际返回）', () => {
    const item = {
      id: 'wi-1',
      type: { id: 'story-id-uuid' },
      priority: { id: 'prio-high-uuid', name: '高' },
      state: { id: 'state-done-uuid', name: '已完成', type: 'done' },
      estimated_workload: 8,
    };
    const ids = extractWorkItemIds(item);
    expect(ids.typeId).toBe('story-id-uuid');
    expect(ids.priorityId).toBe('prio-high-uuid');
    expect(ids.stateId).toBe('state-done-uuid');
  });

  it('应从扁平结构提取 ID（向后兼容旧代码假设）', () => {
    const item = {
      work_item_type_id: 'type-uuid',
      priority_id: 'prio-uuid',
      state_id: 'state-uuid',
    };
    const ids = extractWorkItemIds(item);
    expect(ids.typeId).toBe('type-uuid');
    expect(ids.priorityId).toBe('prio-uuid');
    expect(ids.stateId).toBe('state-uuid');
  });

  it('应处理 type 为简单字符串（如 "story"）的情况', () => {
    const item = { type: 'story', priority: 'high', state: 'open' };
    const ids = extractWorkItemIds(item);
    expect(ids.typeId).toBe('story');
    expect(ids.priorityId).toBe('high');
    expect(ids.stateId).toBe('open');
  });

  it('缺失字段时应返回 null', () => {
    const item = { id: 'wi-2' };
    const ids = extractWorkItemIds(item);
    expect(ids.typeId).toBeNull();
    expect(ids.priorityId).toBeNull();
    expect(ids.stateId).toBeNull();
  });

  it('嵌套对象 .id 为空时不应回退为整个对象', () => {
    // type 是对象但 id 为 null —— 不应把整个对象当 typeId
    const item = { type: { id: null, name: 'Story' } };
    const ids = extractWorkItemIds(item);
    expect(ids.typeId).toBeNull();
  });

  it('聚合统计时应正确统计嵌套结构的分布', () => {
    const typeMap = new Map([['story-uuid', '用户故事'], ['task-uuid', '任务']]);
    const priorityMap = new Map([['prio-high', '高'], ['prio-low', '低']]);

    const items = [
      { type: { id: 'story-uuid' }, priority: { id: 'prio-high' }, state: { id: 'state-done' } },
      { type: { id: 'task-uuid' }, priority: { id: 'prio-low' }, state: { id: 'state-done' } },
      { type: { id: 'story-uuid' }, priority: { id: 'prio-high' }, state: { id: 'state-done' } },
    ];

    // 模拟 aggregateWorkItems 中的映射逻辑
    const typeDist = new Map();
    const prioDist = new Map();
    for (const item of items) {
      const { typeId, priorityId } = extractWorkItemIds(item);
      const typeName = typeMap.get(typeId) || '未知类型';
      const priorityName = (priorityId && priorityMap.get(priorityId)) || '未设置';
      typeDist.set(typeName, (typeDist.get(typeName) || 0) + 1);
      prioDist.set(priorityName, (prioDist.get(priorityName) || 0) + 1);
    }

    expect(typeDist.get('用户故事')).toBe(2);
    expect(typeDist.get('任务')).toBe(1);
    expect(prioDist.get('高')).toBe(2);
    expect(prioDist.get('低')).toBe(1);
    // 不应出现兜底值
    expect(typeDist.has('未知类型')).toBe(false);
    expect(prioDist.has('未设置')).toBe(false);
  });
});
