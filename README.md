# PingCode Agent — 需求智能分析与导入

基于 AI 的需求文档自动分析与导入 [PingCode](https://pingcode.com/) 的智能助手。支持上传 Word / Markdown / TXT 需求文档，由大模型提取结构化工作项，并与已同步的 PingCode 项目进行智能匹配与查重，一键导入工作项。

**仓库**: [https://github.com/knqiufan/pingcode-agent](https://github.com/knqiufan/pingcode-agent)

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
| **AI** | LangChain、OpenAI 兼容 API、Anthropic（可选） |

后端按 `NODE_ENV` 加载 `backend/.env` 与 `backend/.env.{development|production|test}`；前端通过 Vite 的 `import.meta.env` 读取 `frontend/.env*`。

---

## 前置条件

- **Node.js** 18+
- **pnpm**
- **Docker**（用于运行 SeekDB）
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
4. **需求分析**：在「数据同步」页上传需求文档（Word / Markdown / TXT），等待分析结果。
5. **选择项目与查重**：在目标项目下拉框选择项目，系统会标记每条需求为 New 或 Similar（并展示相似工作项）。
6. **导入**：确认列表无误后点击「Import to PingCode」批量创建工作项。

更多操作说明见 [USER_MANUAL.md](./USER_MANUAL.md)。

---

## 使用 Docker 启动

项目使用 **pnpm** 管理依赖，Dockerfile 内通过 corepack 启用 pnpm 并完成后端依赖安装与前端构建。构建出的镜像**仅运行后端服务**，前端需单独构建并部署（或由 Nginx 等与后端同域提供静态资源）。

### 方式一：仅用 Docker 运行 SeekDB（推荐开发时使用）

后端与前端在本地运行，仅数据库用 Docker 启动：

1. **启动 SeekDB**

```bash
docker-compose up -d
```

2. 在 `backend/.env.development` 中设置 `SEEKDB_HOST=127.0.0.1`、`SEEKDB_PORT=2881`，然后按上文「安装与配置」在本地执行 `pnpm dev` 启动后端与前端。

### 方式二：用 Docker 运行后端 + SeekDB

适合生产或希望后端也容器化时使用。

1. **启动 SeekDB**

在项目根目录执行：

```bash
docker-compose up -d
```

2. **准备环境变量**

在 `backend/.env.production` 中配置好所有生产环境变量，尤其：

- **SEEKDB_HOST**：应用在 Docker 中运行时，若 SeekDB 在宿主机或同一台机的 docker-compose 中：
  - **Windows / macOS**：填 `host.docker.internal`
  - **Linux**：运行容器时加 `--add-host=host.docker.internal:host-gateway`，或改为宿主机实际 IP
- 其余必填项：`JWT_SECRET`、`CORS_ORIGIN`、`FRONTEND_URL`、`PINGCODE_REDIRECT_URI`、`PINGCODE_HOST` 等；LLM 相关由用户在「模型配置」中配置，可不在此写死。

3. **构建镜像**

在项目根目录执行：

```bash
docker build -t pingcode-agent .
```

4. **运行后端容器**

```bash
docker run -d \
  --name pingcode-agent \
  -p 3000:3000 \
  --env-file backend/.env.production \
  pingcode-agent
```

若在 Linux 且 SeekDB 在宿主机，需让容器能解析 `host.docker.internal`：

```bash
docker run -d \
  --name pingcode-agent \
  -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  --env-file backend/.env.production \
  pingcode-agent
```

5. **前端**

镜像内只跑后端 API（端口 3000）。前端需单独构建并部署：

- 在本地执行 `cd frontend && pnpm build`，将 `frontend/dist` 部署到 Nginx、对象存储或任意静态托管；
- 将前端访问的接口地址配置为后端地址（如 `https://your-api-domain.com`），并确保后端 CORS 中允许该前端域名。

### Docker 相关文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 使用 pnpm 安装后端/前端依赖并构建前端，最终仅启动后端 `node backend/src/index.js` |
| `docker-compose.yml` | 仅定义 SeekDB 服务（端口 2881/2886、数据卷 `./seekdb_data`），应用需另行 `docker run` 或自行在 compose 中增加 app 服务 |
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
