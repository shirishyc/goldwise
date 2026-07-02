# ---- Build Frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ---- Build & Run Server ----
FROM node:20-alpine
WORKDIR /app/server

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY server/package*.json ./
RUN npm ci

COPY server/ ./

# Copy built frontend
COPY --from=frontend-build /app/client/dist /app/client/dist

# Expose port
EXPOSE 4567

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4567/api/health || exit 1

# Run
CMD ["node", "src/index.js"]
