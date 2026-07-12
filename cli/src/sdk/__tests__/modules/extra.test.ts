import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createReleasesModule } from '../../modules/releases.js';
import { createKanbansModule } from '../../modules/kanbans.js';
import { createWaterfallModule } from '../../modules/waterfall.js';
import { createWorkItemSchemeModule } from '../../modules/workItemScheme.js';

function makeMock() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  return { mock: new MockAdapter(client.axios), client };
}

describe('releases 模块', () => {
  let mock: MockAdapter;
  let releases: ReturnType<typeof createReleasesModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    releases = createReleasesModule(s.client);
  });
  afterEach(() => mock.restore());

  it('CRUD + stages/groups/categories', async () => {
    mock.onGet('/project/releases').reply(200, { values: [{ id: 'r1' }] });
    expect((await releases.list({ projectId: 'p1' })).values).toHaveLength(1);

    mock.onGet('/project/releases/r1').reply(200, { id: 'r1' });
    expect((await releases.get('r1')).id).toBe('r1');

    mock.onPost('/project/releases').reply((cfg) => [200, { id: 'r2', got: JSON.parse(cfg.data) }]);
    expect(((await releases.create({ project_id: 'p1', name: 'R' })) as { got: { project_id: string; name: string } }).got).toEqual({ project_id: 'p1', name: 'R' });

    mock.onPatch('/project/releases/r1').reply(200, { id: 'r1' });
    expect((await releases.update('r1', { name: 'X' })).id).toBe('r1');

    let del = false;
    mock.onDelete('/project/releases/r1').reply(() => {
      del = true;
      return [204, null];
    });
    await releases.remove('r1');
    expect(del).toBe(true);

    mock.onGet('/project/releases/r1/stages').reply(200, { values: [{ id: 'st1' }] });
    expect((await releases.stages('r1')).values).toHaveLength(1);
    mock.onGet('/project/release_groups').reply(200, { values: [] });
    mock.onGet('/project/release_categories').reply(200, { values: [] });
    expect((await releases.groups()).values).toHaveLength(0);
    expect((await releases.categories()).values).toHaveLength(0);
  });
});

describe('kanbans 模块', () => {
  let mock: MockAdapter;
  let kanbans: ReturnType<typeof createKanbansModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    kanbans = createKanbansModule(s.client);
  });
  afterEach(() => mock.restore());

  it('board + columns + swimlanes', async () => {
    mock.onGet('/project/kanbans').reply(200, { values: [{ id: 'k1' }] });
    expect((await kanbans.list({ projectId: 'p1' })).values).toHaveLength(1);
    mock.onGet('/project/kanbans/k1').reply(200, { id: 'k1' });
    expect((await kanbans.get('k1')).id).toBe('k1');
    mock.onPost('/project/kanbans').reply(200, { id: 'k2' });
    expect((await kanbans.create({ project_id: 'p1', name: 'K' })).id).toBe('k2');

    mock.onGet('/project/kanbans/k1/columns').reply(200, { values: [{ id: 'c1' }] });
    expect((await kanbans.columns('k1')).values).toHaveLength(1);
    mock.onPost('/project/kanbans/k1/columns').reply(200, { id: 'c2' });
    expect((await kanbans.createColumn('k1', { name: 'C' })).id).toBe('c2');
    mock.onPatch('/project/kanbans/k1/columns/c2').reply(200, { id: 'c2' });
    expect((await kanbans.updateColumn('k1', 'c2', { name: 'X' })).id).toBe('c2');
    let del = false;
    mock.onDelete('/project/kanbans/k1/columns/c2').reply(() => {
      del = true;
      return [204, null];
    });
    await kanbans.deleteColumn('k1', 'c2');
    expect(del).toBe(true);

    mock.onGet('/project/kanbans/k1/swimlanes').reply(200, { values: [{ id: 's1' }] });
    expect((await kanbans.swimlanes('k1')).values).toHaveLength(1);
    mock.onPost('/project/kanbans/k1/swimlanes').reply(200, { id: 's2' });
    expect((await kanbans.createSwimlane('k1', { name: 'S' })).id).toBe('s2');
    let sdel = false;
    mock.onDelete('/project/kanbans/k1/swimlanes/s2').reply(() => {
      sdel = true;
      return [204, null];
    });
    await kanbans.deleteSwimlane('k1', 's2');
    expect(sdel).toBe(true);
  });
});

describe('waterfall 模块', () => {
  let mock: MockAdapter;
  let wf: ReturnType<typeof createWaterfallModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    wf = createWaterfallModule(s.client);
  });
  afterEach(() => mock.restore());

  it('workItemTypes + transitions', async () => {
    mock.onGet('/project/waterfall/work_item_types').reply(200, { values: [{ id: 'wt1' }] });
    expect((await wf.workItemTypes('p1')).values).toHaveLength(1);
    mock.onGet('/project/waterfall/transitions').reply(200, { values: [{ id: 'tr1' }] });
    expect((await wf.transitions('p1')).values).toHaveLength(1);
  });
});

describe('workItemScheme 模块', () => {
  let mock: MockAdapter;
  let scheme: ReturnType<typeof createWorkItemSchemeModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    scheme = createWorkItemSchemeModule(s.client);
  });
  afterEach(() => mock.restore());

  it('states/properties/types/transitions/linkTypes', async () => {
    mock.onGet('/project/work_item/scheme/states').reply(200, { values: [{ id: 'st1' }] });
    expect((await scheme.states('p1')).values).toHaveLength(1);
    mock.onGet('/project/work_item/scheme/properties').reply(200, { values: [] });
    expect((await scheme.properties('p1')).values).toHaveLength(0);
    mock.onGet('/project/work_item/scheme/types').reply(200, { values: [] });
    expect((await scheme.types('p1')).values).toHaveLength(0);
    mock.onGet('/project/work_item/scheme/transitions').reply(200, { values: [{ id: 'tr1' }] });
    expect((await scheme.transitions('p1', 't1')).values).toHaveLength(1);
    mock.onGet('/project/work_item/link_types').reply(200, { values: [{ id: 'lt1' }] });
    expect((await scheme.linkTypes()).values).toHaveLength(1);
  });
});
