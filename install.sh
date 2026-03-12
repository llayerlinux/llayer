#!/bin/bash

notify_safe() {
    local title="$1"
    local msg="$2"
    local user=$(logname)
    local pid

    for proc in gnome-session sway plasma_session ags hyprland; do
        pid=$(pgrep -u "$user" -n "$proc")
        [ -n "$pid" ] && break
    done
    if [ -n "$pid" ]; then
        export DBUS_SESSION_BUS_ADDRESS=$(grep -z DBUS_SESSION_BUS_ADDRESS /proc/$pid/environ | tr '\0' '\n' | grep DBUS_SESSION_BUS_ADDRESS | cut -d= -f2-)
        sudo -u "$user" notify-send "$title" "$msg" 2>/dev/null && return
    fi

    dbus-send --session --dest=org.freedesktop.Notifications --type=method_call \
        /org/freedesktop/Notifications org.freedesktop.Notifications.Notify \
        string:"lastlayer" uint32:0 string:"" string:"$title" string:"$msg" \
        array:string:"" array:dict:string:string:"" int32:5000 2>/dev/null && return
    echo "$title: $msg"
}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_message() {
    echo -e "${2}${1}${NC}"
}

update_restore_point_timestamp() {
    local timestamp="$1"
    local settings_file="$HOME/.config/lastlayer/settings.json"
    local tmp_file

    mkdir -p "$(dirname "$settings_file")"

    if [ -f "$settings_file" ] && command -v jq &>/dev/null; then
        tmp_file=$(mktemp)
        if jq --arg ts "$timestamp" '(.restore_point_last_update = $ts)' "$settings_file" >"$tmp_file" 2>/dev/null; then
            mv "$tmp_file" "$settings_file"
            return
        fi
        rm -f "$tmp_file"
    fi

    printf '{\n  "restore_point_last_update": "%s"\n}\n' "$timestamp" > "$settings_file"
}

