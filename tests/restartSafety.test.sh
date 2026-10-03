#!/usr/bin/env bash
#
# The safety contract of scripts/restart.sh, checked without starting anything.
#
# Sourcing the script defines its helpers and runs nothing. The process tools
# those helpers ask (ps, lsof, pgrep) are replaced below by shell functions, so
# no server starts, no port is bound, and the only processes signalled are
# children this test started itself. Where a check is about what the script
# asks those tools (the watcher search and the port refusal), they answer from
# fixture tables as the real tool would for the arguments given, and refuse an
# option they do not model, so a wrong question never gets a right answer.
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
POLITE_PID=""
STUBBORN_PID=""

cleanup_test() {
  local pid
  for pid in ${CHILD_PID} ${HOLDER_PID} ${CLIENT_PID} ${POLITE_PID}; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
  done
  # This fixture ignores TERM, so only KILL ends it.
  for pid in ${STUBBORN_PID}; do
    kill -9 "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
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

# A record whose process has exited is not ours, however exactly the rest of
# it matches (the fixture identity above still answers for its PID): only a
# live process is checked, and a free PID can be reused.
printf '%s\t%s\t%s\n' "${CHILD_PID}" "${START_TOKEN}" "${COMMAND}" > "${PID_FILE}"
if [[ -n "$(dev_pids)" ]]; then
  fail "an exact record of a process that has exited was taken as ours"
fi
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
# PID, so that restart can still find and stop its server. Its own means all
# three of PID, start token and command: a record that differs in any one of
# them stays, byte for byte as it was written.
(
  DEV_PID=4242
  DEV_START_TOKEN='older-start'
  DEV_COMMAND='npm run dev'

  # Fails unless the record file still holds exactly the line written for
  # PID $1, start token $2 and command $3.
  expect_record_intact() {
    printf '%s\t%s\t%s\n' "$1" "$2" "$3" > "${TEST_DIR}/record.written"
    if ! cmp -s "${TEST_DIR}/record.written" "${PID_FILE}"; then
      fail "an exiting wrapper changed $4 to '$(cat "${PID_FILE}")'"
    fi
  }

  printf '%s\t%s\t%s\n' 4343 'newer-start' 'npm run dev' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ ! -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper removed a newer restart's ownership record"
  fi
  expect_record_intact 4343 'newer-start' 'npm run dev' "a newer restart's ownership record"

  printf '%s\t%s\t%s\n' 4242 'newer-start' 'npm run dev' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ ! -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper removed the record of a newer process that reused its PID"
  fi
  expect_record_intact 4242 'newer-start' 'npm run dev' "the record of a newer process that reused its PID"

  # Only the PID differs: a newer restart begun within the same second.
  printf '%s\t%s\t%s\n' 4343 'older-start' 'npm run dev' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ ! -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper removed a record with another PID"
  fi
  expect_record_intact 4343 'older-start' 'npm run dev' "a record with another PID"

  # Only the command differs.
  printf '%s\t%s\t%s\n' 4242 'older-start' 'npm run dev --silent' > "${PID_FILE}"
  remove_owned_pid_file
  if [[ ! -e "${PID_FILE}" ]]; then
    fail "an exiting wrapper removed a record with another command"
  fi
  expect_record_intact 4242 'older-start' 'npm run dev --silent' "a record with another command"

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

# Stopping asks first: TERM, then, after a grace period, KILL for whatever is
# still running, named in a warning. One fixture notes the TERM and stops, so
# it must not be forced; the other ignores TERM, as a wedged server would, so
# it must be, and its record goes too. Each says when it is ready, so no
# signal reaches it before it has set how it takes one.
await_ready() {
  local tries=100
  while [[ ! -e "$1" ]]; do
    if (( tries == 0 )); then
      fail "$2 never started"
    fi
    sleep 0.05
    tries=$(( tries - 1 ))
  done
}

( trap 'touch "${TEST_DIR}/term.seen"; exit 0' TERM
  touch "${TEST_DIR}/polite.ready"
  while true; do sleep 0.1; done ) &
POLITE_PID=$!
await_ready "${TEST_DIR}/polite.ready" "the fixture that stops on TERM"
printf '%s\t%s\t%s\n' "${POLITE_PID}" "${START_TOKEN}" "${COMMAND}" > "${PID_FILE}"
stop_dev > "${TEST_DIR}/stop.log" 2>&1
if grep -qF "Forcing kill" "${TEST_DIR}/stop.log"; then
  fail "stop_dev force-killed a process that stops on TERM: $(cat "${TEST_DIR}/stop.log")"
fi
if [[ ! -e "${TEST_DIR}/term.seen" ]]; then
  fail "stop_dev did not ask with TERM first: $(cat "${TEST_DIR}/stop.log")"
fi
wait "${POLITE_PID}" 2>/dev/null || true
POLITE_PID=""

( trap '' TERM
  touch "${TEST_DIR}/stubborn.ready"
  exec sleep 30 ) &
STUBBORN_PID=$!
await_ready "${TEST_DIR}/stubborn.ready" "the fixture that ignores TERM"
printf '%s\t%s\t%s\n' "${STUBBORN_PID}" "${START_TOKEN}" "${COMMAND}" > "${PID_FILE}"
stop_dev > "${TEST_DIR}/stop.log" 2>&1
STILL_RUNNING=true
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ! kill -0 "${STUBBORN_PID}" 2>/dev/null; then
    STILL_RUNNING=false
    break
  fi
  sleep 0.1
done
if [[ "${STILL_RUNNING}" == true ]]; then
  fail "stop_dev left running a process that ignored TERM: $(cat "${TEST_DIR}/stop.log")"
fi
if ! grep -qF "Forcing kill of survivors: ${STUBBORN_PID}" "${TEST_DIR}/stop.log"; then
  fail "stop_dev did not name ${STUBBORN_PID} as force-killed: $(cat "${TEST_DIR}/stop.log")"
fi
if [[ -e "${PID_FILE}" ]]; then
  fail "stop_dev kept the record of the process it force-killed"
fi
wait "${STUBBORN_PID}" 2>/dev/null || true
STUBBORN_PID=""

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
#
# pgrep answers from a process table as pgrep does: -f matches its pattern,
# an extended regular expression, against each full command (without -f,
# against the program's name), and -P lists a parent's children. Besides this
# checkout's watcher tree and a sibling project's, the table holds processes
# in this checkout that are not the watcher: a one-off build, the test
# runner's watcher, an editor on build.js and this script itself. A search
# wider than the watcher's command claims them, and stop_dev signals whatever
# dev_pids claims.
PROCESSES=""

# Prints field $2 (2 parent PID, 3 directory, 4 command) of fixture process
# $1. PROCESSES holds one process a line: PID, parent PID, directory and
# command, tab-separated. A PID it does not hold prints nothing, as for a
# process that has gone.
process_field() {
  printf '%s\n' "${PROCESSES}" \
    | awk -F '\t' -v pid="$1" -v field="$2" '$1 == pid { print $field; exit }'
}

(
  rm -f "${PID_FILE}"
  PROCESSES="$(printf '%s\t%s\t%s\t%s\n' \
    4101 4100 "${ROOT_DIR}" 'node build.js --watch --serve' \
    4102 4101 "${ROOT_DIR}" 'esbuild --service=0.28.2 --ping' \
    4103 4102 "${ROOT_DIR}" 'a child of the esbuild service' \
    4201 4200 '/elsewhere/a-sibling-project' 'node build.js --watch --serve' \
    4202 4201 '/elsewhere/a-sibling-project' 'esbuild --service=0.28.2 --ping' \
    4301 4300 "${ROOT_DIR}" 'node build.js --check' \
    4302 4300 "${ROOT_DIR}" 'node node_modules/.bin/vitest --watch' \
    4303 4300 "${ROOT_DIR}" 'vim build.js' \
    4304 4300 "${ROOT_DIR}" 'bash scripts/restart.sh')"
  pgrep() {
    local full=false parents="" pattern="" pid ppid command subject found=1
    while (( $# > 0 )); do
      case "$1" in
        -f) full=true ;;
        -P) parents=",${2-},"; shift ;;
        --) pattern="${2-}"; break ;;
        -*) echo "pgrep (test stub): unsupported option $1" >&2; return 2 ;;
        *) pattern="$1" ;;
      esac
      shift
    done
    while IFS=$'\t' read -r pid ppid _ command; do
      if [[ -n "${parents}" && "${parents}" != *",${ppid},"* ]]; then
        continue
      fi
      subject="${command}"
      if [[ "${full}" != true ]]; then
        subject="${command%% *}"
        subject="${subject##*/}"
      fi
      if [[ -n "${pattern}" ]] && ! [[ "${subject}" =~ ${pattern} ]]; then
        continue
      fi
      echo "${pid}"
      found=0
    done <<< "${PROCESSES}"
    return "${found}"
  }
  pid_cwd() { process_field "$1" 3; }
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
# socket, and ps from the process table, each as the real tool would for the
# arguments given: lsof prints bare PIDs only with -t, and its usual table
# without; ps prints only the fields -o names, and refuses a PID list holding
# anything but PIDs. So a refusal that asks for the wrong thing gets what it
# asked for, as on a Mac. Both PIDs in the tables are this test's own
# children, so a refusal that wrongly killed would kill only those.
sleep 30 &
HOLDER_PID=$!
sleep 30 &
CLIENT_PID=$!
SOCKETS=""
PROCESSES="$(printf '%s\t%s\t%s\t%s\n' \
  "${HOLDER_PID}" 1 '/elsewhere/another-project' "python3 -m http.server ${PORT}" \
  "${CLIENT_PID}" 1 '/' '/Applications/Firefox.app/Contents/MacOS/firefox')"

