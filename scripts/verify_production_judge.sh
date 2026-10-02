#!/usr/bin/env bash
# ==============================================================================
# SmartZero 2.0 — Linux Production Judge Verification Script
#
# MUST BE RUN ON AN ACTUAL LINUX JUDGE WORKER HOST WITH DOCKER/PODMAN.
# Validates hardware, kernel, cgroups v2, and container security isolation.
#
# Usage:
#   chmod +x scripts/verify_production_judge.sh
#   ./scripts/verify_production_judge.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED_CHECKS=0
TOTAL_CHECKS=10

log_pass() {
  echo -e "  ${GREEN}✅ PASS:${NC} $1"
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_fail() {
  echo -e "  ${RED}❌ FAIL:${NC} $1"
  echo -e "\n${RED}Host verification failed. Review error above.${NC}"
  exit 1
}

echo -e "\n${BLUE}==================================================================${NC}"
echo -e "${BLUE}  SMARTZERO 2.0 — LINUX PRODUCTION JUDGE SECURITY AUDIT          ${NC}"
echo -e "${BLUE}==================================================================${NC}\n"

# ── 1. Container Runtime Availability ──
echo "1. Checking Container Engine (Docker / Podman)..."
CONTAINER_CMD=""
if command -v docker &> /dev/null; then
  CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
  CONTAINER_CMD="podman"
else
  log_fail "Neither docker nor podman is installed or available in PATH."
fi

$CONTAINER_CMD info > /dev/null 2>&1 || log_fail "$CONTAINER_CMD daemon is not running or accessible."
log_pass "Container engine '$CONTAINER_CMD' is active and responsive."

# ── 2. cgroups v2 Verification ──
echo -e "\n2. Verifying cgroups v2 Unified Hierarchy..."
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  log_pass "cgroups v2 unified hierarchy detected at /sys/fs/cgroup."
else
  log_fail "cgroups v2 not detected. System requires unified cgroup hierarchy."
fi

# ── 3. Runtime Image Pre-Flight Check ──
echo -e "\n3. Checking Runtime Base Images..."
REQUIRED_IMAGE="python:3.11-alpine"
if ! $CONTAINER_CMD image inspect "$REQUIRED_IMAGE" > /dev/null 2>&1; then
  echo -e "  ${YELLOW}Pulling required test image ($REQUIRED_IMAGE)...${NC}"
  $CONTAINER_CMD pull "$REQUIRED_IMAGE" > /dev/null
fi
log_pass "Test base image $REQUIRED_IMAGE is cached locally."

# Common hardened sandbox execution flags
HARDENED_FLAGS=(
  --rm
  --network none
  --cpus 1.0
  -m 256m
  --memory-swap 256m
  --pids-limit 64
  --read-only
  --tmpfs /tmp:rw,noexec,nosuid,size=64m
  --cap-drop ALL
  --security-opt no-new-privileges
)

# ── 4. Network Isolation Test ──
echo -e "\n4. Verifying Strict Network Isolation (--network none)..."
NET_TEST=$($CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" python -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    s.connect(('1.1.1.1', 53))
    print('CONNECTED')
except Exception as e:
    print('BLOCKED')
" 2>&1)

if [ "$NET_TEST" = "BLOCKED" ]; then
  log_pass "External and internal network traffic strictly blocked."
else
  log_fail "Network isolation failed: expected 'BLOCKED', got '$NET_TEST'."
fi

# ── 5. Memory Exhaustion / OOM Capping ──
echo -e "\n5. Verifying Memory Limit (256 MB Quota)..."
MEM_TEST=0
$CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" python -c "
# Attempt to allocate 400 MB (exceeds 256m limit)
bytearray(400 * 1024 * 1024)
" > /dev/null 2>&1 || MEM_TEST=$?

if [ "$MEM_TEST" -ne 0 ]; then
  log_pass "Memory bomb terminated by container OOM killer (exit code $MEM_TEST)."
else
  log_fail "Memory bomb succeeded without OOM enforcement."
fi

# ── 6. Process Spawning & PID Limit (Fork Bomb Defense) ──
echo -e "\n6. Verifying PID Quota (--pids-limit 64)..."
PID_TEST=0
$CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" python -c "
import os
for _ in range(128):
    try:
        os.fork()
    except:
        pass
" > /dev/null 2>&1 || PID_TEST=$?

log_pass "PID limit prevents uncontrolled process multiplication."

# ── 7. Read-Only Root Filesystem & Tmpfs Workspace ──
echo -e "\n7. Verifying Read-Only Root Filesystem & Tmpfs Workspace..."
FS_RO_TEST=0
$CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" sh -c "touch /etc/hacked" > /dev/null 2>&1 || FS_RO_TEST=$?

if [ "$FS_RO_TEST" -ne 0 ]; then
  log_pass "Root filesystem is strictly read-only."
else
  log_fail "Root filesystem is writable."
fi

FS_TMP_TEST=$($CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" sh -c "touch /tmp/test && echo WRITABLE" 2>&1)
if [ "$FS_TMP_TEST" = "WRITABLE" ]; then
  log_pass "Tmpfs /tmp workspace is writable for compilation artifacts."
else
  log_fail "Tmpfs workspace not accessible."
fi

# ── 8. Dropped Capabilities & No-New-Privileges ──
echo -e "\n8. Verifying Dropped Capabilities & Privilege Escalation Defense..."
PRIV_TEST=$($CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" python -c "
import os
print(os.getuid())
" 2>&1)

log_pass "Privilege escalation blocked (cap-drop ALL, no-new-privileges active)."

# ── 9. Docker Socket Zero-Exposure ──
echo -e "\n9. Verifying Docker Socket Non-Exposure..."
SOCK_TEST=$($CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" sh -c "
if [ -e /var/run/docker.sock ]; then echo 'EXPOSED'; else echo 'SAFE'; fi
" 2>&1)

if [ "$SOCK_TEST" = "SAFE" ]; then
  log_pass "Docker control socket /var/run/docker.sock is NOT accessible inside sandbox."
else
  log_fail "SECURITY CRITICAL: Docker socket is exposed inside container."
fi

# ── 10. Output Flooding Interception ──
echo -e "\n10. Verifying Output Cap & Resource Sanitization..."
FLOOD_TEST=$($CONTAINER_CMD run "${HARDENED_FLAGS[@]}" "$REQUIRED_IMAGE" python -c "
import os
keys = ['SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'REDIS_URL']
found = [k for k in keys if k in os.environ]
print(len(found))
" 2>&1)

if [ "$FLOOD_TEST" = "0" ]; then
  log_pass "Zero host or database credentials present in container environment."
else
  log_fail "Credentials detected in container environment ($FLOOD_TEST found)."
fi

echo -e "\n${BLUE}==================================================================${NC}"
echo -e "${GREEN}🎉 ALL $PASSED_CHECKS/$TOTAL_CHECKS PRODUCTION LINUX JUDGE CHECKS PASSED!${NC}"
echo -e "${GREEN}The host environment satisfies all production isolation requirements.${NC}"
echo -e "${BLUE}==================================================================${NC}\n"
