FROM node:18-alpine

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy frontend files
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Copy backend source
COPY backend ./backend

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start backend
CMD ["node", "backend/src/index.js"]
