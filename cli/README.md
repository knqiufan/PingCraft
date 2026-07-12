# @pingcraft/cli

> Agent-first CLI for PingCode + PingCraft。

PingCraft CLI 是面向 [PingCode](https://pingcode.com) 项目管理平台与 PingCraft 需求分析后端的命令行工具，同时可作为 **MCP Server** 接入 AI Agent，也可作为 **库** 在 Node.js 项目中直接调用 SDK。

> ✅ **Phase 0–1 已完成**（tag `v0.1.0` / `v0.2.0`）：鉴权、项目、工作项核心 CRUD 与元数据查询可用。完整计划见仓库根 `docs/cli/`。

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
