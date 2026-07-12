import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createProjectsModule } from '../../modules/projects.js';
import projectListFixture from '../../../../tests/fixtures/project-list.json' with { type: 'json' };

function setup() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  const mock = new MockAdapter(client.axios);
  const projects = createProjectsModule(client);
  return { mock, projects };
}

describe('projects 模块', () => {
  let mock: MockAdapter;
  let projects: ReturnType<typeof createProjectsModule>;

  beforeEach(() => {
    const s = setup();
    mock = s.mock;
    projects = s.projects;
  });

  afterEach(() => mock.restore());

  it('list：GET /project/projects，提取 values/total', async () => {
    mock.onGet('/project/projects').reply((cfg) => [
      200,
      { ...projectListFixture, page_index_sent: cfg.params?.page_index, page_size_sent: cfg.params?.page_size, search_sent: cfg.params?.search },
    ]);
    const res = await projects.list({ search: 'ping', pageIndex: 0, pageSize: 30 });
    expect(res.values).toHaveLength(2);
    expect(res.total).toBe(2);
  });

  it('list：响应直接为数组也能提取', async () => {
    mock.onGet('/project/projects').reply(200, [{ id: 'x', name: 'X' }]);
    const res = await projects.list();
    expect(res.values).toEqual([{ id: 'x', name: 'X' }]);
  });

  it('get：GET /project/projects/{id}', async () => {
    mock.onGet('/project/projects/p1').reply(200, { id: 'p1', name: 'PingCraft' });
    const res = await projects.get('p1');
    expect(res.id).toBe('p1');
  });

  it('create：POST 正确 body', async () => {
    mock.onPost('/project/projects').reply((cfg) => [200, { id: 'p3', got: JSON.parse(cfg.data) }]);
    const res = await projects.create({ name: 'New', type: 'scrum', identifier: 'NEW' });
    expect(res.id).toBe('p3');
    expect((res as { got: { name: string } }).got).toEqual({ name: 'New', type: 'scrum', identifier: 'NEW' });
  });

  it('update：PATCH /project/projects/{id}', async () => {
    mock.onPatch('/project/projects/p1').reply((cfg) => [200, { id: 'p1', got: JSON.parse(cfg.data), method: cfg.method }]);
    const res = await projects.update('p1', { name: 'Renamed' });
    expect((res as { got: { name: string } }).got).toEqual({ name: 'Renamed' });
  });

  it('remove：DELETE /project/projects/{id}', async () => {
    let called = false;
    mock.onDelete('/project/projects/p1').reply(() => {
      called = true;
      return [204, null];
    });
    await projects.remove('p1');
    expect(called).toBe(true);
  });

  it('members：GET /project/projects/{id}/members', async () => {
    mock.onGet('/project/projects/p1/members').reply(200, { values: [{ id: 'm1', name: 'Alice' }] });
    const res = await projects.members('p1');
    expect(res.values).toEqual([{ id: 'm1', name: 'Alice' }]);
  });
});
