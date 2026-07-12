import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createClient } from '../../client.js';
import { createWorkItemSubResourcesModule } from '../../modules/workItemSubResources.js';

function setup() {
  const client = createClient({ host: 'https://t', credentials: { getToken: async () => 'tok' } });
  const mock = new MockAdapter(client.axios);
  return { mock, sub: createWorkItemSubResourcesModule(client) };
}

describe('workItemSubResources 模块', () => {
  let mock: MockAdapter;
  let sub: ReturnType<typeof createWorkItemSubResourcesModule>;
  beforeEach(() => {
    const s = setup();
    mock = s.mock;
    sub = s.sub;
  });
  afterEach(() => mock.restore());

  it('comments list/add/remove', async () => {
    mock.onGet('/project/work_items/w1/comments').reply(200, { values: [{ id: 'c1', content: 'hi' }] });
    let res = await sub.comments.list('w1');
    expect(res.values).toHaveLength(1);

    mock.onPost('/project/work_items/w1/comments').reply((cfg) => [200, { id: 'c2', got: JSON.parse(cfg.data) }]);
    const added = (await sub.comments.add('w1', 'hello')) as unknown as { got: { content: string } };
    expect(added.got).toEqual({ content: 'hello' });

    let deleted = false;
    mock.onDelete('/project/work_items/w1/comments/c1').reply(() => {
      deleted = true;
      return [204, null];
    });
    await sub.comments.remove('w1', 'c1');
    expect(deleted).toBe(true);
  });

  it('attachment upload 经 postForm 发送到正确端点', async () => {
    mock.onPost('/project/work_items/w1/attachments').reply(200, { id: 'a1', name: 'x.txt' });
    const form = new FormData();
    form.append('file', new Blob(['data']), 'x.txt');
    const res = (await sub.attachments.upload('w1', form)) as { id: string; name: string };
    expect(res.id).toBe('a1');
    // 断言请求方法/URL/有 body（multipart Content-Type 由 axios 在传输层设置，此处不校验）
    const req = mock.history.post[0];
    expect(req.method).toBe('post');
    expect(req.url).toBe('/project/work_items/w1/attachments');
    expect(req.data).toBeDefined();
  });

  it('watcher add / link create / tag add / history / deliverables', async () => {
    mock.onPost('/project/work_items/w1/watchers').reply((cfg) => [200, JSON.parse(cfg.data)]);
    expect(await sub.watchers.add('w1', 'u1')).toMatchObject({ user_id: 'u1' });

    mock.onPost('/project/work_items/w1/links').reply((cfg) => [200, JSON.parse(cfg.data)]);
    expect(await sub.links.create('w1', { target_id: 'w2', link_type_id: 'lt1' })).toMatchObject({ target_id: 'w2', link_type_id: 'lt1' });

    mock.onPost('/project/work_items/w1/tags').reply((cfg) => [200, JSON.parse(cfg.data)]);
    expect(await sub.tags.add('w1', 'bug')).toMatchObject({ name: 'bug' });

    mock.onGet('/project/work_items/w1/activities').reply(200, { values: [{ id: 'ac1' }] });
    expect((await sub.history('w1')).values).toHaveLength(1);

    mock.onGet('/project/work_items/w1/deliverables').reply(200, { values: [{ id: 'd1' }] });
    expect((await sub.deliverables('w1')).values).toHaveLength(1);
  });

  it('transition PATCH 工作项状态', async () => {
    mock.onPatch('/project/work_items/w1').reply((cfg) => [200, { id: 'w1', got: JSON.parse(cfg.data) }]);
    const res = (await sub.transition('w1', 's2')) as { got: { state_id: string } };
    expect(res.got).toEqual({ state_id: 's2' });
  });
});