lsof() {
  local terse=false port="" state="" address_next=false arg flags rows
  local pid socket_port socket_state name
  for arg in "$@"; do
    # The address -i selects, given as the next argument: :3000, TCP:3000.
    if [[ "${address_next}" == true && "${arg}" != -* ]]; then
      address_next=false
      if [[ "${arg}" != *:* ]]; then
        echo "lsof (test stub): unsupported address ${arg}" >&2
        return 1
      fi
      port="${arg##*:}"
      continue
    fi
    address_next=false
    case "${arg}" in
      -sTCP:*) state="${arg#-sTCP:}" ;;
      -*)
        flags="${arg#-}"
        while [[ -n "${flags}" ]]; do
          case "${flags}" in
            t*) terse=true; flags="${flags#t}" ;;
            n*) flags="${flags#n}" ;;
            P*) flags="${flags#P}" ;;
            i) address_next=true; flags="" ;;
            i*:*) port="${flags##*:}"; flags="" ;;
            *) echo "lsof (test stub): unsupported option -${flags}" >&2; return 1 ;;
          esac
        done
        ;;
      *) echo "lsof (test stub): unsupported argument ${arg}" >&2; return 1 ;;
    esac
  done
  rows="$(printf '%s\n' "${SOCKETS}" | awk -v port="${port}" -v state="${state}" \
    'NF == 3 && (port == "" || $2 == port) && (state == "" || $3 == state)')"
  if [[ -z "${rows}" ]]; then
    return 1
  fi
  if [[ "${terse}" == true ]]; then
    printf '%s\n' "${rows}" | awk '!seen[$1]++ { print $1 }'
    return 0
  fi
  echo 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME'
  while read -r pid socket_port socket_state; do
    name="$(process_field "${pid}" 4)"
    name="${name%% *}"
    printf '%s %s tester 4u IPv4 0x0 0t0 TCP *:%s (%s)\n' \
      "${name##*/}" "${pid}" "${socket_port}" "${socket_state}"
  done <<< "${rows}"
}

