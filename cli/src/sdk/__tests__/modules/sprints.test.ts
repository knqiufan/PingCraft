import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createSprintsModule } from '../../modules/sprints.js';

function setup() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  const mock = new MockAdapter(client.axios);
  return { mock, sprints: createSprintsModule(client) };
}

describe('sprints 模块', () => {
  let mock: MockAdapter;
  let sprints: ReturnType<typeof createSprintsModule>;
  beforeEach(() => {
    const s = setup();
    mock = s.mock;
    sprints = s.sprints;
  });
  afterEach(() => mock.restore());

  it('list 携带 project_id', async () => {
    mock.onGet('/project/sprints').reply(200, { values: [{ id: 'sp1', name: 'Sprint 1' }] });
    const res = await sprints.list({ projectId: 'p1' });
    expect(res.values[0].id).toBe('sp1');
    expect(mock.history.get[0].params?.project_id).toBe('p1');
  });

  it('create / get / update', async () => {
    mock.onPost('/project/sprints').reply((cfg) => [200, { id: 'sp2', got: JSON.parse(cfg.data) }]);
    const created = (await sprints.create({ project_id: 'p1', name: 'New' })) as { id: string; got: { name: string } };
    expect(created.id).toBe('sp2');

    mock.onGet('/project/sprints/sp1').reply(200, { id: 'sp1', name: 'S1' });
    expect((await sprints.get('sp1')).id).toBe('sp1');

    mock.onPatch('/project/sprints/sp1').reply((cfg) => [200, { got: JSON.parse(cfg.data) }]);
    expect((await sprints.update('sp1', { name: 'X' }) as { got: { name: string } }).got).toEqual({ name: 'X' });
  });

  it('createBatch 并发 + 部分失败聚合 + 进度', async () => {
    let call = 0;
    mock.onPost('/project/sprints').reply((cfg) => {
      call++;
      const body = JSON.parse(cfg.data);
      if (body.name === 'Fail') return [400, { message: 'err' }];
      return [200, { id: `sp-${body.name}` }];
    });
    const progress: Array<{ current: number; total: number; status: string }> = [];
    const result = await sprints.createBatch(
      [{ project_id: 'p1', name: 'A', _local_id: 1 }, { project_id: 'p1', name: 'Fail', _local_id: 2 }, { project_id: 'p1', name: 'C', _local_id: 3 }],
      { concurrency: 2, onProgress: (current, total, status) => progress.push({ current, total, status }) },
    );
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(progress).toHaveLength(3);
    expect(progress.every((p) => p.total === 3)).toBe(true);
  });

  it('workItems / groups / categories', async () => {
    mock.onGet('/project/sprints/sp1/work_items').reply(200, { values: [{ id: 'w1' }] });
    expect((await sprints.workItems('sp1')).values).toHaveLength(1);

    mock.onGet('/project/sprint_groups').reply(200, { values: [{ id: 'g1' }] });
    expect((await sprints.groups('p1')).values).toHaveLength(1);

    mock.onGet('/project/sprint_categories').reply(200, { values: [{ id: 'c1' }] });
    expect((await sprints.categories()).values).toHaveLength(1);
  });
});
