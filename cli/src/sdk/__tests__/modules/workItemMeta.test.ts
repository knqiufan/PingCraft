import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createWorkItemMetaModule } from '../../modules/workItemMeta.js';

function setup() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  const mock = new MockAdapter(client.axios);
  const meta = createWorkItemMetaModule(client);
  return { mock, meta };
}

describe('workItemMeta 模块', () => {
  let mock: MockAdapter;
  let meta: ReturnType<typeof createWorkItemMetaModule>;

  beforeEach(() => {
    const s = setup();
    mock = s.mock;
    meta = s.meta;
  });
  afterEach(() => mock.restore());

  it('types：GET /project/work_item/types?project_id', async () => {
    mock.onGet('/project/work_item/types').reply(200, { values: [{ id: 't1', name: '故事' }] });
    const res = await meta.types('p1');
    expect(res.values).toEqual([{ id: 't1', name: '故事' }]);
    expect(mock.history.get[0].params?.project_id).toBe('p1');
  });

  it('states：带 work_item_type_id', async () => {
    mock.onGet('/project/work_item/states').reply(200, { values: [{ id: 's1', name: '进行中' }] });
    const res = await meta.states('p1', 't1');
    expect(res.values).toHaveLength(1);
    expect(mock.history.get[0].params?.work_item_type_id).toBe('t1');
  });

  it('properties：带 work_item_type_id', async () => {
    mock.onGet('/project/work_item/properties').reply(200, { values: [{ id: 'pr1', name: '严重程度' }] });
    const res = await meta.properties('p1', 't1');
    expect(res.values[0].id).toBe('pr1');
  });

  it('priorities：GET /project/work_item/priorities?project_id', async () => {
    mock.onGet('/project/work_item/priorities').reply(200, { values: [{ id: 'pri1', name: '高' }] });
    const res = await meta.priorities('p1');
    expect(res.values).toEqual([{ id: 'pri1', name: '高' }]);
  });
});
