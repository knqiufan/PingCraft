import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { appConfig } from '../config/index.js';
import { withRetry } from '../utils/retry.js';
import { runWithConcurrency } from '../utils/array.js';

const { pingcode: pcConf } = appConfig;

/** PingCode OAuth2 grant_type 取值 */
export const PINGCODE_GRANT_AUTHORIZATION_CODE = 'authorization_code';
export const PINGCODE_GRANT_CLIENT_CREDENTIALS = 'client_credentials';

const THIRTY_DAYS_SEC = 30 * 24 * 3600;
const MAX_EXPIRES_IN_SEC = 40 * 24 * 3600;

/** 批量创建工作项进度回调的单条结果 */
export interface BatchProgressItem {
  title: string;
  status: 'success' | 'failed';
  error?: unknown;
}

/** 批量创建工作项结果 */
export interface BatchCreateResult {
  success: number;
  failed: number;
  errors: Array<{ local_id: any; item: any; error: any }>;
  created: Array<{ local_id: any; pingcode_id?: string; pingcode_identifier?: string; title: any }>;
}

/**
 * 根据 token 接口返回计算 access_token 过期时间（expires_in 按秒解析，异常值回退/裁剪）
 */
export function computeExpiresAtFromTokenResponse(tokenData: { expires_in?: unknown }): Date {
  let sec = Number(tokenData?.expires_in);
  if (!Number.isFinite(sec) || sec <= 0) {
    return new Date(Date.now() + THIRTY_DAYS_SEC * 1000);
  }
  if (sec > MAX_EXPIRES_IN_SEC) {
    sec = THIRTY_DAYS_SEC;
  }
  return new Date(Date.now() + sec * 1000);
}

/* ---- 域名与 API 地址处理 ---- */

function normalizeHost(domain?: string | null): string {
  if (!domain) return pcConf.host;

  const isSaaS = !domain.includes('.') || domain.endsWith('.pingcode.com');
  if (isSaaS) return pcConf.host;

  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain;
  return `https://${domain}`;
}

function getApiBase(domain?: string | null): string {
  return `${normalizeHost(domain)}/v1`;
}

/* ---- OAuth ---- */

/** 生成 PingCode OAuth 授权 URL */
export function getAuthUrl(clientId: string, state?: string): string {
  const url = new URL('/oauth2/authorize', pcConf.host);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', pcConf.redirectUri);
  url.searchParams.set('scope', 'project:read work_item:write wiki:read');
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}

