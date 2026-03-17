import { describe, it, expect } from 'vitest';
import { success, error, paginated } from '../response.js';

describe('response utils', () => {
  describe('success()', () => {
    it('should return default success response', () => {
      const res = success();
      expect(res).toEqual({ success: true, message: '操作成功', data: null });
    });

    it('should return custom data and message', () => {
      const res = success({ id: 1 }, '创建成功');
      expect(res).toEqual({ success: true, message: '创建成功', data: { id: 1 } });
    });
  });

  describe('error()', () => {
    it('should return default error response', () => {
      const res = error();
      expect(res).toEqual({ success: false, error: '操作失败', code: 500 });
    });

    it('should return custom message and code', () => {
      const res = error('未找到', 404);
      expect(res).toEqual({ success: false, error: '未找到', code: 404 });
    });
  });

  describe('paginated()', () => {
    it('should return paginated response', () => {
      const res = paginated([1, 2], 10, 1, 20);
      expect(res).toEqual({
        success: true,
        data: [1, 2],
        pagination: { total: 10, page: 1, pageSize: 20 },
      });
    });
  });
});
