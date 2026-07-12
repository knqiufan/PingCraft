import { describe, it, expect, vi } from 'vitest';
import {
  parsePagingOptions,
  paginate,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../pagination.js';

describe('parsePagingOptions()', () => {
  it('默认值：page=0, pageSize=30, fetchAll=false', () => {
    expect(parsePagingOptions()).toEqual({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, fetchAll: false });
  });

  it('负数/非整数 page 归零', () => {
    expect(parsePagingOptions({ page: -1 }).pageIndex).toBe(0);
    expect(parsePagingOptions({ page: 1.5 }).pageIndex).toBe(0);
  });

  it('合法 page 保留', () => {
    expect(parsePagingOptions({ page: 3 }).pageIndex).toBe(3);
  });

  it('pageSize 超上限裁剪到 100', () => {
    expect(parsePagingOptions({ pageSize: 500 }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('pageSize 非法回退到默认', () => {
    expect(parsePagingOptions({ pageSize: 0 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagingOptions({ pageSize: -5 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagingOptions({ pageSize: NaN }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('all=true → fetchAll=true', () => {
    expect(parsePagingOptions({ all: true }).fetchAll).toBe(true);
  });
});

describe('paginate()', () => {
  it('单页即停（返回条数 < pageSize）', async () => {
    const fetchPage = vi.fn(async () => ({ values: [1, 2, 3] }));
    const res = await paginate(fetchPage, { pageSize: 10 });
    expect(res.values).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(res.truncated).toBe(false);
  });

  it('多页直到本页不足', async () => {
    const pages = [
      { values: [1, 2], total: 3 },
      { values: [3], total: 3 },
    ];
    const fetchPage = vi.fn(async () => pages[0] && pages.shift()!);
    const res = await paginate<number>(fetchPage as never, { pageSize: 2 });
    expect(res.values).toEqual([1, 2, 3]);
    expect(res.total).toBe(3);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('total 达标即停（即便本页满）', async () => {
    const pages = [
      { values: [1, 2], total: 2 },
    ];
    const fetchPage = vi.fn(async () => pages[0] && pages.shift()!);
    const res = await paginate<number>(fetchPage as never, { pageSize: 2 });
    expect(res.values).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('空页保险停止', async () => {
    const fetchPage = vi.fn(async () => ({ values: [] }));
    const res = await paginate(fetchPage, { pageSize: 10 });
    expect(res.values).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('MAX_PAGES 截断标记 truncated=true', async () => {
    // 每页都满且无 total → 会持续直到 maxPages
    const fetchPage = vi.fn(async () => ({ values: [1, 2, 3] }));
    const res = await paginate(fetchPage, { pageSize: 3, maxPages: 4 });
    expect(res.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(res.values.length).toBe(12);
  });

  it('result.values 非数组时视为空', async () => {
    const fetchPage = vi.fn(async () => ({ values: 'not-array' as unknown as number[] }));
    const res = await paginate<number>(fetchPage, { pageSize: 10 });
    expect(res.values).toEqual([]);
  });
});
