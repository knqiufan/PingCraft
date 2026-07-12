/**
 * PingCraft 业务 API（L2 sdk/pingcraft）。
 *
 * 对接本地 PingCraft 后端路由（见 Phase 3 §5 对照表）。
 * 凭证为本地 JWT（pingcraft_token），与 PingCode 官方 token 分离。
 */
import type { PingcraftClient } from './client.js';
import { consumeSSE, type SseEvent } from './client.js';

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: { id?: string; username?: string; roles?: string[] };
  error?: string;
}

export interface AnalyzeResult {
  items?: unknown[];
  [k: string]: unknown;
}

export interface ImportStreamHandlers {
  onStart?: (data: { total: number }) => void;
  onProgress?: (data: Record<string, unknown>) => void;
  onProjectCreated?: (data: { name: string }) => void;
  onComplete?: (data: { result: Record<string, unknown> }) => void;
  onError?: (data: { message: string }) => void;
}

export function createPingcraftApi(client: PingcraftClient) {
  return {
    // ---- 认证 ----
    async login(username: string, password: string): Promise<LoginResult> {
      return client.post<LoginResult>('/auth/local/login', { username, password });
    },
    async loginUrl(): Promise<unknown> {
      return client.get('/auth/login-url');
    },
    async enterpriseToken(body: Record<string, unknown>): Promise<unknown> {
      return client.post('/auth/pingcode/enterprise-token', body);
    },

    // ---- 配置 ----
    async getConfig(): Promise<unknown> {
      return client.get('/api/config');
    },
    async setConfig(body: Record<string, unknown>): Promise<unknown> {
      return client.post('/api/config', body);
    },

    // ---- 同步 ----
    async sync(): Promise<unknown> {
      return client.post('/api/sync-data', {});
    },
    async syncClear(): Promise<unknown> {
      return client.delete('/api/sync-data');
    },

    // ---- 需求分析 ----
    async analyze(formData: FormData): Promise<AnalyzeResult> {
      return client.postForm<AnalyzeResult>('/api/analyze', formData);
    },

    async matchProject(body: { requirements: unknown[]; projectName?: string }): Promise<unknown> {
      return client.post('/api/match-project', body);
    },

    async checkDuplicates(body: { projectId: string; items: unknown[] }): Promise<unknown> {
      return client.post('/api/check-duplicates', body);
    },

    async importItems(body: { items: unknown[]; projectId: string; record_id?: string }): Promise<unknown> {
      return client.post('/api/import', body);
    },

    /** 流式导入（SSE），按事件回调；返回 complete 事件的结果 */
    async importStream(body: { items: unknown[]; projectId?: string; autoCreateProject?: boolean; record_id?: string }, handlers: ImportStreamHandlers = {}): Promise<Record<string, unknown>> {
      const res = await client.postStream('/api/import-stream', body);
      let finalResult: Record<string, unknown> = {};
      await consumeSSE(res.data as NodeJS.ReadableStream, (ev: SseEvent) => {
        const data = ev.data as Record<string, unknown>;
        switch (ev.event) {
          case 'start':
            handlers.onStart?.(data as never);
            break;
          case 'progress':
            handlers.onProgress?.(data);
            break;
          case 'project_created':
            handlers.onProjectCreated?.(data as never);
            break;
          case 'complete':
            finalResult = (data as { result: Record<string, unknown> }).result ?? data;
            handlers.onComplete?.(data as never);
            break;
          case 'error':
            handlers.onError?.(data as never);
            break;
        }
      });
      return finalResult;
    },

    // ---- 记录 / 统计 / 元数据 / 模型 / 用户 ----
    async listRecords(): Promise<unknown> {
      return client.get('/api/records');
    },
    async getRecord(id: string): Promise<unknown> {
      return client.get(`/api/records/${id}`);
    },
    async deleteRecord(id: string): Promise<unknown> {
      return client.delete(`/api/records/${id}`);
    },
    async stats(projectId: string): Promise<unknown> {
      return client.get(`/api/stats/${projectId}`);
    },
    async metadataOverview(): Promise<unknown> {
      return client.get('/api/metadata/overview');
    },
    async userInfo(): Promise<unknown> {
      return client.get('/api/metadata/user-info');
    },
    async listModels(): Promise<unknown> {
      return client.get('/api/models');
    },
  };
}

export type PingcraftApi = ReturnType<typeof createPingcraftApi>;

/** run 编排的进度回调 */
export interface RunProgressLogger {
  (message: string): void;
}

/**
 * `pingcraft run` 编排：analyze → (matchProject) → checkDuplicates → importStream。
 *
 * @param params.file 已分析的需求项（跳过 analyze），否则 analyze 后取 items
 * @returns 导入结果聚合
 */
export interface RunOrchestratorParams {
  api: PingcraftApi;
  items?: unknown[]; // 已有需求项（跳过 analyze）
  formData?: FormData; // 用于 analyze 的文件表单
  projectId?: string; // 指定项目（跳过 matchProject）
  autoImport?: boolean; // 是否自动导入（默认 false，仅 dry-run 到 check-duplicates）
  force?: boolean; // 覆盖重复项
  log?: RunProgressLogger;
}

export async function runOrchestrator(params: RunOrchestratorParams): Promise<{ projectId?: string; duplicates?: unknown; result?: Record<string, unknown>; skipped: boolean }> {
  const log = params.log ?? (() => undefined);
  let items = params.items;

  // 1. analyze（若未提供 items）
  if (!items) {
    if (!params.formData) throw new Error('run 编排需要 items 或 formData');
    log('解析需求文档…');
    const analyzed = await params.api.analyze(params.formData);
    items = analyzed.items ?? [];
  }
  if (!items.length) {
    log('未解析到需求项，结束。');
    return { skipped: true };
  }
  log(`解析到 ${items.length} 条需求项。`);

  // 2. matchProject（若未指定 projectId）
  let projectId = params.projectId;
  if (!projectId) {
    log('匹配项目…');
    const matched = (await params.api.matchProject({ requirements: items })) as { projectId?: string; project_id?: string };
    projectId = matched.projectId ?? matched.project_id;
    if (!projectId) throw new Error('未匹配到项目，请用 --project 指定');
  }

  // 3. checkDuplicates
  log('查重…');
  const dupResult = await params.api.checkDuplicates({ projectId, items: items as never[] });

  // 4. import（autoImport）
  if (!params.autoImport) {
    log('（未指定 --auto-import）查重完成，未导入。');
    return { projectId, duplicates: dupResult, skipped: false };
  }
  log('开始流式导入…');
  const result = await params.api.importStream(
    { items: items as never[], projectId, autoCreateProject: true },
    {
      onProgress: (d) => log(`进度：${JSON.stringify(d)}`),
      onProjectCreated: (d) => log(`已创建项目：${d.name}`),
      onError: (d) => log(`错误：${d.message}`),
    },
  );
  log(`完成：${JSON.stringify(result)}`);
  return { projectId, duplicates: dupResult, result, skipped: false };
}