write_code_revision_timestamp() {
    local source_dir="$1"
    local install_dir="$2"
    local source_stamp_file="$source_dir/.code_revision_timestamp"
    local stamp_file="$install_dir/.code_revision_timestamp"
    local source_stamp=""
    local latest_epoch=""

    if [ -f "$source_stamp_file" ]; then
        source_stamp=$(tr -d '\r' < "$source_stamp_file" | head -n 1)
    fi

    if [ -n "$source_stamp" ]; then
        printf '%s\n' "$source_stamp" > "$stamp_file"
        return
    fi

    latest_epoch=$(find "$source_dir/src" "$source_dir/styles" "$source_dir/assets" -type f -printf '%T@\n' 2>/dev/null \
        | awk 'BEGIN { max = 0 } { value = int($1); if (value > max) max = value } END { print max }')

    if [ -z "$latest_epoch" ] || [ "$latest_epoch" -le 0 ]; then
        latest_epoch=$(date +%s)
    fi

    local formatted
    formatted=$(date -d "@$latest_epoch" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')
    printf '%s\n' "$formatted" > "$stamp_file"
}


if [ "$EUID" -eq 0 ]; then
    print_message "Please do not run this script as root" "$RED"
    exit 1
fi

print_message "Stopping running instances..." "$YELLOW"
pkill -9 -f "gjs.*lastlayer" 2>/dev/null || true
pkill -9 -f "gjs.*llayer" 2>/dev/null || true
pkill -9 -f "gjs.*src/app/main.js" 2>/dev/null || true
sleep 0.2
pkill -9 -f "gjs.*lastlayer" 2>/dev/null || true
pkill -9 -f "gjs.*llayer" 2>/dev/null || true
pkill -9 -f "gjs.*src/app/main.js" 2>/dev/null || true
rm -f "$HOME/.cache/lastlayer_popup.lock" 2>/dev/null || true
rm -f "$HOME/.cache/lastlayer_popup_command.txt" 2>/dev/null || true
rm -f "$HOME/.cache/lastlayer/instance.lock" 2>/dev/null || true
sleep 0.3
if pgrep -f "gjs.*lastlayer" >/dev/null 2>&1 || pgrep -f "gjs.*src/app/main.js" >/dev/null 2>&1; then
    print_message "Warning: Some processes may still be running" "$YELLOW"
fi

print_message "Checking dependencies..." "$YELLOW"

SCRIPT_DIR_SRC="$(cd "$(dirname "$0")" && pwd)"
COMMON_DEPS_SCRIPT="$(cd "$SCRIPT_DIR_SRC/.." && pwd)/common/deps.sh"
LOCAL_DEPS_SCRIPT="$SCRIPT_DIR_SRC/scripts/deps.sh"
if [ -f "$COMMON_DEPS_SCRIPT" ]; then
    source "$COMMON_DEPS_SCRIPT"
elif [ -f "$LOCAL_DEPS_SCRIPT" ]; then
    source "$LOCAL_DEPS_SCRIPT"
else
    print_message "Error: dependency helper not found" "$RED"
    exit 1
fi

if ! ll_dep_install_if_missing_cmd "pkg-config" "pkg-config"; then
    print_message "Error: pkg-config is not installed and auto-install failed" "$RED"
    exit 1
fi

if ! ll_dep_install_if_missing_cmd "gjs" "gjs"; then
    print_message "Error: GJS is not installed and auto-install failed" "$RED"
    exit 1
fi


GJS_VERSION=$(gjs --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' || echo "0.0")
GJS_MAJOR=$(echo "$GJS_VERSION" | cut -d. -f1)
GJS_MINOR=$(echo "$GJS_VERSION" | cut -d. -f2)

if [ -z "$GJS_MAJOR" ] || [ -z "$GJS_MINOR" ] || [ "$GJS_MAJOR" -lt 1 ] || ([ "$GJS_MAJOR" -eq 1 ] && [ "$GJS_MINOR" -lt 80 ]); then
    print_message "Error: GJS version 1.80 or higher is required (found $GJS_VERSION)" "$RED"
    exit 1
fi

if ! ll_dep_install_if_missing_gi_namespace_any "soup-gi" "Soup" "3.0" "2.4"; then
    print_message "Error: Soup GI typelib (3.0/2.4) is not installed and auto-install failed" "$RED"
    exit 1
fi

if ! ll_dep_install_if_missing_gi_namespace_any "webkit2-gi-4.0" "WebKit2" "4.1" "4.0"; then
    print_message "Error: WebKit2 GI typelib (4.1/4.0) is not installed and auto-install failed" "$RED"
    exit 1
fi


MISSING_DEPS=()


if ! ll_dep_install_if_missing_cmd "swww" "swww"; then
    MISSING_DEPS+=("swww")
fi


if ! ll_dep_install_if_missing_cmd "yad" "yad"; then
    MISSING_DEPS+=("yad")
fi

if ! ll_dep_install_if_missing_webkit; then
    MISSING_DEPS+=("webkit2gtk")
elif ! pkg-config --exists webkit2gtk-4.1 2>/dev/null && ! pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
    MISSING_DEPS+=("webkit2gtk")
fi

if ! ll_dep_install_if_missing_cmd "jq" "jq"; then
    MISSING_DEPS+=("jq")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    print_message "Missing dependencies: ${MISSING_DEPS[*]}" "$RED"
    print_message "Please install them using your package manager" "$YELLOW"
    exit 1
fi

INSTALL_DIR="$HOME/.config/lastlayer"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
SCRIPT_DIR="$INSTALL_DIR/scripts"

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR" "$SCRIPT_DIR"


rm -rf "$INSTALL_DIR/js"
rm -rf "$INSTALL_DIR/assets"
rm -rf "$INSTALL_DIR/styles"
rm -rf "$INSTALL_DIR/src"

cp -rf "$SCRIPT_DIR_SRC/assets" "$INSTALL_DIR/assets"
cp -rf "$SCRIPT_DIR_SRC/styles" "$INSTALL_DIR/styles"
cp -rf "$SCRIPT_DIR_SRC/src" "$INSTALL_DIR/src"
if [ -d "$SCRIPT_DIR_SRC/html" ]; then
    cp -rf "$SCRIPT_DIR_SRC/html" "$INSTALL_DIR/html"
fi
write_code_revision_timestamp "$SCRIPT_DIR_SRC" "$INSTALL_DIR"

mkdir -p "$HOME/.lastlayer_persistent"
[ -f "$HOME/.lastlayer_persistent/global_recommendations.json" ] || printf '{}\n' > "$HOME/.lastlayer_persistent/global_recommendations.json"
[ -f "$INSTALL_DIR/global_recommendations.json" ] || printf '{}\n' > "$INSTALL_DIR/global_recommendations.json"
[ -f "$INSTALL_DIR/src/infrastructure/hyprland/global_recommendations.json" ] || printf '{}\n' > "$INSTALL_DIR/src/infrastructure/hyprland/global_recommendations.json"

print_message "Checking runtime entrypoint..." "$YELLOW"
if [ ! -f "$INSTALL_DIR/src/app/main.js" ]; then
    print_message "Error: main entrypoint is missing" "$RED"
    exit 1
fi

print_message "Runtime entrypoint check passed!" "$GREEN"

print_message "Installing LastLayer scripts..." "$YELLOW"
cp -f "$SCRIPT_DIR_SRC/scripts/"*.sh "$SCRIPT_DIR/" 2>/dev/null || true
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

SECURITY_DEFAULTS_SRC="$SCRIPT_DIR_SRC/security_defaults.json"
SECURITY_DEFAULTS_DEST="$INSTALL_DIR/security_defaults.json"
if [ -f "$SECURITY_DEFAULTS_SRC" ]; then
    if [ ! -f "$SECURITY_DEFAULTS_DEST" ]; then
        cp "$SECURITY_DEFAULTS_SRC" "$SECURITY_DEFAULTS_DEST"
        print_message "Security defaults copied" "$GREEN"
    fi
fi

RESTORE_LOG="$HOME/.cache/lastlayer/install_restore_point.log"
mkdir -p "$(dirname "$RESTORE_LOG")"

if [ -x "$SCRIPT_DIR/start_point_update.sh" ]; then
    print_message "Creating default restore pointРІР‚В¦" "$YELLOW"
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    update_restore_point_timestamp "$timestamp"
    if command -v nohup &>/dev/null; then
        nohup "$SCRIPT_DIR/start_point_update.sh" --no-notify >"$RESTORE_LOG" 2>&1 &
    else
        "$SCRIPT_DIR/start_point_update.sh" --no-notify >"$RESTORE_LOG" 2>&1 &
    fi
    RESTORE_POINT_PID=$!
    print_message "Restore point creation scheduled in background" "$GREEN"
else
    print_message "Warning: start_point_update.sh not found, skipping restore point" "$YELLOW"
fi


PREF_DIR="$HOME/.config/lastlayer_pref"
mkdir -p "$PREF_DIR"
echo '{"gtkTheme":"LastLayer"}' > "$PREF_DIR/theme_selector_settings.json"


if [ -d "$HOME/.lastlayer_persistent" ]; then
    print_message "Previous user settings found and will be restored" "$GREEN"
else
    print_message "User settings will be saved to ~/.lastlayer_persistent" "$YELLOW"
fi

cat > "$BIN_DIR/lastlayer" << 'EOF'
#!/usr/bin/env bash
INSTALL_DIR="$HOME/.config/lastlayer"

if [ ! -d "$INSTALL_DIR/src" ]; then
    echo "Error: LastLayer is not installed properly. Please run install.sh again."
    exit 1
fi

cd "$INSTALL_DIR" || exit 1

exec gjs -m src/app/main.js "$@"
EOF

chmod +x "$BIN_DIR/lastlayer"

cat > "$BIN_DIR/llayer" << 'EOF'
#!/usr/bin/env bash
exec "$HOME/.local/bin/lastlayer" "$@"
EOF

chmod +x "$BIN_DIR/llayer"

install_global_launchers() {
    local global_bin="/usr/local/bin"
    local target="$BIN_DIR/lastlayer"
    if [ ! -d "$global_bin" ]; then
        if [ -w "/usr/local" ]; then
            mkdir -p "$global_bin" 2>/dev/null || true
        elif command -v sudo &>/dev/null; then
            sudo mkdir -p "$global_bin" 2>/dev/null || true
        fi
    fi
    if [ -w "$global_bin" ]; then
        ln -sf "$target" "$global_bin/lastlayer" 2>/dev/null || true
        ln -sf "$target" "$global_bin/llayer" 2>/dev/null || true
    elif command -v sudo &>/dev/null; then
        sudo ln -sf "$target" "$global_bin/lastlayer" 2>/dev/null || true
        sudo ln -sf "$target" "$global_bin/llayer" 2>/dev/null || true
    fi
}

install_global_launchers
hash -r 2>/dev/null || true

cat > "$DESKTOP_DIR/lastlayer.desktop" << EOF
[Desktop Entry]
Name=LastLayer
Comment=Rice Management System
Exec=$BIN_DIR/lastlayer --toggle
Icon=$INSTALL_DIR/assets/icon.png
Terminal=false
Type=Application
Categories=Utility;
EOF


add_to_path() {
    local config_file="$1"
    local path_line="$2"


    [ -f "$config_file" ] || touch "$config_file"


    if ! grep -q "$path_line" "$config_file"; then
        echo "$path_line" >> "$config_file"
    fi
}


add_to_path "$HOME/.bashrc" 'export PATH="$HOME/.local/bin:$PATH"'
add_to_path "$HOME/.bash_profile" 'export PATH="$HOME/.local/bin:$PATH"'
add_to_path "$HOME/.zshrc" 'export PATH="$HOME/.local/bin:$PATH"'
add_to_path "$HOME/.zprofile" 'export PATH="$HOME/.local/bin:$PATH"'
add_to_path "$HOME/.profile" 'export PATH="$HOME/.local/bin:$PATH"'


if [ -d "$HOME/.config/fish" ]; then
    mkdir -p "$HOME/.config/fish/conf.d"
    echo 'set -x PATH $HOME/.local/bin $PATH' > "$HOME/.config/fish/conf.d/lastlayer.fish"
fi


export PATH="$HOME/.local/bin:$PATH"


case $SHELL in
    */bash)
        source "$HOME/.bashrc" 2>/dev/null
        ;;
    */zsh)
        source "$HOME/.zshrc" 2>/dev/null
        ;;
    */fish)
        source "$HOME/.config/fish/conf.d/lastlayer.fish" 2>/dev/null
        ;;
