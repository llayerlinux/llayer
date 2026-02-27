mkdir -p "$__LL_SUDO_DIR/bin"
chmod 700 "$__LL_SUDO_DIR"

cat > "$__LL_SUDO_DIR/root_runner.sh" << 'LLRUNNEREOF'
set -u
REQ="$1"; RESP="$2"; READY="$3"
exec 3<>"$REQ"; exec 4<>"$RESP"
echo "ready" > "$READY"
while IFS= read -r out <&3; do
  [ "$out" = "__LL_EXIT__" ] && { echo "0" >&4; exit 0; }
  IFS= read -r err <&3 || err=""
  IFS= read -r cwd <&3 || cwd="/"
  IFS= read -r cmd <&3 || cmd=""
  cd "$cwd" 2>/dev/null || cd "/"
  if bash -c "$cmd" >"$out" 2>"$err"; then code=0; else code=$?; fi
  echo "$code" >&4
done
LLRUNNEREOF
chmod 700 "$__LL_SUDO_DIR/root_runner.sh"

cat > "$__LL_SUDO_DIR/bin/sudo" << 'LLSUDOEOF'
__LL_SUDO_DIR="${__LL_SUDO_DIR:-/tmp/lastlayer_sudo_fallback}"
__LL_SUDO_REQ="$__LL_SUDO_DIR/req.fifo"
__LL_SUDO_RESP="$__LL_SUDO_DIR/resp.fifo"
__LL_SUDO_READY="$__LL_SUDO_DIR/ready.flag"
__LL_SUDO_PIDFILE="$__LL_SUDO_DIR/pkexec.pid"

real_sudo=""
for p in /usr/bin/sudo /bin/sudo /usr/local/bin/sudo; do
  [ -x "$p" ] && real_sudo="$p" && break
done

[ $# -eq 0 ] && { [ -n "$real_sudo" ] && exec "$real_sudo"; exit 1; }
case "$1" in -*) [ -n "$real_sudo" ] && exec "$real_sudo" "$@"; exit 1 ;; esac
[ "$(id -u)" = "0" ] && { "$@"; exit $?; }

if [ -f "$__LL_SUDO_READY" ] && [ -f "$__LL_SUDO_PIDFILE" ]; then
  pid="$(cat "$__LL_SUDO_PIDFILE" 2>/dev/null)"
  [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null && rm -f "$__LL_SUDO_READY"
fi

if [ ! -f "$__LL_SUDO_READY" ]; then
  echo "[LastLayer] First sudo call - requesting authentication..."
  rm -f "$__LL_SUDO_REQ" "$__LL_SUDO_RESP" 2>/dev/null
  mkfifo "$__LL_SUDO_REQ" "$__LL_SUDO_RESP" 2>/dev/null
  pkexec "$__LL_SUDO_DIR/root_runner.sh" "$__LL_SUDO_REQ" "$__LL_SUDO_RESP" "$__LL_SUDO_READY" &
  echo "$!" > "$__LL_SUDO_PIDFILE"
  i=0
  while [ ! -f "$__LL_SUDO_READY" ] && [ $i -lt 300 ]; do
    kill -0 "$(cat "$__LL_SUDO_PIDFILE" 2>/dev/null)" 2>/dev/null || {
      echo "[LastLayer] Authentication cancelled" >&2
      [ -n "$real_sudo" ] && exec "$real_sudo" "$@"
      exit 1
    }
    sleep 0.1; i=$((i + 1))
  done
  [ -f "$__LL_SUDO_READY" ] || {
    echo "[LastLayer] Authentication timeout" >&2
    [ -n "$real_sudo" ] && exec "$real_sudo" "$@"
    exit 1
  }
fi

out="$(mktemp "$__LL_SUDO_DIR/out.XXXXXX")"
err="$(mktemp "$__LL_SUDO_DIR/err.XXXXXX")"
printf -v cmd '%q ' "$@"
{ printf '%s\n' "$out"; printf '%s\n' "$err"; printf '%s\n' "$PWD"; printf '%s\n' "$cmd"; } > "$__LL_SUDO_REQ"
code="1"; IFS= read -r code < "$__LL_SUDO_RESP" || code="1"
cat "$out"; cat "$err" >&2; rm -f "$out" "$err" 2>/dev/null
case "$code" in ''|*[!0-9]*) exit 1 ;; *) exit "$code" ;; esac
LLSUDOEOF
chmod 755 "$__LL_SUDO_DIR/bin/sudo"

llStartPkexec() {
  [ -f "$__LL_SUDO_READY" ] && [ -f "$__LL_SUDO_PIDFILE" ] && {
    pid="$(cat "$__LL_SUDO_PIDFILE" 2>/dev/null)"
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && return 0
  }

  rm -f "$__LL_SUDO_REQ" "$__LL_SUDO_RESP" "$__LL_SUDO_READY" 2>/dev/null
  mkfifo "$__LL_SUDO_REQ" "$__LL_SUDO_RESP"
  pkexec "$__LL_SUDO_DIR/root_runner.sh" "$__LL_SUDO_REQ" "$__LL_SUDO_RESP" "$__LL_SUDO_READY" &
  echo "$!" > "$__LL_SUDO_PIDFILE"
  local i=0
  while [ ! -f "$__LL_SUDO_READY" ] && [ $i -lt 300 ]; do
    kill -0 "$(cat "$__LL_SUDO_PIDFILE")" 2>/dev/null || { echo "Auth cancelled" >&2; return 1; }
    sleep 0.1; i=$((i + 1))
  done
  [ -f "$__LL_SUDO_READY" ]
}

export __LL_SUDO_DIR __LL_SUDO_REQ __LL_SUDO_RESP __LL_SUDO_READY __LL_SUDO_PIDFILE
export PATH="$__LL_SUDO_DIR/bin:$PATH"

