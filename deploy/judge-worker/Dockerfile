# ==============================================================================
# SMARTZERO 2.0 — DEDICATED REMOTE CODING JUDGE WORKER
# Multi-Language Isolated Execution Environment
# Supported Runtimes: Python 3.11+, Node.js 22, TypeScript, C++ (g++ 17), Java (OpenJDK 21)
# ==============================================================================

FROM node:22-bookworm-slim

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

# Install compilers and runtimes for all SmartZero supported languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-minimal \
    g++ \
    gcc \
    make \
    default-jdk-headless \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Verify runtimes
RUN python3 --version && \
    node --version && \
    g++ --version && \
    javac -version

# Create dedicated isolated working directory
WORKDIR /app

# Create unprivileged execution user for sandboxed code execution
RUN groupadd -g 1001 judgebox && \
    useradd -u 1001 -g judgebox -m -s /bin/bash judgebox

# Copy worker application files
COPY package.json package-lock.json* tsconfig.json* ./
COPY lib/ ./lib/
COPY types/ ./types/
COPY deploy/ ./deploy/

# Install production dependencies
RUN npm install --omit=dev --legacy-peer-deps && npm install -g tsx

# Set ownership
RUN chown -R judgebox:judgebox /app /home/judgebox

# Expose HTTP port
EXPOSE 8080

# Environment defaults
ENV PORT=8080 \
    NODE_ENV=production \
    SMARTZERO_JUDGE_MODE=local \
    SMARTZERO_CONTAINER_WORKER=true \
    SMARTZERO_JUDGE_CONCURRENCY=3

# Healthcheck probe for Render / Docker / Kubernetes
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start standalone judge worker
USER judgebox
CMD ["npx", "tsx", "deploy/judge-worker/server.ts"]