esac

mkdir -p "$HOME/.config/environment.d"
printf 'PATH=%s\n' "$HOME/.local/bin:$PATH" > "$HOME/.config/environment.d/lastlayer.conf"


HYPR_DIR="$HOME/.config/hypr"
MAIN_CONFIG="$HYPR_DIR/hyprland.conf"
KEYBIND_COMMENT="# Automatically generated for quick LastLayer popup"
KEYBIND_LINE="bind = SUPER, F12, exec, $HOME/.local/bin/lastlayer --toggle"

mkdir -p "$HYPR_DIR"


find_available_key() {
    local file="$1"
    local keys=("F1" "F2" "F3" "F4" "F5" "F6" "F7" "F8" "F9" "F10" "F11" "F12")

    for key in "${keys[@]}"; do
        if ! grep -q "bind = SUPER, $key," "$file"; then
            echo "$key"
            return 0
        fi
    done
    return 1
}

add_keybind() {
    local file="$1"
    local used_key=""

    [ -f "$file" ] || touch "$file"


    if grep -q "F12" "$file"; then
        if grep -q "lastlayer" "$file"; then

            sed -i "/$KEYBIND_COMMENT/,+1d" "$file" 2>/dev/null
            echo -e "\n$KEYBIND_COMMENT (SUPER+F12)\n$KEYBIND_LINE" >> "$file"
            used_key="F12"
        else

            local new_key=$(find_available_key "$file")
            if [ -n "$new_key" ]; then
                KEYBIND_LINE="bind = SUPER, $new_key, exec, $HOME/.local/bin/lastlayer"
                echo -e "\n$KEYBIND_COMMENT (SUPER+$new_key)\n$KEYBIND_LINE" >> "$file"
                used_key="$new_key"
            else
                print_message "Error: Could not find an available key combination" "$RED"
                return 1
            fi
        fi
    else
        echo -e "\n$KEYBIND_COMMENT (SUPER+F12)\n$KEYBIND_LINE" >> "$file"
        used_key="F12"
    fi
    echo "$used_key"
}


