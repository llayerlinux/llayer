#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

KEEP_DATA=false
for arg in "$@"; do
    case "$arg" in
        --keep-data) KEEP_DATA=true ;;
    esac
done

print_message() {
    echo -e "${2}${1}${NC}"
}

print_message "Uninstalling LastLayer..." "$YELLOW"

print_message "Stopping lastlayer processes..." "$YELLOW"

pgrep -f "lastlayer" | xargs -r kill -TERM 2>/dev/null
sleep 2

pgrep -f "lastlayer" | xargs -r kill -KILL 2>/dev/null

pgrep -f "gjs.*lastlayer" | xargs -r kill -TERM 2>/dev/null
pgrep -f "ags.*lastlayer" | xargs -r kill -TERM 2>/dev/null
pgrep -f "gjs.*theme.*selector" | xargs -r kill -TERM 2>/dev/null
pgrep -f "gjs.*popup" | xargs -r kill -TERM 2>/dev/null
sleep 2

pgrep -f "gjs.*lastlayer" | xargs -r kill -KILL 2>/dev/null
pgrep -f "ags.*lastlayer" | xargs -r kill -KILL 2>/dev/null
pgrep -f "gjs.*theme.*selector" | xargs -r kill -KILL 2>/dev/null
pgrep -f "gjs.*popup" | xargs -r kill -KILL 2>/dev/null

safe_remove_file() {
    local file_path="$1"
    local description="$2"

    if [ -f "$file_path" ]; then
        if unlink "$file_path" 2>/dev/null; then
            print_message "$description removed" "$GREEN"
            return 0
        fi

        local temp_name="/tmp/lastlayer_cleanup_$(date +%s)_$(basename "$file_path")"
        if mv "$file_path" "$temp_name" 2>/dev/null; then
            print_message "$description moved to temp" "$GREEN"
            return 0
        fi

        if > "$file_path" 2>/dev/null; then
            print_message "$description truncated" "$YELLOW"
            return 0
        fi

        print_message "Warning: Could not remove $description" "$YELLOW"
        return 1
    fi
}

safe_remove_file "$HOME/.lastlayer_persistent/.lock" "Old lock file"
safe_remove_file "$HOME/.cache/lastlayer_popup.lock" "Cache lock file"
safe_remove_file "$HOME/.cache/lastlayer_popup_command.txt" "Cache command file"

print_message "Processes stopped" "$GREEN"

if [ "$KEEP_DATA" = true ]; then
    print_message "Preserving isolation prefixes in ~/.local/share/lastlayer/programs" "$YELLOW"
    find "$HOME/.local/share/lastlayer" -mindepth 1 -maxdepth 1 ! -name 'programs' -exec rm -rf {} \; 2>/dev/null
else
    rm -rf "$HOME/.local/share/lastlayer"
fi
rm -rf "$HOME/.config/lastlayer"
rm -f "$HOME/.local/bin/lastlayer"
rm -f "$HOME/.local/share/applications/lastlayer.desktop"

if [ "$KEEP_DATA" = true ]; then
    print_message "User settings and isolation prefixes preserved" "$YELLOW"
else
    print_message "All data removed" "$YELLOW"
fi

remove_from_file() {
    local file="$1"
    local pattern="$2"
    if [ -f "$file" ]; then
        sed -i "\#$pattern#d" "$file"
    fi
}

remove_from_file "$HOME/.bashrc" 'export PATH="$HOME/.local/bin:$PATH"'
remove_from_file "$HOME/.zshrc" 'export PATH="$HOME/.local/bin:$PATH"'
remove_from_file "$HOME/.profile" 'export PATH="$HOME/.local/bin:$PATH"'

rm -f "$HOME/.config/fish/conf.d/lastlayer.fish"

print_message "LastLayer has been uninstalled successfully!" "$GREEN"
print_message "Please restart your terminal for the changes to take effect" "$YELLOW"
