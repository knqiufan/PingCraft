import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createProductsModule } from '../../modules/products.js';
import { createCustomersModule } from '../../modules/customers.js';
import { createTicketsModule } from '../../modules/tickets.js';
import { createRequirementsModule } from '../../modules/requirements.js';
import { createTestLibraryModule, createTestCasesModule, createTestPlansModule, createTestExecutionsModule, createTestConfigModule } from '../../modules/testhub.js';

function makeMock() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  return { mock: new MockAdapter(client.axios), client };
}

describe('products 模块', () => {
  let mock: MockAdapter;
  let products: ReturnType<typeof createProductsModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    products = createProductsModule(s.client);
  });
  afterEach(() => mock.restore());

  it('CRUD + 子资源', async () => {
    mock.onGet('/product/products').reply(200, { values: [{ id: 'pd1', name: 'P' }] });
    expect((await products.list()).values).toHaveLength(1);
    mock.onGet('/product/products/pd1').reply(200, { id: 'pd1' });
    expect((await products.get('pd1')).id).toBe('pd1');
    mock.onPost('/product/products').reply((cfg) => [200, { id: 'pd2', got: JSON.parse(cfg.data) }]);
    expect(((await products.create({ name: 'N' })) as { got: { name: string } }).got).toEqual({ name: 'N' });

    mock.onGet('/product/products/pd1/members').reply(200, [{ id: 'u1' }]);
    expect(await products.members('pd1')).toHaveLength(1);
    mock.onGet('/product/ticket_channels').reply(200, { values: [{ id: 'c1' }] });
    expect(await products.ticketChannels()).toHaveLength(1);
    mock.onGet('/product/tags').reply(200, [{ id: 't1' }]);
    expect(await products.tags()).toHaveLength(1);

    let del = false;
    mock.onDelete('/product/products/pd1').reply(() => {
      del = true;
      return [204, null];
    });
    await products.remove('pd1');
    expect(del).toBe(true);
  });
});

describe('customers 模块', () => {
  let mock: MockAdapter;
  let customers: ReturnType<typeof createCustomersModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    customers = createCustomersModule(s.client);
  });
  afterEach(() => mock.restore());

  it('customer CRUD + external-user', async () => {
    mock.onGet('/product/customers').reply(200, { values: [{ id: 'cu1' }] });
    expect((await customers.list()).values).toHaveLength(1);
    mock.onGet('/product/customers/cu1').reply(200, { id: 'cu1' });
    expect((await customers.get('cu1')).id).toBe('cu1');

    mock.onGet('/product/external_users').reply(200, { values: [{ id: 'eu1' }] });
    expect((await customers.externalUser.list()).values).toHaveLength(1);
    mock.onPost('/product/external_users').reply(200, { id: 'eu2' });
    expect((await customers.externalUser.create({ name: 'EU' })).id).toBe('eu2');
    let del = false;
    mock.onDelete('/product/external_users/eu2').reply(() => {
      del = true;
      return [204, null];
    });
    await customers.externalUser.remove('eu2');
    expect(del).toBe(true);
  });
});

describe('tickets 模块', () => {
  let mock: MockAdapter;
  let tickets: ReturnType<typeof createTicketsModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    tickets = createTicketsModule(s.client);
  });
  afterEach(() => mock.restore());

  it('CRUD + transition + 元数据', async () => {
    mock.onGet('/product/tickets').reply(200, { values: [{ id: 'tk1' }] });
    expect((await tickets.list()).values).toHaveLength(1);
    mock.onPatch('/product/tickets/tk1').reply((cfg) => [200, { got: JSON.parse(cfg.data) }]);
    expect(((await tickets.transition('tk1', 's2')) as { got: { state_id: string } }).got).toEqual({ state_id: 's2' });

    mock.onGet('/product/ticket/types').reply(200, { values: [{ id: 'tt1' }] });
    expect((await tickets.types()).values).toHaveLength(1);
    mock.onGet('/product/ticket/priorities').reply(200, { values: [{ id: 'p1' }] });
    expect((await tickets.priorities()).values).toHaveLength(1);
    mock.onGet('/product/ticket/solutions').reply(200, [{ id: 'sol1' }]);
    expect((await tickets.solutions()).values).toHaveLength(1);
  });
});

describe('requirements 模块', () => {
  let mock: MockAdapter;
  let reqs: ReturnType<typeof createRequirementsModule>;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
    reqs = createRequirementsModule(s.client);
  });
  afterEach(() => mock.restore());

  it('CRUD + transition + 元数据', async () => {
    mock.onGet('/product/requirements').reply(200, { values: [{ id: 'r1' }] });
    expect((await reqs.list()).values).toHaveLength(1);
    mock.onPatch('/product/requirements/r1').reply(200, { id: 'r1' });
    expect((await reqs.transition('r1', 's1')).id).toBe('r1');
    mock.onGet('/product/requirement/states').reply(200, { values: [{ id: 'rs1' }] });
    expect((await reqs.states()).values).toHaveLength(1);
    mock.onGet('/product/requirement/modules').reply(200, [{ id: 'rm1' }]);
    expect((await reqs.modules()).values).toHaveLength(1);
  });
});