USED_KEY=$(add_keybind "$MAIN_CONFIG")


if [ "$USED_KEY" = "F12" ]; then
    print_message "Added/Updated keybind to SUPER+F12" "$GREEN"
else
    print_message "F12 is already bound to another program" "$YELLOW"
    print_message "LastLayer has been bound to SUPER+$USED_KEY instead" "$GREEN"
fi

print_message "Installation completed successfully!" "$GREEN"
if ! command -v lastlayer >/dev/null 2>&1; then
    print_message "Current shell PATH is not updated yet." "$YELLOW"
    print_message "Run: export PATH=\"\$HOME/.local/bin:\$PATH\" && hash -r" "$YELLOW"
fi
print_message "You can launch LastLayer in three ways:" "$GREEN"
print_message "1. Desktop shortcut: LastLayer" "$GREEN"
print_message "2. Hotkey: SUPER+$USED_KEY (toggles the popup)" "$GREEN"
print_message "3. Terminal command: lastlayer" "$GREEN"

if [ -n "${RESTORE_POINT_PID:-}" ] && kill -0 "$RESTORE_POINT_PID" 2>/dev/null; then
    print_message "Waiting for restore point creation to finish..." "$YELLOW"
    wait "$RESTORE_POINT_PID" 2>/dev/null || true
fi

print_message "Reloading Hyprland configuration..." "$YELLOW"
if hyprctl reload &>/dev/null; then
    print_message "Hyprland configuration reloaded successfully" "$GREEN"
    mkdir -p "$HOME/.cache/lastlayer"
    echo "$(date +%s)" > "$HOME/.cache/lastlayer/recent_hyprctl_reload"
else
    print_message "Note: Could not reload Hyprland configuration" "$YELLOW"
    print_message "You may need to reload it manually with: hyprctl reload" "$YELLOW"
fi

echo "Restore point will be updated on first application launch"
