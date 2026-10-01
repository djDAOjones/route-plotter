#!/usr/bin/env bash
#
# The safety contract of scripts/restart.sh, checked without starting anything.
#
# Sourcing the script defines its helpers and runs nothing. The process tools
# those helpers ask (ps, lsof, pgrep) are replaced below by shell functions, so
# no server starts, no port is bound, and the only processes signalled are
# children this test started itself.
#
# Every check is an `if` that says what broke (TST-14). A bare check cannot
# fail this file: under `set -e` a command negated with `!` never stops a
# script, and the bash 3.2 that macOS ships does not stop for a failing
# `[[ … ]]` either. So `! is_dev_wrapper_command "npm run developer"` passed
# whatever it returned, and on a Mac so did every `[[ … ]]` check.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESTART_SCRIPT="${REPO_DIR}/scripts/restart.sh"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/route-plotter-restart.XXXXXX")"
CHILD_PID=""
HOLDER_PID=""
CLIENT_PID=""

cleanup_test() {
  local pid
  for pid in ${CHILD_PID} ${HOLDER_PID} ${CLIENT_PID}; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
  done
  rm -rf "${TEST_DIR}"
}
trap cleanup_test EXIT

fail() {
  echo "restartSafety: $*" >&2
  exit 1
}

# Sourcing is deliberately supported so these process-ownership helpers can be
# tested without starting the real dev server.
source "${RESTART_SCRIPT}"
ROOT_DIR="${TEST_DIR}"
PID_FILE="${TEST_DIR}/.route-plotter-dev.pid"

# A fresh copy of the helpers, pointed at this test's directory, for a check
# that needs back a real helper the stubs below replace. Call it in a
# subshell, so the copy and its stubs end there.
fresh_helpers() {
  source "${RESTART_SCRIPT}"
  ROOT_DIR="${TEST_DIR}"
  PID_FILE="${TEST_DIR}/.route-plotter-dev.pid"
}

# The script reads its options before it touches anything (main's first
# step). One it does not know, such as a hoped-for --dry-run, stops it with
# exit 1 instead of going ahead, and only --hard-reset asks for docs/ to be
# deleted.
OPTION_STATUS=0
( parse_args --dry-run ) > "${TEST_DIR}/options.log" 2>&1 || OPTION_STATUS=$?
if [[ "${OPTION_STATUS}" -ne 1 ]]; then
  fail "an unknown option did not stop the script (status ${OPTION_STATUS}, not 1)"
fi
if ! grep -qF "Unknown option: --dry-run" "${TEST_DIR}/options.log"; then
  fail "an unknown option is not named: $(cat "${TEST_DIR}/options.log")"
fi
if [[ "$(parse_args; printf '%s' "${HARD_RESET}")" != false ]]; then
  fail "the script asks for docs/ to be deleted without --hard-reset"
fi
if [[ "$(parse_args --hard-reset; printf '%s' "${HARD_RESET}")" != true ]]; then
  fail "--hard-reset does not ask for docs/ to be deleted"
fi

# The dev wrapper is `npm run dev`, in either form ps shows it. A script whose
# name only begins with "dev" is not it.
if ! is_dev_wrapper_command "npm run dev"; then
  fail "'npm run dev' is not recognised as the dev wrapper"
fi
if ! is_dev_wrapper_command "node /opt/npm/lib/npm-cli.js run dev"; then
  fail "'node /opt/npm/lib/npm-cli.js run dev' is not recognised as the dev wrapper"
fi
if is_dev_wrapper_command "npm run developer"; then
  fail "'npm run developer' was taken for the dev wrapper"
fi
if is_dev_wrapper_command "node /opt/npm/lib/npm-cli.js run developer"; then
  fail "'node /opt/npm/lib/npm-cli.js run developer' was taken for the dev wrapper"
fi

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
if [[ -z "${START_TOKEN}" || -z "${COMMAND}" ]]; then
  fail "the fixture identity is empty, so the checks below would prove nothing"
fi

printf '%s\t%s\t%s\n' "${CHILD_PID}" "${START_TOKEN}" "${COMMAND} --different" > "${PID_FILE}"
if [[ -n "$(dev_pids)" ]]; then
  fail "a record whose command differs from the live process's was taken as ours"
fi
if ! kill -0 "${CHILD_PID}" 2>/dev/null; then
  fail "the fixture process has gone, so the refusal above proves nothing"