/** 通过授权码获取令牌 */
export async function getToken(code: string, clientId: string, clientSecret: string): Promise<any> {
  const url = new URL('/v1/auth/token', pcConf.host);
  url.searchParams.set('grant_type', 'authorization_code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('code', code);
  url.searchParams.set('redirect_uri', pcConf.redirectUri);

  return withRetry(
    async () => {
      const res = await axios.get(url.toString());
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getToken' },
  );
}

/** 使用 refresh_token 刷新 access_token */
export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<any> {
  const url = new URL('/v1/auth/token', pcConf.host);
  url.searchParams.set('grant_type', 'refresh_token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('refresh_token', refreshToken);

  return withRetry(
    async () => {
      const res = await axios.get(url.toString());
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:refreshToken' },
  );
}

/** 企业令牌：client_credentials */
export async function getEnterpriseToken(clientId: string, clientSecret: string): Promise<any> {
  const url = new URL('/v1/auth/token', pcConf.host);
  url.searchParams.set('grant_type', PINGCODE_GRANT_CLIENT_CREDENTIALS);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);

  return withRetry(
    async () => {
      const res = await axios.get(url.toString());
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getEnterpriseToken' },
  );
}

/* ---- 项目与工作项 ---- */

/** 获取用户可访问的项目列表 */
export async function getProjects(token: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(`${apiBase}/project/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getProjects' },
  );
}

/**
 * 获取指定项目的工作项列表（自动分页，拉取全部数据）。
 *
 * 分页兼容：
 *   - 优先使用 `page_index`（0 基）+ `page_size`，兼容 PingCode 常见分页方式
 *   - 同时尝试 `total` / `total_count` 字段判断是否还有更多页
 *   - 主停止条件：本页返回条数 < page_size
 *   - 安全限制：最多拉取 100 页，避免分页参数异常导致死循环
 */
export async function getWorkItems(token: string, projectId: string, domain?: string): Promise<any[]> {
  const apiBase = getApiBase(domain);
  const pageSize = 100;
  const MAX_PAGES = 100;
  let allItems: any[] = [];
  let pageIndex = 0;
  let hasMore = true;

  while (hasMore && pageIndex < MAX_PAGES) {
    const data: any = await withRetry(
      async () => {
        const res = await axios.get(
          `${apiBase}/project/work_items?project_id=${projectId}&page_size=${pageSize}&page_index=${pageIndex}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.data;
      },
      { maxRetries: 2, label: `PingCode:getWorkItems(page=${pageIndex})` },
    );

    const items = Array.isArray(data) ? data : (data?.values || []);
    allItems = allItems.concat(items);

    const total = data?.total_count ?? data?.total ?? 0;
    // 主停止条件：本页不足一页；或已达到 total
    if (items.length < pageSize || (total > 0 && allItems.length >= total)) {
      hasMore = false;
    } else if (items.length === 0) {
      // 空页保险：避免 total 缺失时无限循环
      hasMore = false;
    } else {
      pageIndex++;
    }
  }

  if (pageIndex >= MAX_PAGES) {
    console.warn(
      `[PingCode] getWorkItems 达到最大分页限制 ${MAX_PAGES}（项目 ${projectId}），可能存在超过 ${MAX_PAGES * pageSize} 条工作项被截断`,
    );
  }

  return allItems;
}

/** 获取工作项类型列表 */
export async function getWorkItemTypes(token: string, projectId: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/types?project_id=${encodeURIComponent(projectId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemTypes' },
  );
}

/**
 * 获取项目成员列表（用于将 assignee_name 解析为 assignee_id）
 * PingCode API: GET /v1/project/projects/{projectId}/members
 */
export async function getProjectMembers(token: string, projectId: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/projects/${encodeURIComponent(projectId)}/members`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getProjectMembers' },
  );
}

/** 获取工作项状态列表 */
export async function getWorkItemStates(token: string, projectId: string, workItemTypeId: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/states?project_id=${encodeURIComponent(projectId)}&work_item_type_id=${encodeURIComponent(workItemTypeId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemStates' },
  );
}

/** 获取工作项属性列表 */
export async function getWorkItemProperties(token: string, projectId: string, workItemTypeId: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/properties?project_id=${encodeURIComponent(projectId)}&work_item_type_id=${encodeURIComponent(workItemTypeId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemProperties' },
  );
}

/** 获取工作项优先级列表 */
export async function getWorkItemPriorities(token: string, projectId: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/priorities?project_id=${encodeURIComponent(projectId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemPriorities' },
  );
}

/**
 * 创建项目
 */
export async function createProject(token: string, projectData: Record<string, unknown>, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.post(`${apiBase}/project/projects`, projectData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:createProject' },
  );
}

/**
 * 根据名称查找项目（精确匹配或模糊匹配）
 */
export async function findProjectByName(token: string, projectName: string, domain?: string): Promise<any> {
  const projectsRes = await getProjects(token, domain);
  const projectList: any[] = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.values || []);

  // 精确匹配
  const exactMatch = projectList.find((p) => p.name === projectName);
  if (exactMatch) return exactMatch;

  // 模糊匹配（忽略大小写）
  const fuzzyMatch = projectList.find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase(),
  );
  return fuzzyMatch || null;
}

/**
 * 更新单个工作项（P3-5.2）
 */
export async function updateWorkItem(token: string, workItemId: string, updateData: Record<string, unknown>, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.patch(
        `${apiBase}/project/work_items/${encodeURIComponent(workItemId)}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:updateWorkItem' },
  );
}

/**
 * 获取单个工作项详情（P3-5.2）
 */
export async function getWorkItemDetail(token: string, workItemId: string, domain?: string): Promise<any> {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_items/${encodeURIComponent(workItemId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemDetail' },
  );
}

/**
 * 批量创建工作项（有限并发调用 + 单条重试）
 *
 * 并发度由 PINGCODE_IMPORT_CONCURRENCY 控制（默认 3，可在 API 限流范围内提速）。
 * 进度回调仍按完成顺序触发，current 为累计已完成数量。
 */
export async function createWorkItemsBatch(
  token: string,
  items: any[],
  domain: string,
  onProgress?: (current: number, total: number, item: BatchProgressItem) => void,
): Promise<BatchCreateResult> {
  const apiBase = getApiBase(domain);
  const concurrency = Math.max(1, parseInt(process.env.PINGCODE_IMPORT_CONCURRENCY || '3', 10));
  const results: BatchCreateResult = {
    success: 0,
    failed: 0,
    errors: [],
    created: [],
  };

  const total = items.length;
  let completed = 0;

  const tasks = items.map((item) => async () => {
    const localId = item._local_id;
    const { _local_id, ...pingcodeItem } = item;

    try {
      let createdItem: any = null;
      await withRetry(
        async () => {
          const response = await axios.post(`${apiBase}/project/work_items`, pingcodeItem, {
            headers: { Authorization: `Bearer ${token}` },
          });
          createdItem = response.data;
        },
        { maxRetries: 2, label: 'PingCode:createWorkItem' },
      );
      results.success++;
      results.created.push({
        local_id: localId,
        pingcode_id: createdItem?.id,
        pingcode_identifier: createdItem?.identifier,
        title: pingcodeItem.title,
      });
      if (onProgress) {
        onProgress(++completed, total, { title: pingcodeItem.title, status: 'success' });
      }
    } catch (e: any) {
      results.failed++;
      const errorDetail = e.response?.data?.message || e.response?.data?.error || e.message;
      results.errors.push({
        local_id: localId,
        item: pingcodeItem.title,
        error: errorDetail,
      });
      if (onProgress) {
        onProgress(++completed, total, { title: pingcodeItem.title, status: 'failed', error: errorDetail });
      }
    }
  });

  await runWithConcurrency(tasks, concurrency);

  return results;
}

/* ---- 用户信息 ---- */

/** 从 JWT 中解析用户 ID */
export function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwtDecode(token) as Record<string, unknown>;
    return (decoded.sub || decoded.uid || decoded.user_id) as string | null;
  } catch {
    return null;
  }
}

/** 通过 API 获取用户信息（directory/users/me） */
export async function fetchUserInfo(token: string, domain?: string): Promise<any> {
  try {
    const apiBase = getApiBase(domain);
    const res = await axios.get(`${apiBase}/directory/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch {
    return null;
  }
}

/** 获取当前登录用户信息（GET /v1/myself） */
export async function getMyself(token: string, domain?: string): Promise<any> {
  try {
    const apiBase = getApiBase(domain);
    const res = await axios.get(`${apiBase}/myself`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (e) {
    console.warn('[PingCode] getMyself failed:', (e as Error).message);
    return null;
  }
}
