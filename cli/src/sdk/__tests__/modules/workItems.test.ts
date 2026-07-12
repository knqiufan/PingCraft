import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createWorkItemsModule } from '../../modules/workItems.js';
import page1 from '../../../../tests/fixtures/workitem-list-page1.json' with { type: 'json' };
import page2 from '../../../../tests/fixtures/workitem-list-page2.json' with { type: 'json' };

function setup() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  const mock = new MockAdapter(client.axios);
  const workItems = createWorkItemsModule(client);
  return { mock, workItems };
}

describe('workItems 模块', () => {
  let mock: MockAdapter;
  let workItems: ReturnType<typeof createWorkItemsModule>;

  beforeEach(() => {
    const s = setup();
    mock = s.mock;
    workItems = s.workItems;
  });
  afterEach(() => mock.restore());

  it('list（单页）', async () => {
    mock.onGet('/project/work_items').reply(200, page1);
    const res = await workItems.list({ projectId: 'p1', pageSize: 2 });
    expect(res.values).toHaveLength(2);
    expect(mock.history.get[0].params?.project_id).toBe('p1');
    expect(mock.history.get[0].params?.page_size).toBe(2);
  });

  it('listAll 自动分页（2 页后停止）', async () => {
    let call = 0;
    const pages = [page1, page2];
    mock.onGet('/project/work_items').reply((cfg) => {
      const page = pages[call++] ?? { values: [], total: 3 };
      return [200, { ...page, page_index_sent: cfg.params?.page_index }];
    });
    const res = await workItems.listAll({ projectId: 'p1', pageSize: 2 });
    expect(res.values.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(res.total).toBe(3);
    expect(res.truncated).toBe(false);
    expect(call).toBe(2); // 第二页返回 < pageSize，停止
  });

  it('get/create/update/remove', async () => {
    mock.onGet('/project/work_items/w1').reply(200, { id: 'w1', title: 'T' });
    const got = await workItems.get('w1');
    expect(got.id).toBe('w1');

    mock.onPost('/project/work_items').reply((cfg) => [200, { id: 'w9', got: JSON.parse(cfg.data) }]);
    const created = await workItems.create({ project_id: 'p1', type_id: 't1', title: 'New' });
    expect(created.id).toBe('w9');

    mock.onPatch('/project/work_items/w1').reply((cfg) => [200, { id: 'w1', got: JSON.parse(cfg.data) }]);
    const updated = await workItems.update('w1', { title: 'Updated' });
    expect((updated as { got: { title: string } }).got).toEqual({ title: 'Updated' });

    let deleted = false;
    mock.onDelete('/project/work_items/w1').reply(() => {
      deleted = true;
      return [204, null];
    });
    await workItems.remove('w1');
    expect(deleted).toBe(true);
  });

  it('batchCreate：并发 + 进度 + 单条失败不中断', async () => {
    let call = 0;
    mock.onPost('/project/work_items').reply((cfg) => {
      call++;
      const body = JSON.parse(cfg.data);
      // 第 2 条模拟失败
      if (body.title === 'Fail') return [400, { message: '校验失败' }];
      return [200, { id: `w-${body.title}`, identifier: `PC-${call}` }];
    });
    const progress: Array<{ current: number; total: number; item: { title?: string; status: string } }> = [];
    const result = await workItems.batchCreate(
      [
        { project_id: 'p1', type_id: 't1', title: 'A', _local_id: 1 },
        { project_id: 'p1', type_id: 't1', title: 'Fail', _local_id: 2 },
        { project_id: 'p1', type_id: 't1', title: 'C', _local_id: 3 },
      ],
      { concurrency: 2, onProgress: (current, total, item) => progress.push({ current, total, item }) },
    );
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.created).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('校验失败');
    expect(progress).toHaveLength(3);
    expect(progress.every((p) => p.total === 3)).toBe(true);
  });

  it('batchCreate 空数组返回零结果', async () => {
    const result = await workItems.batchCreate([]);
    expect(result).toEqual({ success: 0, failed: 0, created: [], errors: [] });
  });

  it('batchUpdate 并发 + 部分失败聚合', async () => {
    mock.onPatch(/\/project\/work_items\/w/).reply((cfg) => {
      const id = cfg.url?.split('/').pop();
      return id === 'w2' ? [400, { message: 'bad' }] : [200, { id }];
    });
    const progress: Array<{ current: number; total: number; status: string }> = [];
    const result = await workItems.batchUpdate(
      [{ id: 'w1', title: 'A' }, { id: 'w2', title: 'B' }, { id: 'w3', title: 'C' }],
      { concurrency: 2, onProgress: (c, t, s) => progress.push({ current: c, total: t, status: s }) },
    );
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.updated).toEqual(['w1', 'w3']);
    expect(progress).toHaveLength(3);
  });
});
