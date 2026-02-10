/**
 * 统一响应格式工具
 */

/** 成功响应 */
export function success(data = null, message = '操作成功') {
  return {
    success: true,
    message,
    data,
  };
}

/** 错误响应（直接返回给客户端时使用） */
export function error(message = '操作失败', code = 500) {
  return {
    success: false,
    error: message,
    code,
  };
}

/** 分页响应 */
export function paginated(data, total, page, pageSize) {
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
