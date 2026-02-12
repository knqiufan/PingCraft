# PingCode Agent — 需求智能分析与导入

基于 **AI Agent** 的需求文档自动分析与导入 [PingCode](https://pingcode.com/) 的智能助手。支持上传 Word / Markdown / TXT 需求文档，由大模型提取结构化工作项，并与已同步的 PingCode 项目进行**智能匹配与查重**，一键导入工作项。

**仓库**: [https://github.com/knqiufan/pingcode-agent](https://github.com/knqiufan/pingcode-agent)

---

## Agent 亮点

| 亮点 | 说明 |
|------|------|
| **LLM 驱动需求解析** | 使用 LangChain 编排大模型，从非结构化文档中识别多项目、拆分为独立工作项，并输出标题、描述、优先级、预估工时、计划时间、负责人及**解决方案建议**，与 PingCode 工作项类型（story/task/bug/feature/epic）无缝对接。 |
| **多模型与按用户配置** | 支持 **OpenAI 兼容 API**（含自建/第三方）与 **Anthropic**；在「模型配置」中可添加多套模型、设置默认模型，**按用户维度**选择用于需求分析的 LLM，便于团队混合使用不同厂商与模型。 |
| **智能项目与工作项匹配** | 分析结果中的项目名称会与已同步的 PingCode 项目做**相似度匹配**（基于 SeekDB 向量能力），推荐最佳目标项目；每条需求与现有工作项做**语义相似度**计算，标记为 **New** 或 **Similar**（并展示相似项与匹配度），减少重复导入。 |
| **专业 Prompt 与可控输出** | 需求分析采用结构化 Prompt：明确角色（项目管理助手 + 技术顾问）、分析要点（项目识别、需求拆分、优先级与工时评估、负责人识别、解决方案建议）、输出格式与示例，保证 JSON 输出稳定、字段完整，便于后续导入与追溯。 |

---

## 功能概览

| 功能 | 说明 |
|------|------|
| **本地登录** | 用户名/密码注册与登录，JWT 鉴权 |
| **PingCode 连接** | 在设置中配置 Client ID/Secret，OAuth 授权后同步项目与工作项 |
| **数据同步** | 拉取 PingCode 项目、工作项及元数据，建立本地向量索引（SeekDB） |
| **需求分析** | 上传需求文档，由 LLM 解析为结构化工作项（标题、描述、优先级、预估工时等） |
| **智能匹配** | 按内容推荐目标项目，并检测与现有工作项的相似度（New / Similar） |
| **批量导入** | 确认后批量在 PingCode 中创建工作项 |
| **元数据管理** | 工作项类型、状态、属性、优先级等与项目绑定管理 |
| **模型配置** | 多模型管理（OpenAI 兼容 / Anthropic），支持按用户设置默认模型 |
| **导入记录** | 记录每次分析/导入的文件与数量 |
| **用户与角色** | 管理员可管理用户、角色与权限 |

---

## 技术架构

| 层级 | 技术选型 |
|------|----------|
| **前端** | Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router |
| **后端** | Node.js 18+、Express 5、ES Module |
| **数据库** | [SeekDB](https://www.seekdb.com/)（关系型 + 向量，MySQL/OceanBase 兼容） |
| **AI / Agent** | LangChain 编排、OpenAI 兼容 API、Anthropic（可选）；需求解析与多模型管理由 Agent 服务统一调度 |

后端按 `NODE_ENV` 加载 `backend/.env` 与 `backend/.env.{development|production|test}`；前端通过 Vite 的 `import.meta.env` 读取 `frontend/.env*`。

---

## 前置条件

- **Node.js** 18+
- **pnpm**
- **Docker** 与 **Docker Compose**（一键启动 SeekDB + 应用，或开发时仅跑 SeekDB）
- **PingCode** 应用 Client ID / Client Secret（需在 PingCode 开放平台创建应用并配置回调地址）
- **LLM**：OpenAI 或兼容接口的 API Key；或 Anthropic API Key（需安装 `@langchain/anthropic`）

---

## 安装与配置

### 1. 克隆项目

```bash
git clone https://github.com/knqiufan/pingcode-agent.git
cd pingcode-agent
```

### 2. 安装依赖

后端与前端均使用 pnpm：

```bash
cd backend && pnpm install
cd ../frontend && pnpm install
```

### 3. 环境变量

在 **backend** 目录下创建或修改环境配置文件。

- 基础：`backend/.env`
- 按环境覆盖：`backend/.env.development`、`backend/.env.production`、`backend/.env.test`  
  加载顺序：先 `.env`，再 `.env.{NODE_ENV}`（后者覆盖前者）。

**开发环境示例**（`backend/.env.development`）：

```env
NODE_ENV=development
PORT=3000

# CORS（前端开发地址）
CORS_ORIGIN=http://localhost:5173

# 前端地址（OAuth 回调重定向用）
FRONTEND_URL=http://localhost:5173

# PingCode OAuth（host / redirect_uri 全局配置；client_id/secret 可在「设置」中按用户配置）
PINGCODE_REDIRECT_URI=http://localhost:3000/auth/callback
PINGCODE_HOST=https://open.pingcode.com

# JWT 密钥（生产环境务必更换）
JWT_SECRET=your_jwt_secret

# SeekDB（与 docker-compose 中端口一致）
SEEKDB_HOST=127.0.0.1
SEEKDB_PORT=2881
SEEKDB_USER=root
SEEKDB_PASSWORD=
SEEKDB_DATABASE=pingcode_agent
SEEKDB_RETRY_COUNT=5
SEEKDB_RETRY_INTERVAL_MS=2000

# 可选：同步工作项批次大小与间隔（2c2g 建议 20–30）
# SYNC_WORK_ITEM_BATCH_SIZE=25
# SYNC_BATCH_DELAY_MS=500
```

**前端** 开发环境（`frontend/.env.development`）：

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_TITLE=PingCode 需求智能分析（开发）
```

生产环境请对应修改 `frontend/.env.production` 中的 `VITE_API_BASE_URL` 与 `VITE_APP_TITLE`。

### 4. 启动 SeekDB

在项目根目录执行：

```bash
docker-compose up -d
```

默认将 SeekDB 映射到 `2881`（MySQL 兼容）、`2886`，数据卷为 `./seekdb_data`。确保 `backend/.env*` 中的 `SEEKDB_HOST` / `SEEKDB_PORT` 与之一致。

### 5. 启动应用

**开发环境：**

```bash
# 终端 1：后端
cd backend && pnpm dev
```

```bash
# 终端 2：前端
cd frontend && pnpm dev
```

浏览器访问 `http://localhost:5173`。首次使用需先**注册账号**，登录后在「设置」中配置 PingCode 凭证并完成 OAuth 授权，然后可使用「Sync Data」同步项目与工作项、上传需求文档进行分析与导入。

**生产环境：**

- 后端：`cd backend && pnpm start`（依赖 `NODE_ENV=production` 及对应 `.env.production`）
- 前端：`cd frontend && pnpm build`，将 `dist` 部署到任意静态站点或与后端同域提供

---

## 使用流程简述

1. **登录**：使用本地账号登录（未注册则先注册）。
2. **连接 PingCode**：右上角「设置」中填写 PingCode 应用的 Client ID、Client Secret，保存后按提示完成 OAuth 授权。
3. **同步数据**：点击「Sync Data」，拉取项目与工作项并建立向量索引。
4. **需求分析**：在「数据同步」页上传需求文档（Word / Markdown / TXT），由 **Agent** 调用 LLM 分析并返回结构化工作项。
5. **选择项目与查重**：在目标项目下拉框选择项目，系统会基于向量相似度标记每条需求为 New 或 Similar（并展示相似工作项与匹配度）。
6. **导入**：确认列表无误后点击「Import to PingCode」批量创建工作项。

更多操作说明见 [USER_MANUAL.md](./USER_MANUAL.md)。

---

## 使用 Docker 启动

通过 **docker compose** 可一键启动 **SeekDB + 应用（后端 + 前端）**：同一镜像内后端托管前端静态资源，访问单一端口即可使用完整功能。

### 1. 准备环境变量

编辑 `backend/.env.production`，**至少设置 `JWT_SECRET`**（例如 `JWT_SECRET=your_secure_random_string`）。  
`SEEKDB_*`、`CORS_ORIGIN`、`FRONTEND_URL` 会由 docker-compose 自动注入；PingCode、LLM 等可在应用启动后于「设置」「模型配置」中再配。

### 2. 一键启动

在项目根目录执行：

```bash
docker compose up -d
```

首次运行会构建应用镜像（pnpm 安装依赖 + 前端构建），并启动 **seekdb** 与 **app** 两个服务。

### 3. 访问应用

浏览器打开 **http://localhost:3000**，即可使用前端界面与后端 API（同源部署，无需再配接口地址）。  
首次使用请先注册账号，再在「设置」中配置 PingCode 凭证并完成 OAuth 授权。

### 4. 常用命令

```bash
# 查看应用日志
docker compose logs -f app

# 停止所有服务
docker compose down

# 仅启动 SeekDB（本地用 pnpm 跑前后端时）
docker compose up -d seekdb
```

### 开发时仅用 Docker 跑 SeekDB

若只在本地用 pnpm 跑前后端，可只启动数据库：

```bash
docker compose up -d seekdb
```

在 `backend/.env.development` 中设置 `SEEKDB_HOST=127.0.0.1`、`SEEKDB_PORT=2881`，然后分别执行 `cd backend && pnpm dev` 与 `cd frontend && pnpm dev`。

### Docker 相关文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 使用 pnpm 安装后端/前端依赖并构建前端，将 `frontend/dist` 复制到 `backend/public`，生产环境由后端同源托管前端 |
| `docker-compose.yml` | 定义 **seekdb** 与 **app** 两服务；app 依赖 seekdb，通过 `environment` 注入 `SEEKDB_HOST=seekdb` 等，实现一键启动 |
| `.dockerignore` | 排除 `node_modules`、`.env*`、`frontend/dist` 等，避免无关文件进入镜像 |

---

## 项目结构

```
pingcode/
├── backend/                 # 后端 (Express)
│   ├── src/
│   │   ├── config/          # 配置（按 NODE_ENV 加载 .env）
│   │   ├── middleware/      # 鉴权、日志、错误处理、权限
│   │   ├── models/          # Sequelize 模型（User、Role、SyncedProject、SyncedWorkItem、ModelConfig 等）
│   │   ├── prompts/         # 需求分析 Prompt 模板
│   │   ├── routes/          # 路由：auth、localAuth、config、sync、analyze、workItems、metadata、models、records、roles、users
│   │   ├── services/        # 业务：db(SeekDB+Sequelize)、pingcode、agent(LangChain)、parser
│   │   └── utils/
│   ├── .env / .env.development / .env.production / .env.test
│   └── package.json
├── frontend/                # 前端 (Vue 3 + Vite)
│   ├── src/
│   │   ├── api/             # 接口封装
│   │   ├── components/      # 仪表盘、工作项、模型、用户、角色、设置等
│   │   ├── config/          # 前端配置（VITE_*）
│   │   ├── router/
│   │   ├── stores/          # Pinia（user、app）
│   │   └── views/           # Login、Dashboard
│   ├── .env.development / .env.production / .env.test
│   └── package.json
├── docker-compose.yml       # SeekDB 服务
├── Dockerfile               # 后端 + 前端构建，运行 Node
├── USER_MANUAL.md           # 用户操作手册
└── README.md
```

---

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。
