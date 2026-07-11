import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
  },
}));

vi.mock('../../models/index.js', () => ({
  User: {
    create: vi.fn(),
    findOne: vi.fn(),
  },
  Role: {
    findOne: vi.fn(),
  },
  UserRole: {
    create: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock('../../config/index.js', () => ({
  appConfig: {
    jwt: { secret: 'test-secret' },
  },
}));

vi.mock('../../utils/retry.js', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

vi.mock('../../utils/response.js', () => ({
  success: (data, message) => ({ success: true, data, message }),
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Role, UserRole } from '../../models/index.js';

// We need to test the route handlers directly since we don't want to start the full app
// Import the router and test with mock req/res
import { mockReq, mockRes, mockNext } from '../../__tests__/setup.js';

// Since the route handlers are wrapped in express router, we'll import the module
// and extract the handler functions by hooking into express.Router
let registerHandler, loginHandler;

vi.mock('express', async () => {
  const handlers = {};
  const mockRouter = {
    post: vi.fn((path, ...args) => {
      const handler = args[args.length - 1];
      handlers[`POST ${path}`] = handler;
    }),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    use: vi.fn(),
  };
  return {
    default: {
      Router: vi.fn(() => mockRouter),
      json: vi.fn(() => (req, res, next) => next()),
    },
    __handlers: handlers,
    __router: mockRouter,
  };
});

// Import after mocks
const expressModule = await import('express');
await import('../../routes/localAuth.js');
const handlers = expressModule.__handlers;
registerHandler = handlers['POST /register'];
loginHandler = handlers['POST /login'];

describe('localAuth routes', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = mockReq();
    res = mockRes();
    next = mockNext();
  });

  describe('POST /register', () => {
    it('should register successfully', async () => {
      req.body = { username: 'testuser', password: 'pass123' };
      bcrypt.hash.mockResolvedValue('hashed');
      User.create.mockResolvedValue({ id: 'u1', username: 'testuser' });
      Role.findOne.mockResolvedValue({ id: 'r1' });
      UserRole.create.mockResolvedValue({});

      await registerHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should return 400 when missing fields', async () => {
      req.body = { username: '' };
      await registerHandler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for duplicate username', async () => {
      req.body = { username: 'testuser', password: 'pass123' };
      bcrypt.hash.mockResolvedValue('hashed');
      const uniqueError = new Error('Unique constraint');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      User.create.mockRejectedValue(uniqueError);

      await registerHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: '用户名已存在' })
      );
    });
  });

  describe('POST /login', () => {
    it('should login successfully', async () => {
      req.body = { username: 'testuser', password: 'pass123' };
      const mockUser = { id: 'u1', username: 'testuser', password_hash: 'hashed' };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      UserRole.findAll.mockResolvedValue([{ Role: { name: 'user' } }]);
      jwt.sign.mockReturnValue('jwt-token');

      await loginHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'jwt-token',
        })
      );
    });

    it('should return 401 for wrong password', async () => {
      req.body = { username: 'testuser', password: 'wrong' };
      User.findOne.mockResolvedValue({ id: 'u1', password_hash: 'hashed' });
      bcrypt.compare.mockResolvedValue(false);

      await loginHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when missing fields', async () => {
      req.body = {};
      await loginHandler(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
