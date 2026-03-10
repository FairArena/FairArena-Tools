# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:22-slim AS runner

# Install Docker CLI and curl (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r fairarena -g 1001 && \
    useradd -r -g fairarena -u 1001 fairarena

# Copy built app
COPY --from=builder --chown=fairarena:fairarena /app/dist ./dist
COPY --from=builder --chown=fairarena:fairarena /app/node_modules ./node_modules
COPY --from=builder --chown=fairarena:fairarena /app/package.json ./

# Switch to non-root user
USER fairarena

ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