describe('testhub 模块', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    const s = makeMock();
    mock = s.mock;
  });
  afterEach(() => mock.restore());

  it('test-library + test-cases(batch/link/meta) + plan + execution + config', async () => {
    const s = makeMock();
    const client = s.client;

    const lib = createTestLibraryModule(client);
    s.mock.onGet('/testhub/libraries').reply(200, { values: [{ id: 'l1' }] });
    expect((await lib.list()).values).toHaveLength(1);
    s.mock.onGet('/testhub/libraries/l1/members').reply(200, [{ id: 'u1' }]);
    expect(await lib.members('l1')).toHaveLength(1);

    const cases = createTestCasesModule(client);
    s.mock.onPost('/testhub/cases').reply((cfg) => {
      const b = JSON.parse(cfg.data);
      return b.name === 'Fail' ? [400, { message: 'bad' }] : [200, { id: `c-${b.name}` }];
    });
    const batch = await cases.batchCreate([{ name: 'A' }, { name: 'Fail' }, { name: 'C' }], { concurrency: 2 });
    expect(batch.success).toBe(2);
    expect(batch.failed).toBe(1);
    s.mock.onPost('/testhub/cases/c1/work_items').reply(200, { linked: true });
    expect(await cases.linkWorkItem('c1', 'w1')).toMatchObject({ linked: true });
    let unlinked = false;
    s.mock.onDelete('/testhub/cases/c1/work_items/w1').reply(() => {
      unlinked = true;
      return [204, null];
    });
    await cases.unlinkWorkItem('c1', 'w1');
    expect(unlinked).toBe(true);
    s.mock.onGet('/testhub/case/states').reply(200, { values: [{ id: 's1' }] });
    expect((await cases.states()).values).toHaveLength(1);

    const plans = createTestPlansModule(client);
    s.mock.onGet('/testhub/plans').reply(200, { values: [{ id: 'p1' }] });
    expect((await plans.list()).values).toHaveLength(1);

    const exec = createTestExecutionsModule(client);
    s.mock.onPost('/testhub/executions').reply(200, { id: 'e1' });
    expect((await exec.create({ plan_id: 'p1' })).id).toBe('e1');
    s.mock.onGet('/testhub/executions/e1/result').reply(200, { status: 'pass' });
    expect(await exec.result('e1')).toMatchObject({ status: 'pass' });

    const config = createTestConfigModule(client);
    s.mock.onGet('/testhub/config/case/states').reply(200, { values: [{ id: 'cs1' }] });
    expect((await config.caseStates()).values).toHaveLength(1);
    s.mock.onGet('/testhub/config/plan/states').reply(200, [{ id: 'ps1' }]);
    expect((await config.planStates()).values).toHaveLength(1);
    s.mock.onGet('/testhub/config/case/types').reply(200, { values: [] });
    expect((await config.caseTypes()).values).toHaveLength(0);
    s.mock.onGet('/testhub/config/case/severities').reply(200, { values: [] });
    expect((await config.severities()).values).toHaveLength(0);
    s.mock.onGet('/testhub/config/case/properties').reply(200, { values: [] });
    expect((await config.caseProperties()).values).toHaveLength(0);

    // 补充：test-case 历史/类型/属性 + plan 类型 + execution update/list/batch
    s.mock.onGet('/testhub/cases/c1/history').reply(200, { values: [{ id: 'h1' }] });
    expect((await cases.history('c1')).values).toHaveLength(1);
    s.mock.onGet('/testhub/case/types').reply(200, { values: [{ id: 'ct1' }] });
    expect((await cases.types()).values).toHaveLength(1);
    s.mock.onGet('/testhub/case/properties').reply(200, { values: [] });
    expect((await cases.properties()).values).toHaveLength(0);
    s.mock.onGet('/testhub/case/modules').reply(200, { values: [{ id: 'cm1' }] });
    expect((await cases.modules()).values).toHaveLength(1);
    s.mock.onGet('/testhub/plan/types').reply(200, { values: [{ id: 'pt1' }] });
    expect((await plans.types()).values).toHaveLength(1);
    s.mock.onPatch('/testhub/executions/e1').reply(200, { id: 'e1' });
    expect((await exec.update('e1', { status: 'fail' })).id).toBe('e1');
    s.mock.onGet('/testhub/executions').reply(200, { values: [{ id: 'e1' }] });
    expect((await exec.list()).values).toHaveLength(1);
    const execBatch = await exec.batchCreate([{ plan_id: 'p1' }]);
    expect(execBatch.success).toBe(1);
  });

  it('products schedule + external-user update', async () => {
    const s = makeMock();
    const products = createProductsModule(s.client);
    s.mock.onGet('/product/products/pd1/schedules').reply(200, [{ id: 'sc1' }]);
    expect(await products.schedule('pd1')).toHaveLength(1);
    const customers = createCustomersModule(s.client);
    s.mock.onPatch('/product/external_users/eu1').reply(200, { id: 'eu1', updated: true });
    expect(await customers.externalUser.update('eu1', { name: 'X' })).toMatchObject({ updated: true });
  });
});