fi

printf '%s\t%s\t%s\n' "${CHILD_PID}" "wrong-start-token" "${COMMAND}" > "${PID_FILE}"
if [[ -n "$(dev_pids)" ]]; then
  fail "a record whose start token differs from the live process's (a reused PID) was taken as ours"
fi
if ! kill -0 "${CHILD_PID}" 2>/dev/null; then
  fail "the fixture process has gone, so the refusal above proves nothing"
fi

# Legacy PID-only files are not sufficient proof of ownership.
printf '%s\n' "${CHILD_PID}" > "${PID_FILE}"
if [[ -n "$(dev_pids)" ]]; then
  fail "a legacy record holding only a PID was taken as ours"
fi

printf '%s\t%s\t%s\n' "${CHILD_PID}" "${START_TOKEN}" "${COMMAND}" > "${PID_FILE}"
if [[ "$(dev_pids)" != "${CHILD_PID}" ]]; then
  fail "an exact record of a live process in this checkout was not taken as ours"
fi

# The record must also name a process in this checkout that runs the dev
# wrapper: one in another directory, or one running anything else, is not ours
# however exactly the rest of the record matches. The wrapper check needs the
# real is_dev_wrapper_command, so it runs on a fresh copy, beside a control
# that the same record naming the wrapper is ours there.
(
  pid_cwd() { printf '%s\n' '/elsewhere/another-checkout'; }
  if [[ -n "$(dev_pids)" ]]; then
    fail "a record naming a process in another directory was taken as ours"
  fi
)
(
  fresh_helpers
  pid_cwd() { printf '%s\n' "${ROOT_DIR}"; }
  pgrep() { return 1; }
  pid_start_token() { printf '%s\n' 'fixture-start-token'; }

  pid_command() { printf '%s\n' 'python3 -m http.server 3000'; }
  printf '%s\t%s\t%s\n' "${CHILD_PID}" 'fixture-start-token' 'python3 -m http.server 3000' > "${PID_FILE}"
  if [[ -n "$(dev_pids)" ]]; then
    fail "a record naming a process that is not the dev wrapper was taken as ours"
  fi

  pid_command() { printf '%s\n' 'npm run dev'; }
  printf '%s\t%s\t%s\n' "${CHILD_PID}" 'fixture-start-token' 'npm run dev' > "${PID_FILE}"
  if [[ "$(dev_pids)" != "${CHILD_PID}" ]]; then
    fail "an exact record naming the dev wrapper was not taken as ours"
  fi
)

kill "${CHILD_PID}"
wait "${CHILD_PID}" 2>/dev/null || true
CHILD_PID=""

# A failing foreground child must retain its status, but only after its exact
# ownership record has been removed.
( sleep 0.1; exit 7 ) &
DEV_PID=$!
if ! write_pid_record "${DEV_PID}"; then
  fail "write_pid_record refused the fixture dev process"
fi
WAIT_STATUS=0
wait_for_dev || WAIT_STATUS=$?
if [[ "${WAIT_STATUS}" -ne 7 ]]; then
  fail "wait_for_dev returned ${WAIT_STATUS}, not the dev process's own status 7"
fi
if [[ -e "${PID_FILE}" ]]; then
  fail "wait_for_dev left this run's ownership record behind"
fi

# An exiting wrapper removes the record only while it is still its own. A
# newer restart's record stays, whether its process is new or reuses the old
# PID, so that restart can still find and stop its server.
(
  DEV_PID=4242
  DEV_START_TOKEN='older-start'
  DEV_COMMAND='npm run dev'

  printf '%s\t%s\t%s\n' 4343 'newer-start' 'npm run dev' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ ! -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper removed a newer restart's ownership record"
  fi

  printf '%s\t%s\t%s\n' 4242 'newer-start' 'npm run dev' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ ! -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper removed the record of a newer process that reused its PID"
  fi

  printf '%s\t%s\t%s\n' 4242 'older-start' 'npm run dev' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper kept its own ownership record"
  fi
)

# Stopping signals only what is provably this checkout's. A record that names
# a live process without matching it leaves that process running, and is
# cleared as stale; an exact record's process is stopped, and its record goes.
sleep 30 &
CHILD_PID=$!
printf '%s\t%s\t%s\n' "${CHILD_PID}" "wrong-start-token" "${COMMAND}" > "${PID_FILE}"
stop_dev > "${TEST_DIR}/stop.log" 2>&1
if ! kill -0 "${CHILD_PID}" 2>/dev/null; then
  fail "stop_dev killed a process whose record did not match it"
