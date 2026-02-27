#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_SCRIPT="$SCRIPT_DIR/install.sh"
UNINSTALL_SCRIPT="$SCRIPT_DIR/uninstall.sh"

LOG_DIR="$HOME/.cache/lastlayer"
TMP_LOG_DIR="/tmp/llayer-reinstall"
LOG_FILE_NAME="reinstall_$(date +%Y%m%d_%H%M%S).log"
LOG_FILE_TMP="$TMP_LOG_DIR/$LOG_FILE_NAME"
LOG_FILE="$LOG_DIR/$LOG_FILE_NAME"
LOG_FILE_ACTIVE="$LOG_FILE_TMP"

print_message() {
    echo -e "${2}${1}${NC}" | tee -a "$LOG_FILE_ACTIVE"
}

run_with_log() {
    local label="$1"
    local script_path="$2"
    shift 2

    if [ ! -f "$script_path" ]; then
        print_message "Error: $label script not found at $script_path" "$RED"
        return 1
    fi

    print_message "Running $label..." "$YELLOW"
    bash "$script_path" "$@" 2>&1 | tee -a "$LOG_FILE_ACTIVE"
    local status=${PIPESTATUS[0]}
    if [ "$status" -ne 0 ]; then
        print_message "$label failed with exit code $status" "$RED"
        return "$status"
    fi

    print_message "$label completed" "$GREEN"
    return 0
}

cleanup_user_data() {
    local targets=(
        "$HOME/.lastlayer_persistent"
        "$HOME/.config/lastlayer_pref"
        "$HOME/.cache/lastlayer"
        "$HOME/.cache/lastlayer_popup.lock"
        "$HOME/.cache/lastlayer_popup_command.txt"
        "$HOME/.local/share/lastlayer"
    )

    print_message "Removing user settings and cache..." "$YELLOW"
    for path in "${targets[@]}"; do
        if [ -e "$path" ]; then
            rm -rf -- "$path"
            print_message "Removed: $path" "$GREEN"
        else
            print_message "Not found (skipped): $path" "$YELLOW"
        fi
    done
}

if [ "$EUID" -eq 0 ]; then
    print_message "Please do not run this script as root" "$RED"
    exit 1
fi

mkdir -p "$TMP_LOG_DIR"
print_message "Reinstall log (temp): $LOG_FILE_TMP" "$YELLOW"

keep_data="yes"
if [ "$1" = "-auto" ]; then
    print_message "Auto mode: preserving settings, cache, and prefixes" "$YELLOW"
else
    read -r -p "Keep settings, cache, and prefixes? [Y/n]: " answer
    case "$answer" in
        [nN]|[nN][oO]) keep_data="no" ;;
        *) keep_data="yes" ;;
    esac
fi

uninstall_args=()
if [ "$keep_data" = "yes" ]; then
    uninstall_args+=(--keep-data)
fi

if ! run_with_log "Uninstall" "$UNINSTALL_SCRIPT" "${uninstall_args[@]}"; then
    print_message "Reinstall aborted due to uninstall failure" "$RED"
    exit 1
fi

if [ "$keep_data" = "yes" ]; then
    if [ -d "$HOME/.lastlayer_persistent" ]; then
        print_message "User settings preserved in ~/.lastlayer_persistent" "$GREEN"
    else
        print_message "Warning: ~/.lastlayer_persistent not found after uninstall" "$YELLOW"
    fi
else
    cleanup_user_data
fi

if ! run_with_log "Install" "$INSTALL_SCRIPT"; then
    print_message "Reinstall aborted due to install failure" "$RED"
    exit 1
fi

mkdir -p "$LOG_DIR"
mv -f "$LOG_FILE_TMP" "$LOG_FILE"
LOG_FILE_ACTIVE="$LOG_FILE"
print_message "Reinstall log: $LOG_FILE" "$YELLOW"
print_message "Reinstall completed successfully" "$GREEN"
