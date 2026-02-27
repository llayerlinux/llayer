#!/bin/bash
export __LL_ISOLATION_PREFIX="{{PREFIX}}"
export __LL_ISOLATION_BINARY="{{BINARY_NAME}}"
export __LL_VENV_PATH="{{VENV_PATH}}"

export PATH="$__LL_ISOLATION_PREFIX/bin:$PATH"
export LD_LIBRARY_PATH="$__LL_ISOLATION_PREFIX/lib:${LD_LIBRARY_PATH:-}"
export XDG_DATA_DIRS="$__LL_ISOLATION_PREFIX/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

[ -f "$__LL_VENV_PATH/bin/activate" ] && source "$__LL_VENV_PATH/bin/activate"

exec "{{REAL_BINARY_PATH}}" "$@"
