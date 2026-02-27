#!/usr/bin/env bash


NO_NOTIFY=0
KEEP_CURRENT_THEME=0
for arg in "$@"; do
    if [[ "$arg" == "--no-notify" ]]; then
        NO_NOTIFY=1
    elif [[ "$arg" == "--keep-current-theme" ]]; then
        KEEP_CURRENT_THEME=1
    fi
done


notifySafe() {
    if [ "$NO_NOTIFY" = "1" ]; then
        return
    fi
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

purgeDirContents() {
    local dir="$1"
    [ -d "$dir" ] || return 0
    find "$dir" -mindepth 1 -depth -print0 2>/dev/null | while IFS= read -r -d '' entry; do
        if [ -d "$entry" ]; then
            rmdir "$entry" 2>/dev/null || true
        else
            rm -f "$entry" 2>/dev/null || true
        fi
    done
}

removePathSafely() {
    local path="$1"
    [ -e "$path" ] || return 0
    if [ -L "$path" ] || [ -f "$path" ]; then
        rm -f "$path" 2>/dev/null || true
        return 0
    fi
    if [ -d "$path" ]; then
        purgeDirContents "$path"
        rmdir "$path" 2>/dev/null || true
    fi
}


for dir in fish alacritty kitty waybar eww ags starship wlogout rofi dunst cava btop picom swaync wluma wofi default_wallpapers; do
  BACKUP_DIRS+=("$dir")
done


BACKUP_DIRS=("${BACKUP_DIRS[@]/hypr}")

set -euo pipefail

DEFAULT_THEME_DIR="$HOME/.config/themes/default"
CONFIGS_DIR="$DEFAULT_THEME_DIR/configs"
START_SCRIPTS_DIR="$DEFAULT_THEME_DIR/start-scripts"
WALL_DIR="$DEFAULT_THEME_DIR/default_wallpapers"
PREF_DIR="$HOME/.config/lastlayer_pref"


CURRENT_THEME_FILE="$PREF_DIR/current_theme"
if [ -f "$CURRENT_THEME_FILE" ]; then
  theme_to_backup="$(cat "$CURRENT_THEME_FILE")"
fi

if [ -z "$theme_to_backup" ] || [ "$theme_to_backup" = "default" ]; then
  _hypr_conf="$HOME/.config/hypr/hyprland.conf"
  if [ -f "$_hypr_conf" ]; then
    _detected=$(sed -n 's|.*\.config/themes/\([^/]*\)/.*|\1|p' "$_hypr_conf" | grep -v '^default$' | head -1)
    if [ -n "$_detected" ] && [ -d "$HOME/.config/themes/$_detected" ]; then
      theme_to_backup="$_detected"
      printf '[start_point_update] Auto-detected active theme: %s\n' "$theme_to_backup"
    fi
  fi
fi

if [ "$theme_to_backup" = "default" ]; then
  TMP_HYPR_CONF="/tmp/hyprland.conf.$$"
  TMP_HYPR_DIR="/tmp/hyprland.$$"
  TMP_PER_RICE="/tmp/per_rice_hyprland.json.$$"
  TMP_OVERRIDES_JSON="/tmp/overrides.json.$$"
  TMP_PER_RICE_HOTKEYS="/tmp/per_rice_hotkeys.json.$$"
  TMP_HOTKEY_OVERRIDES="/tmp/hotkey-overrides.json.$$"
  [ -f "$HOME/.config/themes/default/hyprland.conf" ] && cp "$HOME/.config/themes/default/hyprland.conf" "$TMP_HYPR_CONF"
  [ -d "$HOME/.config/themes/default/hyprland" ] && cp -r "$HOME/.config/themes/default/hyprland" "$TMP_HYPR_DIR"
  [ -f "$HOME/.config/themes/default/per_rice_hyprland.json" ] && cp "$HOME/.config/themes/default/per_rice_hyprland.json" "$TMP_PER_RICE"
  [ -f "$HOME/.config/themes/default/.overrides.json" ] && cp "$HOME/.config/themes/default/.overrides.json" "$TMP_OVERRIDES_JSON"
  [ -f "$HOME/.config/themes/default/per_rice_hotkeys.json" ] && cp "$HOME/.config/themes/default/per_rice_hotkeys.json" "$TMP_PER_RICE_HOTKEYS"
  [ -f "$HOME/.config/themes/default/.hotkey-overrides.json" ] && cp "$HOME/.config/themes/default/.hotkey-overrides.json" "$TMP_HOTKEY_OVERRIDES"
fi


if [ -d "$DEFAULT_THEME_DIR" ]; then
  removePathSafely "$DEFAULT_THEME_DIR"
fi

mkdir -p "$CONFIGS_DIR" "$START_SCRIPTS_DIR" "$WALL_DIR"

removePathSafely "$DEFAULT_THEME_DIR/scripts"


printf '[start_point_update] Refreshing configs…\n'
purgeDirContents "$CONFIGS_DIR"
for d in "${BACKUP_DIRS[@]}"; do
  [ "$d" = "default_wallpapers" ] && continue  
  [ "$d" = "hypr" ] && continue 
  SRC="$HOME/.config/$d"
  if [ -d "$SRC" ]; then
    printf '  └─ %s\n' "$d"
    cp -r "$SRC" "$CONFIGS_DIR/" 2>/dev/null || true
  fi
done


printf '[start_point_update] Backing up wallpaper…\n'
SCRIPT_DIR="$(dirname "$0")"
if [ -x "$SCRIPT_DIR/find_and_backup_hyprland.sh" ]; then
  "$SCRIPT_DIR/find_and_backup_hyprland.sh" "$WALL_DIR" || true
fi


CURRENT_THEME_FILE="$PREF_DIR/current_theme"
if [ -f "$CURRENT_THEME_FILE" ]; then
  current_theme="$(cat "$CURRENT_THEME_FILE")"
fi
if [ -n "${current_theme:-}" ]; then
  if [ -d "$HOME/.config/themes/$current_theme/start-scripts" ]; then
    printf '[start_point_update] Copy start-scripts from theme %s…\n' "$current_theme"
    purgeDirContents "$START_SCRIPTS_DIR"
    cp -r "$HOME/.config/themes/$current_theme/start-scripts"/* "$START_SCRIPTS_DIR/" 2>/dev/null || true
  elif [ -d "$HOME/.config/themes/$current_theme/scripts" ]; then
    printf '[start_point_update] Copy scripts from theme %s…\n' "$current_theme"
    purgeDirContents "$START_SCRIPTS_DIR"
    cp -r "$HOME/.config/themes/$current_theme/scripts"/* "$START_SCRIPTS_DIR/" 2>/dev/null || true
  fi
fi


if [ "$KEEP_CURRENT_THEME" != "1" ]; then
  echo "default" > "$CURRENT_THEME_FILE"

  SETTINGS_JSON="$HOME/.config/lastlayer_pref/theme_selector_settings.json"
  if [ -f "$SETTINGS_JSON" ]; then
    tmpfile=$(mktemp)
    jq --arg theme "default" '.theme = $theme' "$SETTINGS_JSON" > "$tmpfile" && mv "$tmpfile" "$SETTINGS_JSON"
  fi
fi


if [ -n "${theme_to_backup:-}" ] && [ "$theme_to_backup" != "default" ]; then
  THEME_DIR="$HOME/.config/themes/$theme_to_backup"
  DEFAULT_DIR="$HOME/.config/themes/default"
  if [ -f "$THEME_DIR/hyprland.conf" ]; then
    cp "$THEME_DIR/hyprland.conf" "$DEFAULT_DIR/"
    sed -i "s|\.config/themes/$theme_to_backup/|.config/themes/default/|g" "$DEFAULT_DIR/hyprland.conf"
    printf '[start_point_update] Copied hyprland.conf from %s (rewrote paths to default)\n' "$theme_to_backup"
  fi
  if [ -d "$THEME_DIR/hyprland" ]; then
    cp -r "$THEME_DIR/hyprland" "$DEFAULT_DIR/"
    printf '[start_point_update] Copied hyprland directory from %s\n' "$theme_to_backup"
  fi
  if [ -f "$THEME_DIR/per_rice_hyprland.json" ]; then
    cp "$THEME_DIR/per_rice_hyprland.json" "$DEFAULT_DIR/"
    printf '[start_point_update] Copied per_rice_hyprland.json from %s\n' "$theme_to_backup"
  fi
  if [ -f "$THEME_DIR/.overrides.json" ]; then
    cp "$THEME_DIR/.overrides.json" "$DEFAULT_DIR/"
    printf '[start_point_update] Copied .overrides.json from %s\n' "$theme_to_backup"
  fi
  if [ -f "$THEME_DIR/per_rice_hotkeys.json" ]; then
    cp "$THEME_DIR/per_rice_hotkeys.json" "$DEFAULT_DIR/"
    printf '[start_point_update] Copied per_rice_hotkeys.json from %s\n' "$theme_to_backup"
  fi
  if [ -f "$THEME_DIR/.hotkey-overrides.json" ]; then
    cp "$THEME_DIR/.hotkey-overrides.json" "$DEFAULT_DIR/"
    printf '[start_point_update] Copied .hotkey-overrides.json from %s\n' "$theme_to_backup"
  fi

  if [ ! -f "$THEME_DIR/hyprland.conf" ] && [ -f "$DEFAULT_DIR/hyprland.conf" ]; then
    rm -f "$DEFAULT_DIR/hyprland.conf"
    printf '[start_point_update] Removed hyprland.conf from default (not present in %s)\n' "$theme_to_backup"
  fi
 
  if [ ! -d "$THEME_DIR/hyprland" ] && [ -d "$DEFAULT_DIR/hyprland" ]; then
    removePathSafely "$DEFAULT_DIR/hyprland"
    printf '[start_point_update] Removed hyprland dir from default (not present in %s)\n' "$theme_to_backup"
  fi
fi


if [ "$theme_to_backup" = "default" ]; then
  [ -f "$TMP_HYPR_CONF" ] && cp "$TMP_HYPR_CONF" "$HOME/.config/themes/default/hyprland.conf"
  [ -d "$TMP_HYPR_DIR" ] && cp -r "$TMP_HYPR_DIR" "$HOME/.config/themes/default/hyprland"
  [ -f "$TMP_PER_RICE" ] && cp "$TMP_PER_RICE" "$HOME/.config/themes/default/per_rice_hyprland.json"
  [ -f "$TMP_OVERRIDES_JSON" ] && cp "$TMP_OVERRIDES_JSON" "$HOME/.config/themes/default/.overrides.json"
  [ -f "$TMP_PER_RICE_HOTKEYS" ] && cp "$TMP_PER_RICE_HOTKEYS" "$HOME/.config/themes/default/per_rice_hotkeys.json"
  [ -f "$TMP_HOTKEY_OVERRIDES" ] && cp "$TMP_HOTKEY_OVERRIDES" "$HOME/.config/themes/default/.hotkey-overrides.json"
  rm -f "$TMP_HYPR_CONF" "$TMP_PER_RICE" "$TMP_OVERRIDES_JSON" "$TMP_PER_RICE_HOTKEYS" "$TMP_HOTKEY_OVERRIDES"
  removePathSafely "$TMP_HYPR_DIR"
fi


ALL_BARS=(agsv1 eww waybar polybar yambar swaybar barberry)
detected_bar="none"
for bar in "${ALL_BARS[@]}"; do
 
  if pgrep -u "$USER" "$bar" &>/dev/null; then
    detected_bar="$bar"
    break
  fi
  
  if pgrep "$bar" &>/dev/null; then
    detected_bar="$bar"
    break
  fi

  if ps ax -o comm= | grep -w "$bar" &>/dev/null; then
    detected_bar="$bar"
    break
  fi
done
echo "Default bar for restore point: $detected_bar"

SETTINGS_JSON="$HOME/.config/lastlayer_pref/theme_selector_settings.json"
if [ -f "$SETTINGS_JSON" ]; then
  tmpfile=$(mktemp)
  jq --arg bar "$detected_bar" '.default_theme_bar = $bar | .default_bar_manual = false' "$SETTINGS_JSON" > "$tmpfile" && mv "$tmpfile" "$SETTINGS_JSON"
fi


if pgrep -f theme-selector-popup.js &>/dev/null; then
  if [ "$KEEP_CURRENT_THEME" = "1" ]; then
    notifySafe "lastlayer-rebuild-grid" "restore point refreshed"
  else
    notifySafe "lastlayer-rebuild-grid" "default theme selected"
  fi
fi

printf '[start_point_update] Done.\n' 