fi
if [[ -e "${PID_FILE}" ]]; then
  fail "stop_dev kept a stale ownership record"
fi

printf '%s\t%s\t%s\n' "${CHILD_PID}" "${START_TOKEN}" "${COMMAND}" > "${PID_FILE}"
stop_dev > "${TEST_DIR}/stop.log" 2>&1
if kill -0 "${CHILD_PID}" 2>/dev/null; then
  fail "stop_dev left running the process this checkout's record names"
fi
if [[ -e "${PID_FILE}" ]]; then
  fail "stop_dev kept the record of the process it stopped"
fi
wait "${CHILD_PID}" 2>/dev/null || true
CHILD_PID=""

# An ownership record is written only for the dev wrapper itself, and only
# whole. A process that never shows the wrapper's command (within the 2 s the
# script gives npm to start), one that has already exited, and a command a
# one-line record cannot hold leave no record and no temporary file behind.
sleep 30 &
CHILD_PID=$!
true &
GONE_PID=$!
wait "${GONE_PID}" 2>/dev/null || true
(
  fresh_helpers
  pid_start_token() { printf '%s\n' 'fixture-start-token'; }

  expect_no_record() {
    local status=0 left
    write_pid_record "$1" || status=$?
    if [[ "${status}" -ne 1 ]]; then
      fail "write_pid_record accepted $2 (status ${status})"
    fi
    for left in "${PID_FILE}" "${PID_FILE}".tmp.*; do
      if [[ -e "${left}" ]]; then
        fail "write_pid_record left ${left##*/} behind for $2"
      fi
    done
  }

  pid_command() { printf '%s\n' 'sleep 30'; }
  expect_no_record "${CHILD_PID}" "a live process that never became the dev wrapper"
  pid_command() { printf '%s\n' 'npm run dev'; }
  expect_no_record "${GONE_PID}" "a process that had already exited"
  pid_command() { printf 'npm run dev\t--port 3001\n'; }
  expect_no_record "${CHILD_PID}" "a command holding a tab, which would split the record"
  pid_command() { printf 'npm run dev\n--port 3001\n'; }
  expect_no_record "${CHILD_PID}" "a command holding a newline, which would split the record"

  pid_command() { printf '%s\n' 'npm run dev'; }
  if ! write_pid_record "${CHILD_PID}"; then
    fail "write_pid_record refused the dev wrapper itself"
  fi
  if [[ "$(cat "${PID_FILE}")" != "${CHILD_PID}"$'\t''fixture-start-token'$'\t''npm run dev' ]]; then
    fail "write_pid_record wrote '$(cat "${PID_FILE}")', not the wrapper's PID, start token and command"
  fi
  rm -f "${PID_FILE}"
)
kill "${CHILD_PID}"
wait "${CHILD_PID}" 2>/dev/null || true
CHILD_PID=""

# A `node build.js --watch` is ours only when it runs in this checkout:
# sibling projects in the workspace run the same command. An owned watcher
# brings its whole tree, down to the esbuild service that binds the port,
# since stopping only the listener orphaned the watcher (decision-log
# 2026-06-17). These PIDs are fixtures: dev_pids only lists them.
(
  rm -f "${PID_FILE}"
  pgrep() {
    case "$1 ${2:-}" in
      '-f '*) printf '%s\n' 4101 4201 ;;
      '-P 4101') printf '%s\n' 4102 ;;
      '-P 4102') printf '%s\n' 4103 ;;
      '-P 4201') printf '%s\n' 4202 ;;
      *) return 1 ;;
    esac
  }
  pid_cwd() {
    case "$1" in
      4201|4202) printf '%s\n' '/elsewhere/a-sibling-project' ;;
      *) printf '%s\n' "${ROOT_DIR}" ;;
    esac
  }
  OWNED="$(dev_pids | tr '\n' ' ')"
  if [[ "${OWNED}" != '4101 4102 4103 ' ]]; then
    fail "dev_pids claimed '${OWNED}', not this checkout's watcher tree '4101 4102 4103 '"
  fi
)

