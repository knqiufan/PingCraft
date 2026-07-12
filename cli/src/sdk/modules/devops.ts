/**
 * DevOps 数据集成模块（L2 sdk）—— 代码(scm) / 构建(build) / 交付(delivery)。
 *
 * 路径：`/scm/<resource>`、`/build/builds`、`/delivery/<resource>`（按 PingCode REST 约定推断）。
 */
import type { PingCodeClient } from '../client.js';
import { createCrud } from './_crud.js';

export interface ScmHost { id?: string; name?: string; [k: string]: unknown }
export interface ScmRepository { id?: string; name?: string; [k: string]: unknown }
export interface ScmBranch { id?: string; name?: string; [k: string]: unknown }
export interface ScmCommit { id?: string; [k: string]: unknown }
export interface ScmPullRequest { id?: string; title?: string; [k: string]: unknown }
export interface ScmReview { id?: string; [k: string]: unknown }
export interface BuildRecord { id?: string; [k: string]: unknown }
export interface DeliveryEnvironment { id?: string; name?: string; [k: string]: unknown }
export interface DeliveryDeployment { id?: string; [k: string]: unknown }

export function createScmModule(client: PingCodeClient) {
  return {
    hosts: createCrud<ScmHost>(client, '/scm/hosts'),
    hostUsers: createCrud<unknown>(client, '/scm/host_users'),
    repositories: createCrud<ScmRepository>(client, '/scm/repositories'),
    branches: createCrud<ScmBranch>(client, '/scm/branches'),
    commits: createCrud<ScmCommit>(client, '/scm/commits'),
    commitRefs: createCrud<unknown>(client, '/scm/commit_refs'),
    pullRequests: createCrud<ScmPullRequest>(client, '/scm/pull_requests'),
    reviews: createCrud<ScmReview>(client, '/scm/reviews'),
  };
}

export function createBuildModule(client: PingCodeClient) {
  return { builds: createCrud<BuildRecord>(client, '/build/builds') };
}

export function createDeliveryModule(client: PingCodeClient) {
  return {
    environments: createCrud<DeliveryEnvironment>(client, '/delivery/environments'),
    deployments: createCrud<DeliveryDeployment>(client, '/delivery/deployments'),
  };
}

export type ScmModule = ReturnType<typeof createScmModule>;
export type BuildModule = ReturnType<typeof createBuildModule>;
export type DeliveryModule = ReturnType<typeof createDeliveryModule>;
