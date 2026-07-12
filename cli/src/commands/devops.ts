/**
 * DevOps 命令（L3）—— scm / build / delivery。
 *
 * 用 registerResource 注册标准 CRUD；scm 下多个资源族统一挂到 scm 命令。
 */
import type { Command } from 'commander';
import { buildClient, getConnectionOptions } from './shared.js';
import { registerResource } from './_resource.js';

export function registerDevopsCommands(program: Command): void {
  const bundle = () => buildClient(getConnectionOptions(program));

  // ---- scm ----
  const scm = program.command('scm').description('源代码管理（DevOps）');
  registerResource(scm, 'host', '代码托管平台', () => bundle().scm.hosts as never, { writable: false });
  registerResource(scm, 'host-user', '托管平台用户', () => bundle().scm.hostUsers as never, { writable: false });
  registerResource(scm, 'repository', '代码仓库', () => bundle().scm.repositories as never, { createFields: [['--name <name>', '仓库名']] });
  registerResource(scm, 'branch', '代码分支', () => bundle().scm.branches as never, { writable: false });
  registerResource(scm, 'commit', '提交', () => bundle().scm.commits as never, { writable: false });
  registerResource(scm, 'commit-ref', '提交引用', () => bundle().scm.commitRefs as never, { writable: false });
  registerResource(scm, 'pull-request', '拉取请求', () => bundle().scm.pullRequests as never, { createFields: [['--title <title>', 'PR 标题']] });
  registerResource(scm, 'review', '代码评审', () => bundle().scm.reviews as never, { writable: false });

  // ---- build ----
  const build = program.command('build').description('构建管理（DevOps）');
  registerResource(build, 'record', '构建记录', () => bundle().build.builds as never, {});

  // ---- delivery ----
  const delivery = program.command('delivery').description('交付管理（DevOps）');
  registerResource(delivery, 'environment', '交付环境', () => bundle().delivery.environments as never, { createFields: [['--name <name>', '环境名称']] });
  registerResource(delivery, 'deployment', '部署', () => bundle().delivery.deployments as never, {});
}
