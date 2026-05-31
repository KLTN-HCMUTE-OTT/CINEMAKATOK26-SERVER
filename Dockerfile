# ==========================================
# Stage 1: Get Linux Shaka Packager binary
# ==========================================
FROM google/shaka-packager:latest AS shaka-holder

# ==========================================
# Stage 2: Base Image & pnpm Setup
# ==========================================
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

WORKDIR /app

# ==========================================
# Stage 3: Install all dependencies (dev + prod)
# ==========================================
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ==========================================
# Stage 4: Build all microservices
# ==========================================
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build all NestJS projects defined in nest-cli.json
# We run a build loop to compile each microservice
RUN npx nest build api-gateway && \
    npx nest build auth-service && \
    npx nest build user-service && \
    npx nest build user-activity-service && \
    npx nest build content-service && \
    npx nest build audit-log-service && \
    npx nest build analytics-service && \
    npx nest build streaming-service && \
    npx nest build payment-service && \
    npx nest build order-service && \
    npx nest build notification-service && \
    npx nest build watch-party-service

# ==========================================
# Stage 5: Install only production dependencies
# ==========================================
FROM base AS prod-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# ==========================================
# Stage 6: Production Runtime
# ==========================================
# Use Debian-based image (glibc) — required by onnxruntime-node.
# Alpine (musl libc) is NOT compatible with the onnxruntime native binary.
FROM node:22-slim AS runtime

# Install system dependencies:
#   - ffmpeg: required by video-worker for frame extraction
#   - ca-certificates: needed for HTTPS calls
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Shaka Packager Linux binary from Stage 1
COPY --from=shaka-holder /usr/bin/packager /usr/local/bin/packager
RUN chmod +x /usr/local/bin/packager

# Configure environment variables
ENV NODE_ENV=production
ENV SHAKA_PACKAGER_PATH=/usr/local/bin/packager
ENV SERVICE_NAME=api-gateway

WORKDIR /app

# Create a non-root group and user for security hardening
# (Debian syntax uses groupadd/useradd instead of Alpine's addgroup/adduser)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nestjs && \
    chown -R nestjs:nodejs /app

# Copy production node_modules, built dist, ONNX models, config, and package.json
COPY --from=prod-dependencies --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/models ./models
COPY --from=builder --chown=nestjs:nodejs /app/config ./config
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Use the non-root user
USER nestjs

# The default startup command. Can run any microservice by passing -e SERVICE_NAME at runtime
CMD ["sh", "-c", "node dist/apps/${SERVICE_NAME}/src/main.js"]
