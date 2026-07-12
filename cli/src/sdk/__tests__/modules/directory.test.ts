import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createDirectoryModule } from '../../modules/directory.js';
import { createCommonResourcesModule } from '../../modules/commonResources.js';
import { createLogsModule } from '../../modules/logs.js';

describe('directory 模块', () => {
  let mock: MockAdapter;
  let dir: ReturnType<typeof createDirectoryModule>;
  beforeEach(() => {
    const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
    mock = new MockAdapter(client.axios);
    dir = createDirectoryModule(client);
  });
  afterEach(() => mock.restore());

  it('myself / users / createUser / getUser / updateUser', async () => {
    mock.onGet('/myself').reply(200, { id: 'u1', name: 'A' });
    expect((await dir.getMyself()).id).toBe('u1');

    mock.onGet('/directory/users').reply(200, { values: [{ id: 'u1' }] });
    expect((await dir.listUsers()).values).toHaveLength(1);

    mock.onPost('/directory/users').reply((cfg) => [200, { id: 'u2', got: JSON.parse(cfg.data) }]);
    const created = (await dir.createUser({ name: 'B', email: 'b@x' })) as { got: { name: string } };
    expect(created.got).toEqual({ name: 'B', email: 'b@x' });

    mock.onGet('/directory/users/u1').reply(200, { id: 'u1', name: 'A' });
    expect((await dir.getUser('u1')).id).toBe('u1');

    mock.onPatch('/directory/users/u1').reply(200, { id: 'u1', updated: true });
    expect((await dir.updateUser('u1', { name: 'X' })).id).toBe('u1');
  });

  it('department get / team list+get+members', async () => {
    mock.onGet('/directory/departments/d1').reply(200, { id: 'd1', name: 'D' });
    expect((await dir.getDepartment('d1')).id).toBe('d1');

    mock.onGet('/directory/teams').reply(200, { values: [{ id: 't1' }] });
    expect((await dir.listTeams()).values).toHaveLength(1);

    mock.onGet('/directory/teams/t1').reply(200, { id: 't1', name: 'T' });
    expect((await dir.getTeam('t1')).id).toBe('t1');

    mock.onGet('/directory/teams/t1/members').reply(200, { values: [{ id: 'u1' }] });
    expect((await dir.listTeamMembers('t1')).values).toHaveLength(1);
  });

  it('team members add/remove', async () => {
    mock.onPost('/directory/teams/t1/members').reply(200, { ok: true });
    await dir.addTeamMember('t1', 'u1');
    expect(mock.history.post[0].url).toBe('/directory/teams/t1/members');

    mock.onDelete('/directory/teams/t1/members/u1').reply(204, null);
    await dir.removeTeamMember('t1', 'u1');
    expect(mock.history.delete[0].url).toBe('/directory/teams/t1/members/u1');
  });

  it('departments / roles / positions / organization', async () => {
    mock.onGet('/directory/departments').reply(200, { values: [{ id: 'd1' }] });
    expect((await dir.listDepartments()).values).toHaveLength(1);
    mock.onGet('/directory/roles').reply(200, { values: [{ id: 'r1' }] });
    expect((await dir.listRoles()).values).toHaveLength(1);
    mock.onGet('/directory/positions').reply(200, { values: [{ id: 'p1' }] });
    expect((await dir.listPositions()).values).toHaveLength(1);
    mock.onGet('/directory/organizations').reply(200, { id: 'o1', name: 'Org' });
    expect((await dir.getOrganization()).id).toBe('o1');
  });
});

describe('commonResources 模块', () => {
  let mock: MockAdapter;
  let cr: ReturnType<typeof createCommonResourcesModule>;
  beforeEach(() => {
    const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
    mock = new MockAdapter(client.axios);
    cr = createCommonResourcesModule(client);
  });
  afterEach(() => mock.restore());

  it('comment create 带 principal', async () => {
    mock.onPost('/comments').reply((cfg) => [200, { id: 'c1', got: JSON.parse(cfg.data) }]);
    const res = (await cr.comments.create({ principal_type: 'work_item', principal_id: 'w1', content: 'hi' })) as { got: { principal_type: string } };
    expect(res.got.principal_type).toBe('work_item');
  });

  it('worklog create / list', async () => {
    mock.onPost('/worklogs').reply(200, { id: 'wl1' });
    expect((await cr.worklogs.create({ workload: 4 })).id).toBe('wl1');
    mock.onGet('/worklogs').reply(200, { values: [{ id: 'wl1' }] });
    expect((await cr.worklogs.list({ principal_type: 'work_item', principal_id: 'w1' })).values).toHaveLength(1);
  });

  it('activities / worklogTypes', async () => {
    mock.onGet('/activities').reply(200, { values: [{ id: 'a1' }] });
    expect((await cr.activities({ principal_type: 'work_item', principal_id: 'w1' })).values).toHaveLength(1);
    mock.onGet('/worklog_types').reply(200, { values: [{ id: 'wt1' }] });
    expect((await cr.worklogTypes()).values).toHaveLength(1);
  });
});

describe('logs 模块', () => {
  let mock: MockAdapter;
  let logs: ReturnType<typeof createLogsModule>;
  beforeEach(() => {
    const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
    mock = new MockAdapter(client.axios);
    logs = createLogsModule(client);
  });
  afterEach(() => mock.restore());

  it('login / audit', async () => {
    mock.onGet('/security/login_logs').reply(200, { values: [{ id: 'l1' }] });
    expect((await logs.login()).values).toHaveLength(1);
    mock.onGet('/security/audit_logs').reply(403, { message: 'forbidden' });
    await expect(logs.audit()).rejects.toMatchObject({ response: { status: 403 } });
  });
});
