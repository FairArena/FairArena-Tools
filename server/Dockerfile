# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev-dependencies
RUN npm prune --omit=dev

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Non-root user for security
RUN addgroup -S fairarena && adduser -S fairarena -G fairarena

WORKDIR /app

# Copy compiled output and production node_modules
COPY --from=builder --chown=fairarena:fairarena /app/dist ./dist
COPY --from=builder --chown=fairarena:fairarena /app/node_modules ./node_modules
COPY --from=builder --chown=fairarena:fairarena /app/package.json ./

# The server needs the Docker socket for spawning containers — mount it at runtime.
# We intentionally do NOT include Docker CLI here; the host socket is bind-mounted.

USER fairarena

ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
