import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: { unlink: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../models/index.js', () => ({
  ImportRecord: {
    findAndCountAll: vi.fn(),
    findOne: vi.fn(),
  },
  ImportRecordItem: {
    findAll: vi.fn(),
  },
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  },
}));

vi.mock('../../utils/response.js', async () => {
  return {
    success: (data, message) => ({ success: true, data, message }),
  };
});

vi.mock('sequelize', () => ({
  Op: { and: Symbol('and') },
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
    put: vi.fn((path, ...args) => {
      routeHandlers[`PUT ${path}`] = args;
    }),
    delete: vi.fn((path, ...args) => {
      routeHandlers[`DELETE ${path}`] = args;
    }),
    use: vi.fn(),
  };
  return {
    default: {
      Router: vi.fn(() => mockRouter),
    },
  };
});

import { ImportRecord, ImportRecordItem } from '../../models/index.js';
await import('../../routes/records.js');

function getHandler(method, path) {
  const args = routeHandlers[`${method} ${path}`];
  // The last arg is the handler, middlewares come before
  return args[args.length - 1];
}

describe('records routes', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { id: 'test-user-id' },
      params: {},
      query: {},
      body: {},
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  describe('GET /', () => {
    it('should return paginated list', async () => {
      ImportRecord.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [{ id: 'r1' }],
      });
      const handler = getHandler('GET', '/');
      await handler(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('GET /:id', () => {
    it('should return record detail', async () => {
      req.params.id = 'r1';
      ImportRecord.findOne.mockResolvedValue({ id: 'r1' });
      const handler = getHandler('GET', '/:id');
      await handler(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should return 404 when not found', async () => {
      req.params.id = 'not-found';
      ImportRecord.findOne.mockResolvedValue(null);
      const handler = getHandler('GET', '/:id');
      await handler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete record', async () => {
      req.params.id = 'r1';
      const mockRecord = { id: 'r1', destroy: vi.fn().mockResolvedValue(undefined), original_file_path: null };
      ImportRecord.findOne.mockResolvedValue(mockRecord);
      const handler = getHandler('DELETE', '/:id');
      await handler(req, res, next);
      expect(mockRecord.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('GET /:id/restore', () => {
    it('should restore analysis from record', async () => {
      req.params.id = 'r1';
      ImportRecord.findOne.mockResolvedValue({
        id: 'r1',
        target_project_name: 'Test',
        target_project_id: 'p1',
        file_name: 'test.txt',
      });
      ImportRecordItem.findAll.mockResolvedValue([
        { id: 'i1', title: 'Item 1', description: 'desc', project_name: 'Test', type_id: 'story', status: 'pending' },
      ]);
      const handler = getHandler('GET', '/:id/restore');
      await handler(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});
