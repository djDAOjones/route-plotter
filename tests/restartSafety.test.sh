#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESTART_SCRIPT="${REPO_DIR}/scripts/restart.sh"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/route-plotter-restart.XXXXXX")"
CHILD_PID=""

cleanup_test() {
  if [[ -n "${CHILD_PID}" ]] && kill -0 "${CHILD_PID}" 2>/dev/null; then
    kill "${CHILD_PID}" 2>/dev/null || true
    wait "${CHILD_PID}" 2>/dev/null || true
  fi
  rm -rf "${TEST_DIR}"
}
trap cleanup_test EXIT

# Sourcing is deliberately supported so these process-ownership helpers can be
# tested without starting the real dev server.
source "${RESTART_SCRIPT}"
ROOT_DIR="${TEST_DIR}"
PID_FILE="${TEST_DIR}/.route-plotter-dev.pid"

is_dev_wrapper_command "npm run dev"
is_dev_wrapper_command "node /opt/npm/lib/npm-cli.js run dev"
! is_dev_wrapper_command "npm run developer"

# Isolate the identity checks from machine-specific process-inspection output
# and unrelated node watchers. A real child still proves kill-0/lifecycle
# behavior; stable fixture identity keeps the contract runnable in CI and
# restricted sandboxes where `ps -o lstart` is unavailable.
pid_cwd() { printf '%s\n' "${ROOT_DIR}"; }
pgrep() { return 1; }
is_dev_wrapper_command() { return 0; }
pid_start_token() { printf '%s\n' 'fixture-start-token'; }
pid_command() { printf '%s\n' 'fixture-command'; }

sleep 30 &
CHILD_PID=$!
START_TOKEN="$(pid_start_token "${CHILD_PID}")"
COMMAND="$(pid_command "${CHILD_PID}")"
[[ -n "${START_TOKEN}" && -n "${COMMAND}" ]]

printf '%s\t%s\t%s\n' "${CHILD_PID}" "${START_TOKEN}" "${COMMAND} --different" > "${PID_FILE}"
[[ -z "$(dev_pids)" ]]
kill -0 "${CHILD_PID}"

printf '%s\t%s\t%s\n' "${CHILD_PID}" "wrong-start-token" "${COMMAND}" > "${PID_FILE}"
[[ -z "$(dev_pids)" ]]
kill -0 "${CHILD_PID}"

# Legacy PID-only files are not sufficient proof of ownership.
printf '%s\n' "${CHILD_PID}" > "${PID_FILE}"
[[ -z "$(dev_pids)" ]]

printf '%s\t%s\t%s\n' "${CHILD_PID}" "${START_TOKEN}" "${COMMAND}" > "${PID_FILE}"
[[ "$(dev_pids)" == "${CHILD_PID}" ]]

kill "${CHILD_PID}"
wait "${CHILD_PID}" 2>/dev/null || true
CHILD_PID=""

# A failing foreground child must retain its status, but only after its exact
# ownership record has been removed.
( sleep 0.1; exit 7 ) &
DEV_PID=$!
write_pid_record "${DEV_PID}"
WAIT_STATUS=0
wait_for_dev || WAIT_STATUS=$?
[[ "${WAIT_STATUS}" -eq 7 ]]
[[ ! -e "${PID_FILE}" ]]

echo "restartSafety: identity and wait cleanup checks passed"