ps() {
  local pids="" fields="" token field value row header="" show_header=false
  local status=0 found=1
  while (( $# > 0 )); do
    case "$1" in
      -p) pids="${pids},${2-}"; shift ;;
      -p?*) pids="${pids},${1#-p}" ;;
      -o) fields="${fields},${2-}"; shift ;;
      -o?*) fields="${fields},${1#-o}" ;;
      -w|-ww) ;;
      *) echo "ps (test stub): unsupported argument $1" >&2; return 1 ;;
    esac
    shift
  done
  pids="$(printf '%s\n' "${pids}" | tr ', \t' '\n\n\n' | sed '/^$/d')"
  fields="$(printf '%s\n' "${fields}" | tr ', ' '\n\n' | sed '/^$/d')"
  if [[ -z "${pids}" || -z "${fields}" ]]; then
    echo "ps (test stub): only -p with -o is modelled" >&2
    return 1
  fi
  while IFS= read -r token; do
    if [[ ! "${token}" =~ ^[0-9]+$ ]]; then
      echo "ps: Invalid process id: ${token}" >&2
      status=1
    fi
  done <<< "${pids}"
  # A field written name= prints no header; any other asks for a header line.
  while IFS= read -r field; do
    case "${field%%=*}" in
      pid|ppid|command|args) ;;
      *) echo "ps: ${field%%=*}: keyword not found" >&2; status=1 ;;
    esac
    if [[ "${field}" != *=* ]]; then
      show_header=true
    fi
  done <<< "${fields}"
  if [[ "${status}" -ne 0 ]]; then
    return 1
  fi
  if [[ "${show_header}" == true ]]; then
    while IFS= read -r field; do
      if [[ "${field}" == *=* ]]; then
        value="${field#*=}"
      else
        value="$(printf '%s' "${field}" | tr '[:lower:]' '[:upper:]')"
      fi
      header="${header:+${header} }${value}"
    done <<< "${fields}"
    printf '%s\n' "${header}"
  fi
  while IFS= read -r token; do
    if [[ -z "$(process_field "${token}" 1)" ]]; then
      continue
    fi
    row=""
    while IFS= read -r field; do
      case "${field%%=*}" in
        pid) value="${token}" ;;
        ppid) value="$(process_field "${token}" 2)" ;;
        command|args) value="$(process_field "${token}" 4)" ;;
      esac
      row="${row:+${row} }${value}"
    done <<< "${fields}"
    printf '%s\n' "${row}"
    found=0
  done <<< "${pids}"
  return "${found}"
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
