import { vi } from 'vitest';

// Silence console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

/** Create a mock Express request */
export function mockReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    user: null,
    ...overrides,
  };
}

/** Create a mock Express response */
export function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn(),
    statusCode: 200,
  };
  return res;
}

/** Create a mock next function */
export function mockNext() {
  return vi.fn();
}
