#!/usr/bin/env bash
# ==============================================================================
# SMARTZERO 2.0 â€” ORACLE CLOUD ALWAYS FREE ARM64 DOCKER DEPLOY SCRIPT (â‚¹0 FOREVER)
# Ampere A1 (ARM64), 2 OCPUs, 12 GB RAM, Always-On (No Cold Starts)
# Architecture: Oracle Linux VM -> Docker -> Judge Worker -> Isolated Execution
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "â–¶ SmartZero 2.0 Isolated Judge Worker Setup (Oracle ARM64)"
echo "=========================================================="

# 1. Update system and install Docker CE + Docker Compose
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    gnupg

if ! command -v docker &> /dev/null; then
    echo "Installing Docker CE for ARM64..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
fi

# 2. Prepare Worker Directory
WORKER_DIR="/opt/smartzero-judge-worker"
sudo mkdir -p "$WORKER_DIR"
sudo chown -R "$USER:$USER" "$WORKER_DIR"

# 3. Create Docker Compose Configuration
SECRET="${JUDGE_WORKER_SECRET:-$(openssl rand -hex 24)}"

cat <<EOF > "$WORKER_DIR/docker-compose.yml"
version: '3.8'

services:
  judge-worker:
    build:
      context: .
      dockerfile: deploy/judge-worker/Dockerfile
    container_name: smartzero-judge-worker
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - PORT=8080
      - NODE_ENV=production
      - SMARTZERO_JUDGE_MODE=local
      - SMARTZERO_CONTAINER_WORKER=true
      - SMARTZERO_JUDGE_CONCURRENCY=3
      - JUDGE_WORKER_SECRET=${SECRET}
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8192M
        reservations:
          cpus: '1.0'
          memory: 2048M
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3
EOF

echo "âœ“ Docker Compose configuration created."
echo "Generated JUDGE_WORKER_SECRET: ${SECRET}"
echo "Save this secret for Vercel configuration!"
echo "=========================================================="
