import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { appConfig } from '../config/index.js';
import { withRetry } from '../utils/retry.js';

const { pingcode: pcConf } = appConfig;

/* ---- 域名与 API 地址处理 ---- */

function normalizeHost(domain) {
  if (!domain) return pcConf.host;

  const isSaaS = !domain.includes('.') || domain.endsWith('.pingcode.com');
  if (isSaaS) return 'https://open.pingcode.com';

  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain;
  return `https://${domain}`;
}

function getApiBase(domain) {
  return `${normalizeHost(domain)}/v1`;
}

/* ---- OAuth ---- */

/** 生成 PingCode OAuth 授权 URL */
export function getAuthUrl(clientId, state) {
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
export async function getToken(code, clientId, clientSecret) {
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
    { maxRetries: 2, label: 'PingCode:getToken' }
  );
}

/* ---- 项目与工作项 ---- */

/** 获取用户可访问的项目列表 */
export async function getProjects(token, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(`${apiBase}/project/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getProjects' }
  );
}

/** 获取指定项目的工作项列表 */
export async function getWorkItems(token, projectId, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(`${apiBase}/project/work_items?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItems' }
  );
}

/** 获取工作项类型列表 */
export async function getWorkItemTypes(token, projectId, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/types?project_id=${encodeURIComponent(projectId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemTypes' }
  );
}

/** 获取工作项状态列表 */
export async function getWorkItemStates(token, projectId, workItemTypeId, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/states?project_id=${encodeURIComponent(projectId)}&work_item_type_id=${encodeURIComponent(workItemTypeId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemStates' }
  );
}

/** 获取工作项属性列表 */
export async function getWorkItemProperties(token, projectId, workItemTypeId, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/properties?project_id=${encodeURIComponent(projectId)}&work_item_type_id=${encodeURIComponent(workItemTypeId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemProperties' }
  );
}

/** 获取工作项优先级列表 */
export async function getWorkItemPriorities(token, projectId, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.get(
        `${apiBase}/project/work_item/priorities?project_id=${encodeURIComponent(projectId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:getWorkItemPriorities' }
  );
}

/**
 * 创建项目
 * @param {string} token - 访问令牌
 * @param {object} projectData - 项目数据
 * @param {string} projectData.name - 项目名称（必填）
 * @param {string} projectData.type - 项目类型（必填）: kanban, scrum, waterfall, hybrid
 * @param {string} projectData.identifier - 项目标识（必填）: 大写字母/数字/下划线/连接线，不超过15字符
 * @param {string} [projectData.description] - 项目描述
 * @param {string} [projectData.assignee_id] - 项目负责人 ID
 * @param {string} domain - 域名
 * @returns {Promise<object>} 创建的项目信息
 */
export async function createProject(token, projectData, domain) {
  const apiBase = getApiBase(domain);
  return withRetry(
    async () => {
      const res = await axios.post(`${apiBase}/project/projects`, projectData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    { maxRetries: 2, label: 'PingCode:createProject' }
  );
}

/**
 * 根据名称查找项目（精确匹配或模糊匹配）
 * @param {string} token - 访问令牌
 * @param {string} projectName - 项目名称
 * @param {string} domain - 域名
 * @returns {Promise<object|null>} 匹配的项目或 null
 */
export async function findProjectByName(token, projectName, domain) {
  const projectsRes = await getProjects(token, domain);
  const projectList = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.values || []);
  
  // 精确匹配
  const exactMatch = projectList.find((p) => p.name === projectName);
  if (exactMatch) return exactMatch;
  
  // 模糊匹配（忽略大小写）
  const fuzzyMatch = projectList.find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase()
  );
  return fuzzyMatch || null;
}

/** 批量创建工作项（逐条调用 + 重试） */
export async function createWorkItemsBatch(token, items, domain) {
  const apiBase = getApiBase(domain);
  const results = { success: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      await withRetry(
        async () => {
          await axios.post(`${apiBase}/project/work_items`, item, {
            headers: { Authorization: `Bearer ${token}` },
          });
        },
        { maxRetries: 2, label: 'PingCode:createWorkItem' }
      );
      results.success++;
    } catch (e) {
      results.failed++;
      // 获取更详细的错误信息
      const errorDetail = e.response?.data?.message || e.response?.data?.error || e.message;
      results.errors.push({ item: item.title, error: errorDetail });
    }
  }

  return results;
}

/* ---- 用户信息 ---- */

/** 从 JWT 中解析用户 ID */
export function getUserIdFromToken(token) {
  try {
    const decoded = jwtDecode(token);
    return decoded.sub || decoded.uid || decoded.user_id;
  } catch {
    return null;
  }
}

/** 通过 API 获取用户信息（directory/users/me） */
export async function fetchUserInfo(token, domain) {
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
export async function getMyself(token, domain) {
  try {
    const apiBase = getApiBase(domain);
    const res = await axios.get(`${apiBase}/myself`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (e) {
    console.warn('[PingCode] getMyself failed:', e.message);
    return null;
  }
}
