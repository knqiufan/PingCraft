/**
 * SDK 共享类型（L2）。
 *
 * PingCode 响应为动态结构；这里给出最小可用的契约，避免全 `any`，
 * 同时保留 `[k: string]: unknown` 以兼容未知字段。
 */

/** PingCode 列表响应：数组在 values，总数可能在 total 或 total_count */
export interface PingCodeList<T> {
  values?: T[];
  total?: number;
  total_count?: number;
  /** 有些端点直接返回数组（非对象包裹） */
  [k: string]: unknown;
}

/** 规范化提取列表响应为 { values, total } */
export function extractList<T>(data: PingCodeList<T> | T[]): { values: T[]; total?: number } {
  if (Array.isArray(data)) {
    return { values: data, total: data.length };
  }
  const values = Array.isArray(data?.values) ? (data.values as T[]) : [];
  const total = data?.total ?? data?.total_count;
  return { values, total };
}

/** 通用分页查询参数 */
export interface PageParams {
  pageIndex?: number;
  pageSize?: number;
}

/** 通用标识符（多数为字符串 UUID/identifier） */
export type Id = string;
