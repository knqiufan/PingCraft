/**
 * PingCode API SDK 聚合导出（L2）—— 库模式公共 API。
 *
 * 用法（库模式）：
 * ```ts
 * import { createClient, createProjectsModule } from '@pingcraft/cli/sdk';
 * const client = createClient({ host, credentials });
 * const projects = createProjectsModule(client);
 * await projects.list();
 * ```
 *
 * 层级纪律：sdk/ 不引用 core/ 的输出/错误格式；pagination 为纯工具例外（见 workItems 模块）。
 */
// biome-ignore lint/correctness/noUnusedImports: 类型重导出
import type { PingCodeClient as _PC } from './client.js';

export { createClient } from './client.js';
export type { CreateClientOptions, ClientCredentials, RequestOptions, PingCodeClient } from './client.js';

export { withRetry, computeBackoffDelay } from './retry.js';
export type { RetryOptions } from './retry.js';

export { chunk, runWithConcurrency } from './concurrency.js';

export { extractList } from './types.js';
export type { PingCodeList, PageParams, Id } from './types.js';

export { createAuthModule, buildAuthUrl, DEFAULT_SCOPE } from './modules/auth.js';
export type { TokenResponse, MyselfInfo, AuthModule, BuildAuthUrlParams, TokenByCodeParams, ClientCredentialsParams, RefreshParams } from './modules/auth.js';

export { createProjectsModule } from './modules/projects.js';
export type { Project, ProjectMember, ProjectsModule, CreateProjectBody, UpdateProjectBody, ProjectListParams } from './modules/projects.js';

export { createWorkItemsModule } from './modules/workItems.js';
export type { WorkItem, WorkItemsModule, WorkItemListParams, CreateWorkItemBody, UpdateWorkItemBody, BatchCreateItem, BatchCreateResult, BatchProgressItem, BatchCreateOptions } from './modules/workItems.js';

export { createWorkItemMetaModule } from './modules/workItemMeta.js';
export type { WorkItemType, WorkItemState, WorkItemProperty, WorkItemPriority, WorkItemMetaModule } from './modules/workItemMeta.js';

/** SDK 版本（Phase 3 抽包后单独维护） */
export const SDK_VERSION = '0.2.0';
