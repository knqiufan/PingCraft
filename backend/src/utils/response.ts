/**
 * 统一响应格式工具
 */

/** 统一 API 响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: number;
  pagination?: { total: number; page: number; pageSize: number };
}

/** 成功响应 */
export function success(data: unknown = null, message = '操作成功'): ApiResponse {
  return {
    success: true,
    message,
    data,
  };
}

/** 错误响应（直接返回给客户端时使用） */
export function error(message = '操作失败', code = 500): ApiResponse {
  return {
    success: false,
    error: message,
    code,
  };
}

/** 分页响应 */
export function paginated(
  data: unknown,
  total: number,
  page: number,
  pageSize: number,
): ApiResponse {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
    },
  };
}
