# 需求自动分析与导入 PingCode Agent 工具

## 架构
- **前端**: Vue 3 + TypeScript + Element Plus (Vite)
- **后端**: Node.js + Express
- **数据库**: SeekDB (混合数据库: 向量 + 关系型)
- **AI**: LangChain + 兼容 OpenAI 的 LLM (可配置)

## 前置条件
- Node.js 18+
- pnpm
- PingCode 账号 (Client ID/Secret)
- SeekDB 实例 (通过 Docker 运行)
- OpenAI (或兼容) API Key

## 安装与设置

1. **安装依赖**
   请使用 `pnpm` 安装依赖：
   ```bash
   cd backend && pnpm install
   cd ../frontend && pnpm install
   ```

2. **环境配置**
   创建 `backend/.env` 文件并填入以下内容：
   ```env
   PORT=3000
   
   # PingCode 配置
   PINGCODE_CLIENT_ID=你的Client_ID
   PINGCODE_CLIENT_SECRET=你的Client_Secret
   # 注意: 回调地址必须在 PingCode 后台配置一致
   PINGCODE_REDIRECT_URI=http://localhost:5173/auth/callback
   
   # LLM 配置 (支持 OpenAI 兼容接口)
   OPENAI_API_KEY=你的API_Key
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-3.5-turbo
   
   # SeekDB 配置
   SEEKDB_HOST=127.0.0.1
   SEEKDB_PORT=2881
   SEEKDB_USER=root
   SEEKDB_PASSWORD=
   SEEKDB_DATABASE=pingcode_agent
   ```

3. **启动数据库 (SeekDB)**
   由于 SeekDB 需要作为独立服务运行，请使用 Docker：
   ```bash
   docker-compose up -d
   ```
   (请确保根目录下有 `docker-compose.yml` 文件)

4. **启动应用**
   后端:
   ```bash
   cd backend && pnpm start
   ```
   前端:
   ```bash
   cd frontend && pnpm dev
   ```

## 使用说明
1. 打开浏览器访问 `http://localhost:5173`。
2. 系统会自动跳转至 PingCode 进行 OAuth2 授权。
3. 授权成功后进入仪表盘，点击 "Sync Data" 同步项目数据。
4. 上传需求文档，等待 AI 分析。
5. 确认匹配结果并导入 PingCode。

## 部署
```bash
docker build -t pingcode-agent .
docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file backend/.env pingcode-agent
```
