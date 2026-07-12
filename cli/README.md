# @pingcraft/cli

> Agent-first CLI for PingCode + PingCraft。

PingCraft CLI 是面向 [PingCode](https://pingcode.com) 项目管理平台与 PingCraft 需求分析后端的命令行工具，同时可作为 **MCP Server** 接入 AI Agent，也可作为 **库** 在 Node.js 项目中直接调用 SDK。

> ✅ **Phase 0–4 已完成**（tag `v0.1.0`–`v0.5.0`）：鉴权、项目/工作项、Scrum/发布/看板/瀑布、全局资源、Wiki、MCP Server、PingCraft 业务、产品管理（产品/客户/工单/需求）、测试管理（库/用例/计划/执行）可用。共享 SDK 抽包待专用 PR。完整计划见仓库根 `docs/cli/`。

## 快速开始

```bash
# 仓库根一次安装
pnpm install

# 开发期直跑源码（pnpm v10 下请用 exec tsx 传参）
pnpm -F cli exec tsx src/main.ts --version
# 或构建后运行产物
pnpm -F cli build && node cli/dist/main.js <cmd>
```

## 鉴权

CLI 需要一套 PingCode OAuth 凭证（在 PingCode 开放平台注册应用获取 `client_id` / `client_secret`）。三种提供方式，优先级**低 → 高**：配置文件 → 环境变量 → 命令行参数。

```bash
# 方式 A：企业令牌（client_credentials）——最简单
export PINGCODE_CLIENT_ID=...
export PINGCODE_CLIENT_SECRET=...
pingcode auth token --grant client          # 写入 ~/.pingcode/config.json

# 方式 B：OAuth 授权码登录（启动本地回调服务器）
pingcode auth login --client-id ... --client-secret ...

# 查看当前状态 / 用户
pingcode auth status --json
pingcode auth whoami --json
```

也可用 `~/.pingcode/config.json` 管理多个 profile：

```json
{
  "default_profile": "prod",
  "profiles": {
    "prod": { "host": "https://open.pingcode.com", "client_id": "...", "client_secret": "...", "token": { "access_token": "...", "refresh_token": "...", "expires_at": "2026-08-01T00:00:00.000Z" } }
  }
}
```

切换 profile：`pingcode --profile prod project list`。

## 核心命令

```bash
# 项目
pingcode project list --json
pingcode project list --search 关键字 --fields id,name --quiet
pingcode project get <id>
pingcode project create --name 新项目 --type scrum --identifier NEW --dry-run
pingcode project members <id>

# 工作项
pingcode work-item list --project <pid> --all --json
pingcode work-item list --project <pid> --type <tid> --state <sid>
pingcode work-item create --project <pid> --type <tid> --title 标题 --priority <pri> --dry-run
pingcode work-item get <id> | pingcode work-item update <id> --title 新标题

# 元数据（创建工作项前查 type/state/property/priority 的 id）
pingcode work-item-type list --project <pid>
pingcode work-item-state list --project <pid> --type <tid>
pingcode work-item-property list --project <pid> --type <tid>
pingcode work-item-priority list --project <pid>
```

## MCP Server（Agent 集成，Phase 3）

`pingcode mcp serve` 以 stdio 启动 MCP Server，供 AI Agent（如 Claude Code）直连 PingCode。

```jsonc
// .mcp.json —— Claude Code / Agent 配置示例
{
  "mcpServers": {
    "pingcode": {
      "command": "pingcode",
      "args": ["mcp", "serve", "--core-only"]
    }
  }
}
```

- 默认注册 ~14 个核心 tool（`work-item__list/get/create`、`project__list`、`sprint__list`、`myself__get` 等）。
- `--include sprint,wiki` 启用可选 tool（写操作）；`--core-only` 仅核心。
- 危险操作（create/update/delete）描述前缀 `⚠️ destructive`。
- 自省：`pingcode mcp tools --json` 输出 tool 清单与 inputSchema。

## Wiki 知识库（Phase 3）

```bash
pingcode wiki space list | wiki space create --name 新空间
pingcode wiki page list --space <sid> | wiki page create --space <sid> --title 标题
pingcode wiki page body get <id>            # 正文输出到 stdout
pingcode wiki page body update <id> --content ...
pingcode wiki page versions <id> | wiki page restore <id> <versionId>
```

## PingCraft 业务（Phase 3）

直连本地 PingCraft 后端（`PINGCRAFT_API_URL`，默认 http://localhost:3000），用本地账号 JWT（`pingcraft auth login`）。

```bash
pingcode pingcraft auth login --username admin --password '...'
pingcode pingcraft analyze --file requirements.docx --json
pingcode pingcraft run requirements.docx --project <pid> --auto-import --json   # 一键：解析→匹配→查重→导入
```

`run` 编排进度走 stderr，结果包络走 stdout。`import-stream` 的 SSE 事件（start/progress/project_created/complete/error）由内置 `consumeSSE` 解析。

## 项目管理补全（Phase 2）

```bash
# 工作项子资源
pingcode work-item comment list <id> | work-item comment add <id> --content ...
pingcode work-item attachment upload <id> --file ./spec.md
pingcode work-item watcher add <id> --user-id <uid>
pingcode work-item link create <id> --target <id> --type <linkTypeId>
pingcode work-item history <id>          # 流转/活动记录
pingcode work-item transition <id> --state <stateId>
pingcode work-item-link-type list

# 配置中心（scheme，只读）
pingcode scheme state --project <pid>
pingcode scheme transition --project <pid> --type <tid>

# Scrum 迭代
pingcode sprint list --project <pid> --json
pingcode sprint create --project <pid> --name 迭代A --start-at 2026-08-01 --end-at 2026-08-15
pingcode sprint create-batch --project <pid> --file sprints.json   # 批量（并发+进度）
pingcode sprint work-items <id>

# 发布 / 看板 / 瀑布
pingcode release list --project <pid> | release create ... | release stages <id>
pingcode kanban list --project <pid> | kanban column list <id> | kanban swimlane create <id> --name ...
pingcode waterfall work-item-types --project <pid>

# 全局个人/组织
pingcode myself --json
pingcode user list | user create --name ... --email ...
pingcode department list | team list | team member add <id> --user-id <uid>
pingcode role list | position list | organization info

# 全局通用资源（以 principal 锚定）
pingcode comment list --principal-type work_item --principal-id <id>
pingcode worklog create --workload 4 --description ...
pingcode activity list --principal-type work_item --principal-id <id>
pingcode log login | log audit
```

批量命令统一输入：`--file sprints.json`（JSON 数组）或 `--stdin`；`--concurrency` 控制并发（默认 3，受 200/min 限流约束）。

## 管道与输出

- **进度走 stderr，数据走 stdout**，保证 `| jq` 纯净。
- `--json`：机器可读包络 `{success, data, pagination?}`；非 TTY 管道默认 JSON。
- `--fields a,b`：列裁剪；`--quiet`：仅输出 id 列；`--all`：列表自动分页拉全量。

```bash
pingcode work-item list --project <pid> --all --json --fields id,title | jq '.data[].title'
```

错误以 JSON 输出到 stderr：

```jsonc
{ "error": { "code": "E_NOT_FOUND", "message": "...", "statusCode": 404 } }
```

### 退出码

| 码 | 含义 |
|----|------|
| 0  | 成功 |
| 1  | 通用错误 |
| 2  | 参数错误 |
| 3  | 未认证 |
| 4  | 无权限 |
| 5  | 资源不存在 |
| 10 | 限流（429） |
| 20 | 网络错误 |
| 30 | PingCode API 错误 |

## 库模式

```ts
import { createClient, createProjectsModule } from '@pingcraft/cli/sdk';

const client = createClient({ host: 'https://open.pingcode.com', credentials: { getToken: async () => process.env.PINGCODE_ACCESS_TOKEN } });
const projects = createProjectsModule(client);
const { values } = await projects.list({ pageSize: 30 });
```

SDK 内置：鉴权头注入、401 自动刷新重放、429 按 `x-pc-retry-after` 退避、5xx/网络错误指数退避（三者互斥）。

## 架构（三层）

```
cli/src/
├── commands/   L3 命令（Commander）—— 参数解析 + 输出编排
├── sdk/        L2 PingCode API SDK —— 纯函数/类，可独立发布为库
├── core/       L1 核心运行时 —— config / auth / output / errors / pagination
└── mcp/        MCP Server（Phase 3）
```

层级纪律：`commands/` 只调用 `sdk/` 与 `core/`；`sdk/` 不引用 `core/` 的输出/错误格式；`core/` 不依赖 `sdk/`。

## 更多文档

- 总体规划与阶段拆解：`../docs/cli/00-总体开发规划.md`
- 各阶段实施方案：`../docs/cli/01-阶段0` ~ `06-阶段5`
- 上游蓝图：`../docs/CLI开发计划.md`
