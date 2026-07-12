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

export { createWorkItemSubResourcesModule } from './modules/workItemSubResources.js';
export type { Comment, Attachment, Watcher, WorkItemLink, Activity, Tag, WorkItemSubResourcesModule } from './modules/workItemSubResources.js';

export { createWorkItemSchemeModule } from './modules/workItemScheme.js';
export type { SchemeItem, LinkType, WorkItemSchemeModule } from './modules/workItemScheme.js';

export { createSprintsModule } from './modules/sprints.js';
export type { Sprint, CreateSprintBody, UpdateSprintBody, SprintsModule } from './modules/sprints.js';

export { createReleasesModule } from './modules/releases.js';
export type { Release, CreateReleaseBody, UpdateReleaseBody, ReleasesModule } from './modules/releases.js';

export { createKanbansModule } from './modules/kanbans.js';
export type { Kanban, KanbanColumn, KanbanSwimlane, KanbansModule } from './modules/kanbans.js';

export { createWaterfallModule } from './modules/waterfall.js';
export type { WaterfallModule } from './modules/waterfall.js';

export { createDirectoryModule } from './modules/directory.js';
export type { User, Department, Team, Role, Position, Organization, DirectoryModule } from './modules/directory.js';

export { createCommonResourcesModule } from './modules/commonResources.js';
export type { CommonResourcesModule, Principal } from './modules/commonResources.js';

export { createLogsModule } from './modules/logs.js';
export type { LogEntry, LogsModule } from './modules/logs.js';

export { createWikiModule } from './modules/wiki.js';
export type { WikiSpace, WikiPage, WikiPageVersion, WikiModule } from './modules/wiki.js';

export { createPingcraftClient, consumeSSE } from './pingcraft/client.js';
export type { PingcraftClient, PingcraftClientOptions, SseEvent } from './pingcraft/client.js';
export { createPingcraftApi, runOrchestrator } from './pingcraft/index.js';
export type { PingcraftApi, LoginResult, AnalyzeResult, ImportStreamHandlers, RunOrchestratorParams } from './pingcraft/index.js';

export { createProductsModule } from './modules/products.js';
export type { Product, ProductsModule } from './modules/products.js';
export { createCustomersModule } from './modules/customers.js';
export type { Customer, ExternalUser, CustomersModule } from './modules/customers.js';
export { createTicketsModule } from './modules/tickets.js';
export type { Ticket, TicketsModule } from './modules/tickets.js';
export { createRequirementsModule } from './modules/requirements.js';
export type { Requirement, RequirementsModule } from './modules/requirements.js';
export { createTestLibraryModule, createTestCasesModule, createTestPlansModule, createTestExecutionsModule, createTestConfigModule } from './modules/testhub.js';
export type { TestLibrary, TestCase, TestPlan, TestExecution, TestLibraryModule, TestCasesModule, TestPlansModule, TestExecutionsModule, TestConfigModule } from './modules/testhub.js';
export { createCrud, createListOnly } from './modules/_crud.js';

/** SDK 版本（Phase 3 抽包后单独维护） */
export const SDK_VERSION = '0.5.0';
