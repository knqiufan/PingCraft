/**
 * 分页工具（L1 core）。
 *
 * PingCode 分页约定（对照后端 `getWorkItems`）：
 *  - `page_index`（0 基）+ `page_size`（默认 30，最大 100）
 *  - 响应 `values`（数组）+ `total`/`total_count`（总数，可能缺失）
 *
 * `paginate()` 复刻后端的安全停止条件 + MAX_PAGES 上限，避免分页参数异常导致死循环。
 */

/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 30;
/** 单页最大条数（PingCode 上限） */
export const MAX_PAGE_SIZE = 100;
/** 安全上限：最多遍历页数，防止死循环 */
export const DEFAULT_MAX_PAGES = 100;

/** 命令行分页输入（来自 --page/--page-size/--all，Commander 传字符串） */
export interface PagingInputOptions {
  /** 0 基页码 */
  page?: string | number;
  /** 每页条数 */
  pageSize?: string | number;
  /** 拉取全量 */
  all?: boolean;
}

/** 解析后的分页参数 */
export interface PagingOptions {
  pageIndex: number;
  pageSize: number;
  fetchAll: boolean;
}

/**
 * 解析分页输入：
 *  - `page` 负数或非整数 → 0；`pageSize` 裁剪到 [1, 100]；
 *  - `all=true` 时 `fetchAll=true`（仍返回起始 pageIndex/pageSize 供首屏/全量使用）。
 */
export function parsePagingOptions(input: PagingInputOptions = {}): PagingOptions {
  const rawPage = Number(input.page);
  const pageIndex = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;

  let pageSize = Number(input.pageSize);
  if (!Number.isFinite(pageSize) || pageSize <= 0) pageSize = DEFAULT_PAGE_SIZE;
  pageSize = Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);

  return {
    pageIndex,
    pageSize,
    fetchAll: Boolean(input.all),
  };
}

/** 单页结果 */
export interface PageResult<T> {
  values: T[];
  /** 总数（可缺失；用于提前停止） */
  total?: number;
}

export interface PaginateOptions {
  /** 每页条数（默认 100，接近 PingCode 上限以减少请求次数） */
  pageSize?: number;
  /** 起始页码（默认 0） */
  startPage?: number;
  /** 最大页数上限（默认 100） */
  maxPages?: number;
}

export interface PaginateResult<T> {
  values: T[];
  total?: number;
  /** 是否因达到 maxPages 而截断 */
  truncated: boolean;
}

/**
 * 自动遍历全量分页。
 *
 * 停止条件（任一满足）：
 *  1. 本页返回条数 < pageSize
 *  2. total>0 且累计条数 >= total
 *  3. 本页为空
 *  4. 达到 maxPages（标记 truncated=true）
 *
 * @param fetchPage 给定 (pageIndex, pageSize) 返回单页结果
 */
export async function paginate<T>(
  fetchPage: (pageIndex: number, pageSize: number) => Promise<PageResult<T>>,
  opts: PaginateOptions = {},
): Promise<PaginateResult<T>> {
  const pageSize = opts.pageSize ?? MAX_PAGE_SIZE;
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  let pageIndex = opts.startPage ?? 0;

  const values: T[] = [];
  let total: number | undefined;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(pageIndex, pageSize);
    const pageValues = Array.isArray(result.values) ? result.values : [];
    values.push(...pageValues);

    if (result.total !== undefined && total === undefined) {
      total = result.total;
    } else if (result.total !== undefined) {
      total = result.total; // 以最新 total 为准
    }

    // 停止条件
    if (pageValues.length === 0) break;
    if (pageValues.length < pageSize) break;
    if (total !== undefined && total > 0 && values.length >= total) break;

    pageIndex++;
    if (page + 1 >= maxPages) {
      truncated = true;
      break;
    }
  }

  return { values, total, truncated };
}
