import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'test-user-id', access_token: 'test-token', domain: 'test.pingcode.com', pingcode_user_id: 'pc-user' };
    next();
  },
}));

vi.mock('../../middleware/tokenRefresh.js', () => ({
  ensureFreshToken: (req, res, next) => next(),
}));

vi.mock('../../services/db.js', () => ({
  seekdbClient: {
    getCollection: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ ids: [[]], metadatas: [[]], distances: [[]] }),
    }),
  },
}));

vi.mock('../../services/pingcode.js', () => ({
  createWorkItemsBatch: vi.fn(),
  createProject: vi.fn(),
  getProjects: vi.fn(),
}));

vi.mock('../../models/index.js', () => ({
  ImportRecord: { findOne: vi.fn(), update: vi.fn() },
  ImportRecordItem: { update: vi.fn() },
  WorkItemType: { findAll: vi.fn().mockResolvedValue([]) },
  WorkItemPriority: { findAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../utils/response.js', () => ({
  success: (data, message) => ({ success: true, data, message }),
}));

vi.mock('../../utils/workItem.js', () => ({
  generateProjectIdentifier: vi.fn().mockReturnValue('TEST_PROJ'),
  toUnixTimestamp: vi.fn((v) => v ? 1234567890 : null),
  resolveTypeId: vi.fn((id) => id || 'story'),
  resolvePriorityId: vi.fn(() => null),
}));

// Capture route handlers
let routeHandlers = {};

vi.mock('express', () => {
  const mockRouter = {
    get: vi.fn((path, ...args) => {
      routeHandlers[`GET ${path}`] = args;
    }),
    post: vi.fn((path, ...args) => {
      routeHandlers[`POST ${path}`] = args;
    }),
    put: vi.fn(),
    delete: vi.fn(),
    use: vi.fn(),
  };
  return {
    default: {
      Router: vi.fn(() => mockRouter),
    },
  };
});

import { seekdbClient } from '../../services/db.js';
import { createWorkItemsBatch, getProjects } from '../../services/pingcode.js';
import { ImportRecord } from '../../models/index.js';
await import('../../routes/workItems.js');

function getHandler(method, path) {
  const args = routeHandlers[`${method} ${path}`];
  return args[args.length - 1];
}

describe('workItems routes', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { id: 'test-user-id', access_token: 'test-token', domain: 'test.pingcode.com', pingcode_user_id: 'pc-user' },
      body: {},
      params: {},
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  describe('POST /match-project', () => {
    it('should return 400 when no requirements', async () => {
      req.body = {};
      const handler = getHandler('POST', '/match-project');
      await handler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return matched projects', async () => {
      req.body = { requirements: [{ project_name: 'Test' }] };
      const mockColl = {
        query: vi.fn().mockResolvedValue({
          ids: [['proj-1']],
          metadatas: [[{ name: 'Test Project' }]],
          distances: [[0.5]],
        }),
      };
      seekdbClient.getCollection.mockResolvedValue(mockColl);

      const handler = getHandler('POST', '/match-project');
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('POST /check-duplicates', () => {
    it('should return 400 when missing params', async () => {
      req.body = {};
      const handler = getHandler('POST', '/check-duplicates');
      await handler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return checked items', async () => {
      req.body = { items: [{ title: 'Test Item' }], projectId: 'p1' };
      const mockColl = {
        query: vi.fn().mockResolvedValue({
          ids: [['wi-1']],
          metadatas: [[{ title: 'Test Item' }]],
          distances: [[0.3]],
        }),
      };
      seekdbClient.getCollection.mockResolvedValue(mockColl);

      const handler = getHandler('POST', '/check-duplicates');
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('POST /import', () => {
    it('should import items successfully', async () => {
      req.body = {
        items: [{ id: 'l1', title: 'Item 1', type_id: 'story' }],
        projectId: 'p1',
      };
      getProjects.mockResolvedValue({ values: [{ id: 'p1', name: 'Proj' }] });
      createWorkItemsBatch.mockResolvedValue({
        success: 1, failed: 0, errors: [], created: [],
      });

      const handler = getHandler('POST', '/import');
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should return 400 when no items', async () => {
      req.body = { items: [] };
      const handler = getHandler('POST', '/import');
      await handler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
