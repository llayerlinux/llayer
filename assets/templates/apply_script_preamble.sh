#!/usr/bin/env bash
set +e
cd "{{SCRIPT_DIR}}"

__LL_FLAG_FILE="{{FLAG_FILE}}"
__LL_SUDO_DIR="{{SUDO_DIR}}"
__LL_SUDO_REQ="{{SUDO_DIR}}/req.fifo"
__LL_SUDO_RESP="{{SUDO_DIR}}/resp.fifo"
__LL_SUDO_READY="{{SUDO_DIR}}/ready.flag"
__LL_SUDO_PIDFILE="{{SUDO_DIR}}/pkexec.pid"

llWriteFlag() { echo "SCRIPT_COMPLETED" > "$__LL_FLAG_FILE"; }
__ll_write_flag() { llWriteFlag; }

llSudoCleanup() {
  if [ -f "$__LL_SUDO_READY" ] && [ -f "$__LL_SUDO_PIDFILE" ]; then
    local pid
    pid="$(cat "$__LL_SUDO_PIDFILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      printf '%s\n' "__LL_EXIT__" > "$__LL_SUDO_REQ" 2>/dev/null || true
      IFS= read -r -t 1 _ < "$__LL_SUDO_RESP" 2>/dev/null || true
    fi
  fi
  rm -rf "$__LL_SUDO_DIR" 2>/dev/null || true
  llWriteFlag
}
trap llSudoCleanup EXIT
