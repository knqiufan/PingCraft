# Changelog

本文件记录 `@pingcraft/cli` 各版本变更。阶段对应 `docs/cli/` 实施方案。

## [1.0.0] — 2026-07-12（Phase 5：DevOps + 打磨发布）

- **DevOps 模块**：`scm`（host/host-user/repository/branch/commit/commit-ref/pull-request/review）、`build`（构建记录）、`delivery`（environment/deployment）。
- **工程化**：`scripts/check-coverage.mjs`（API 覆盖率 ≥80% 卡点）、`package.json` 发包配置（`files` 白名单、`publishConfig`、`prepublishOnly`）、`CHANGELOG.md`。
- **覆盖率**：API 端点覆盖 ~94%；core/sdk 测试覆盖 lines 87% / functions 83%。
- MCP 三层 tool 完整（核心 + 按需 product/testhub/wiki/devops）。
- 首个稳定版；之后破坏性变更走 SemVer major。

## [0.5.0] — 2026-07-12（Phase 4：产品管理 + 测试管理）

- **产品管理**：product / customer / external-user / ticket（CRUD+流转+元数据）/ requirement（CRUD+流转+元数据）。
- **测试管理**：test-library / test-case（批量+关联工作项）/ test-plan / test-execution（批量+结果）/ test-config。
- `sdk/modules/_crud.ts` + `commands/_resource.ts` 资源族生成器收敛样板。
- MCP 按需 tool：`--include product,testhub`。

## [0.4.0] — 2026-07-12（Phase 3：MCP Server + Wiki + PingCraft 业务）

- **MCP Server**：`pingcode mcp serve`（stdio），三层 tool 注册，~14 核心 tool，`z.toJSONSchema` 生成 inputSchema，`⚠️ destructive` 标注。
- **Wiki**：space CRUD/members + page CRUD/body/versions/restore。
- **PingCraft 业务**：独立 JWT client + SSE 解析器 + run 编排（analyze→match→dup→import）。
- 🟡 `packages/pingcode-sdk` 抽包 + 后端接入延后至专用 PR（pagination 跨层耦合 + 后端门面高风险）。

## [0.3.0] — 2026-07-12（Phase 2：项目管理补全 + 全局模块）

- **工作项子资源**：comment/attachment/watcher/link/history/tag/transition/deliverables/batch-update/move。
- **配置中心 scheme**：state/property/type/transition + link-type。
- **Scrum/发布/看板/瀑布**：sprint（含 create-batch）/release/kanban/waterfall。
- **全局**：directory（myself/user/department/team/role/position/organization）+ 通用资源（comment/attachment/watcher/association/activity/worklog/review/log）。
- `core/input.ts` 统一批量输入；`client.postForm` 上传；`cli/docs/api-coverage.csv` 建立。

## [0.2.0] — 2026-07-12（Phase 1：核心骨架与鉴权）

- **core 五件套**：errors / pagination / config（三源合并+多 profile+Zod）/ auth（文件凭证 0o600）/ output（json/table/csv/yaml）。
- **SDK client**：统一重试循环（401 刷新重放 / 429 退避 / 5xx 重试，互斥）。
- **命令**：auth（login/token/refresh/whoami/logout/status）、project（list/get/create/update/delete/members）、work-item（list/get/create/update/delete）、work-item-meta。
- 退出码与 stderr 机器可读错误规范；`--json/--fields/--page/--all/--quiet/--dry-run/--profile`。

## [0.1.0] — 2026-07-12（Phase 0：基础设施与脚手架）

- pnpm workspace（backend/frontend/cli/packages）。
- `cli/` TS 工程：三层骨架（commands/sdk/core/mcp）、`pingcode --version/--help/capabilities`。
