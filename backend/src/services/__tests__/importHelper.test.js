import { describe, it, expect } from 'vitest';
import { buildImportPayload } from '../importHelper.js';

describe('buildImportPayload()', () => {
  const baseCtx = {
    targetProjectId: 'proj-1',
    resolvedTypeId: 'type-uuid',
    resolvedPriorityId: 'prio-uuid',
    members: [],
    pingcodeUserId: 'pc-user-default',
  };

  it('应构建基本 payload（title、type_id、project_id）', () => {
    const payload = buildImportPayload({ id: 'l1', title: 'Test Item' }, baseCtx);
    expect(payload._local_id).toBe('l1');
    expect(payload.project_id).toBe('proj-1');
    expect(payload.title).toBe('Test Item');
    expect(payload.type_id).toBe('type-uuid');
  });

  it('应将 solution_suggestion 拼入 description（P1-3.3）', () => {
    const payload = buildImportPayload(
      {
        id: 'l1',
        title: 'Test',
        description: '原始描述',
        solution_suggestion: '建议步骤1\n建议步骤2',
      },
      baseCtx
    );
    expect(payload.description).toContain('原始描述');
    expect(payload.description).toContain('【解决方案建议】');
    expect(payload.description).toContain('建议步骤1');
    expect(payload.description).toContain('建议步骤2');
  });

  it('仅有 solution_suggestion 无 description 时也能生成 description', () => {
    const payload = buildImportPayload(
      { id: 'l1', title: 'Test', solution_suggestion: '方案建议' },
      baseCtx
    );
    expect(payload.description).toContain('【解决方案建议】');
    expect(payload.description).toContain('方案建议');
  });

  it('无 description 也无 solution_suggestion 时不含 description 字段', () => {
    const payload = buildImportPayload({ id: 'l1', title: 'Test' }, baseCtx);
    expect(payload.description).toBeUndefined();
  });

  it('应从 assignee_name 解析 assignee_id（P1-3.2）', () => {
    const members = [{ id: 'member-uuid', name: 'zhangsan', display_name: '张三' }];
    const payload = buildImportPayload(
      { id: 'l1', title: 'Test', assignee_name: '张三' },
      { ...baseCtx, members }
    );
    expect(payload.assignee_id).toBe('member-uuid');
  });

  it('assignee_name 无法匹配时回退到当前用户', () => {
    const payload = buildImportPayload(
      { id: 'l1', title: 'Test', assignee_name: '不存在' },
      baseCtx
    );
    expect(payload.assignee_id).toBe('pc-user-default');
  });

  it('显式 assignee_id 优先于 assignee_name 解析', () => {
    const members = [{ id: 'member-uuid', name: 'zhangsan', display_name: '张三' }];
    const payload = buildImportPayload(
      { id: 'l1', title: 'Test', assignee_id: 'explicit-id', assignee_name: '张三' },
      { ...baseCtx, members }
    );
    expect(payload.assignee_id).toBe('explicit-id');
  });

  it('应转换 estimated_hours 为 workload（保留配置单位转换）', () => {
    const payload = buildImportPayload(
      { id: 'l1', title: 'Test', estimated_hours: 8 },
      baseCtx
    );
    expect(payload.estimated_workload).toBe(8); // 默认 hour 单位
  });

  it('应包含 end_at 和自定义属性', () => {
    const payload = buildImportPayload(
      {
        id: 'l1',
        title: 'Test',
        end_at: '2025-01-01T00:00:00Z',
        properties: { custom_field: 'value' },
      },
      baseCtx
    );
    expect(payload.end_at).toBeDefined();
    expect(payload.properties).toEqual({ custom_field: 'value' });
  });
});
