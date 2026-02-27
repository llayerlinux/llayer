#!/usr/bin/env bash
__LL_ISOLATION_PREFIX="{{PREFIX}}"
__LL_VENV_PATH="{{VENV_PATH}}"

export PATH="$__LL_ISOLATION_PREFIX/bin:$PATH"
export LD_LIBRARY_PATH="$__LL_ISOLATION_PREFIX/lib:${LD_LIBRARY_PATH:-}"
export XDG_DATA_DIRS="$__LL_ISOLATION_PREFIX/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

[ -f "$__LL_VENV_PATH/bin/activate" ] && source "$__LL_VENV_PATH/bin/activate"

echo "[LASTLAYER] Isolation enabled (mode: {{MODE}}, prefix: $__LL_ISOLATION_PREFIX)"
