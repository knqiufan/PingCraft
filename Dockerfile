FROM node:18-alpine

WORKDIR /app

# 启用 pnpm（与项目包管理一致）
RUN corepack enable && corepack prepare pnpm@latest --activate

# 先复制后端代码（.dockerignore 已排除 node_modules），再安装依赖
COPY backend/ ./backend/
RUN cd backend && pnpm install --prod

# 再复制前端代码，安装依赖并构建（同源部署时 API 使用相对路径）
COPY frontend/ ./frontend/
ENV VITE_API_BASE_URL=
RUN cd frontend && pnpm install && pnpm run build

# 将前端构建产物放到后端可托管目录，实现单容器前后端一体
RUN mkdir -p backend/public && cp -r frontend/dist/* backend/public/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 从项目根 /app 启动后端（后端通过 __dirname 解析 backend/.env 路径）
CMD ["node", "backend/src/index.js"]
