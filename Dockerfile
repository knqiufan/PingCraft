FROM node:22-alpine

WORKDIR /app

# 启用 pnpm（固定版本，避免 @latest 引入破坏性策略变更）
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# 先复制后端代码（.dockerignore 已排除 node_modules），安装全部依赖（含 typescript/tsx 以便编译）
COPY backend/ ./backend/
RUN cd backend && pnpm install
# 编译 TypeScript -> dist/（生产运行 dist/index.js）
RUN cd backend && pnpm run build

# 再复制前端代码，安装依赖并构建（同源部署时 API 使用相对路径）
COPY frontend/ ./frontend/
ENV VITE_API_BASE_URL=
RUN cd frontend && pnpm install && pnpm run build

# 将前端构建产物放到后端可托管目录，实现单容器前后端一体
RUN mkdir -p backend/public && cp -r frontend/dist/* backend/public/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 容器健康检查（P2-4.15）：每 30s 探测 /health，连续失败标记不健康
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# 从项目根 /app 启动后端（运行 tsc 编译产物 dist/index.js，后端通过 __dirname 解析 backend/.env 路径）
CMD ["node", "backend/dist/index.js"]