# The headline refusal (`assert_port_available`). With its own server stopped,
# the script will not boot while anything else listens on the port: it names
# the port and the holder, kills nothing, and exits 1. Only a LISTEN socket
# holds a port: a browser's stale CLOSED client socket to the server just
# stopped once made the boot refuse until the browser was closed (found
# 2026-08-27).
#
# From here on lsof answers from a socket table, one "pid port state" line per
# socket, as `lsof -ti :PORT -sTCP:STATE` would, and ps describes whatever it
# is asked about as the same fixture server. Both PIDs in the table are this
# test's own children, so a refusal that wrongly killed would kill only those.
sleep 30 &
HOLDER_PID=$!
sleep 30 &
CLIENT_PID=$!
SOCKETS=""

lsof() {
  local port="" state="" arg
  for arg in "$@"; do
    case "${arg}" in
      :*) port="${arg#:}" ;;
      -sTCP:*) state="${arg#-sTCP:}" ;;
    esac
  done
  printf '%s\n' "${SOCKETS}" | awk -v port="${port}" -v state="${state}" \
    'NF == 3 && (port == "" || $2 == port) && (state == "" || $3 == state) { print $1 }'
}

ps() {
  local previous="" pids="" arg pid
  for arg in "$@"; do
    if [[ "${previous}" == "-p" ]]; then pids="${arg}"; fi
    previous="${arg}"
  done
  for pid in ${pids//,/ }; do
    printf '%s %s\n' "${pid}" "python3 -m http.server ${PORT}"
  done
}

# Ask assert_port_available about the sockets given, in a subshell so that a
# refusal's `exit 1` ends only the subshell. Leaves the status in PORT_STATUS
# and what it printed in port.err.
check_port() {
  SOCKETS="$1"
  PORT_STATUS=0
  ( assert_port_available ) > "${TEST_DIR}/port.out" 2> "${TEST_DIR}/port.err" || PORT_STATUS=$?
}

OTHER_PORT=$(( PORT + 1 ))

check_port "${HOLDER_PID} ${OTHER_PORT} LISTEN"
if [[ "${PORT_STATUS}" -ne 0 ]]; then
  fail "a free port ${PORT} was refused (status ${PORT_STATUS}): $(cat "${TEST_DIR}/port.err")"
fi
if [[ -s "${TEST_DIR}/port.err" ]]; then
  fail "a free port ${PORT} printed a complaint: $(cat "${TEST_DIR}/port.err")"
fi

check_port "${HOLDER_PID} ${OTHER_PORT} LISTEN
${CLIENT_PID} ${PORT} CLOSED
${CLIENT_PID} ${PORT} ESTABLISHED"
if [[ "${PORT_STATUS}" -ne 0 ]]; then
  fail "client sockets that do not listen on port ${PORT} were taken as its holder: $(cat "${TEST_DIR}/port.err")"
fi
if [[ -s "${TEST_DIR}/port.err" ]]; then
  fail "client sockets on port ${PORT} printed a complaint: $(cat "${TEST_DIR}/port.err")"
fi

check_port "${CLIENT_PID} ${PORT} CLOSED
${HOLDER_PID} ${PORT} LISTEN"
if [[ "${PORT_STATUS}" -ne 1 ]]; then
  fail "a foreign listener on port ${PORT} did not stop the boot (status ${PORT_STATUS}, not 1)"
fi
if ! grep -qF "Port ${PORT} is held" "${TEST_DIR}/port.err"; then
  fail "the refusal does not name port ${PORT}: $(cat "${TEST_DIR}/port.err")"
fi
if ! grep -qxF "${HOLDER_PID} python3 -m http.server ${PORT}" "${TEST_DIR}/port.err"; then
  fail "the refusal does not name the holder: $(cat "${TEST_DIR}/port.err")"
fi
if grep -q "^${CLIENT_PID} " "${TEST_DIR}/port.err"; then
  fail "the refusal names a client socket's process as a holder: $(cat "${TEST_DIR}/port.err")"
fi
if ! grep -qF "nothing was killed" "${TEST_DIR}/port.err"; then
  fail "the refusal does not say that nothing was killed: $(cat "${TEST_DIR}/port.err")"
fi
if ! kill -0 "${HOLDER_PID}" 2>/dev/null || ! kill -0 "${CLIENT_PID}" 2>/dev/null; then
  fail "the refusal killed a process it does not own"
fi

echo "restartSafety: identity, ownership record, stop and port refusal checks passed"
