import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../config/index.js', () => ({
  appConfig: {
    pingcode: {
      host: 'https://open.pingcode.com',
      redirectUri: 'http://localhost:3000/auth/callback',
    },
  },
}));

vi.mock('../../utils/retry.js', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

import axios from 'axios';
import {
  getAuthUrl,
  getToken,
  refreshAccessToken,
  getEnterpriseToken,
  computeExpiresAtFromTokenResponse,
  getProjects,
  getWorkItems,
  findProjectByName,
  createWorkItemsBatch,
  getUserIdFromToken,
} from '../pingcode.js';

describe('PingCode Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthUrl()', () => {
    it('should generate correct OAuth URL', () => {
      const url = getAuthUrl('client123', 'state456');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=client123');
      expect(url).toContain('state=state456');
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('getToken()', () => {
    it('should call axios.get with correct URL params', async () => {
      axios.get.mockResolvedValue({ data: { access_token: 'token123' } });
      const result = await getToken('code123', 'client123', 'secret123');
      expect(axios.get).toHaveBeenCalled();
      const calledUrl = axios.get.mock.calls[0][0];
      expect(calledUrl).toContain('grant_type=authorization_code');
      expect(calledUrl).toContain('code=code123');
      expect(result).toEqual({ access_token: 'token123' });
    });
  });

  describe('refreshAccessToken()', () => {
    it('should call axios.get with refresh_token params', async () => {
      axios.get.mockResolvedValue({ data: { access_token: 'new_token' } });
      const result = await refreshAccessToken('refresh123', 'client123', 'secret123');
      expect(axios.get).toHaveBeenCalled();
      const calledUrl = axios.get.mock.calls[0][0];
      expect(calledUrl).toContain('grant_type=refresh_token');
      expect(calledUrl).toContain('refresh_token=refresh123');
      expect(result).toEqual({ access_token: 'new_token' });
    });
  });

  describe('getEnterpriseToken()', () => {
    it('should call axios.get with client_credentials params', async () => {
      axios.get.mockResolvedValue({ data: { access_token: 'ent_token', expires_in: 3600 } });
      const result = await getEnterpriseToken('cid', 'csecret');
      expect(axios.get).toHaveBeenCalled();
      const calledUrl = axios.get.mock.calls[0][0];
      expect(calledUrl).toContain('grant_type=client_credentials');
      expect(calledUrl).toContain('client_id=cid');
      expect(calledUrl).toContain('client_secret=csecret');
      expect(result.access_token).toBe('ent_token');
    });
  });

  describe('computeExpiresAtFromTokenResponse()', () => {
    it('should add expires_in seconds to now', () => {
      const before = Date.now();
      const d = computeExpiresAtFromTokenResponse({ expires_in: 60 });
      const after = Date.now();
      expect(d.getTime()).toBeGreaterThanOrEqual(before + 59_000);
      expect(d.getTime()).toBeLessThanOrEqual(after + 61_000);
    });

    it('should default to 30 days when expires_in missing', () => {
      const d = computeExpiresAtFromTokenResponse({});
      const span = d.getTime() - Date.now();
      expect(span).toBeGreaterThan(29 * 24 * 3600 * 1000);
      expect(span).toBeLessThan(31 * 24 * 3600 * 1000);
    });
  });

  describe('getProjects()', () => {
    it('should pass Bearer token header', async () => {
      axios.get.mockResolvedValue({ data: { values: [] } });
      await getProjects('mytoken', 'test.pingcode.com');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/project/projects'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer mytoken' },
        })
      );
    });
  });

  describe('getWorkItems()', () => {
    it('should handle multi-page responses', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: {
            values: Array(100).fill({ id: 'item', title: 'test' }),
            total_count: 150,
          },
        })
        .mockResolvedValueOnce({
          data: {
            values: Array(50).fill({ id: 'item2', title: 'test2' }),
            total_count: 150,
          },
        });

      const result = await getWorkItems('token', 'proj1', 'test.pingcode.com');
      expect(result).toHaveLength(150);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('findProjectByName()', () => {
    it('should return exact match first', async () => {
      axios.get.mockResolvedValue({
        data: {
          values: [
            { id: '1', name: 'Test Project' },
            { id: '2', name: 'test project' },
          ],
        },
      });
      const result = await findProjectByName('token', 'Test Project', 'domain');
      expect(result.id).toBe('1');
    });

    it('should fallback to fuzzy match', async () => {
      axios.get.mockResolvedValue({
        data: {
          values: [{ id: '1', name: 'Test Project' }],
        },
      });
      const result = await findProjectByName('token', 'test project', 'domain');
      expect(result.id).toBe('1');
    });

    it('should return null when no match', async () => {
      axios.get.mockResolvedValue({ data: { values: [] } });
      const result = await findProjectByName('token', 'NoMatch', 'domain');
      expect(result).toBeNull();
    });
  });

  describe('createWorkItemsBatch()', () => {
    it('should create all items successfully', async () => {
      axios.post.mockResolvedValue({ data: { id: 'created-1', identifier: 'WI-1' } });
      const items = [
        { _local_id: 'l1', title: 'Item 1', project_id: 'p1', type_id: 't1' },
        { _local_id: 'l2', title: 'Item 2', project_id: 'p1', type_id: 't1' },
      ];
      const result = await createWorkItemsBatch('token', items, 'domain');
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.created).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      axios.post
        .mockResolvedValueOnce({ data: { id: 'created-1' } })
        .mockRejectedValueOnce(new Error('API error'));
      const items = [
        { _local_id: 'l1', title: 'Item 1', project_id: 'p1', type_id: 't1' },
        { _local_id: 'l2', title: 'Item 2', project_id: 'p1', type_id: 't1' },
      ];
      const result = await createWorkItemsBatch('token', items, 'domain');
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should call onProgress callback', async () => {
      axios.post.mockResolvedValue({ data: { id: 'created-1' } });
      const onProgress = vi.fn();
      const items = [{ _local_id: 'l1', title: 'Item 1', project_id: 'p1', type_id: 't1' }];
      await createWorkItemsBatch('token', items, 'domain', onProgress);
      expect(onProgress).toHaveBeenCalledWith(1, 1, expect.objectContaining({ title: 'Item 1', status: 'success' }));
    });
  });

  describe('getUserIdFromToken()', () => {
    it('should extract user ID from valid JWT', () => {
      // Create a simple JWT with sub claim (header.payload.signature)
      const payload = Buffer.from(JSON.stringify({ sub: 'user123' })).toString('base64url');
      const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
      const result = getUserIdFromToken(token);
      expect(result).toBe('user123');
    });

    it('should return null for invalid JWT', () => {
      const result = getUserIdFromToken('invalid-token');
      expect(result).toBeNull();
    });
  });
});
