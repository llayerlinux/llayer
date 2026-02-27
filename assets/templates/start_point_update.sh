#!/usr/bin/env bash


NO_NOTIFY=0
for arg in "$@"; do
    if [[ "$arg" == "--no-notify" ]]; then
        NO_NOTIFY=1
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
theme_to_backup=""
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
  chmod -R u+w "$DEFAULT_THEME_DIR" 2>/dev/null || true
  rm -rf "$DEFAULT_THEME_DIR"
fi

mkdir -p "$CONFIGS_DIR" "$START_SCRIPTS_DIR" "$WALL_DIR"

rm -rf "$DEFAULT_THEME_DIR/scripts"


printf '[start_point_update] Refreshing configs…\n'
rm -rf "$CONFIGS_DIR"/* || true

THEME_CONFIG_DIR=""
if [ -n "$theme_to_backup" ] && [ "$theme_to_backup" != "default" ]; then
  _td="$HOME/.config/themes/$theme_to_backup"
  [ -d "$_td/config" ] && THEME_CONFIG_DIR="$_td/config"
  [ -z "$THEME_CONFIG_DIR" ] && [ -d "$_td" ] && THEME_CONFIG_DIR="$_td"
fi

for d in "${BACKUP_DIRS[@]}"; do
  [ "$d" = "default_wallpapers" ] && continue
  [ "$d" = "hypr" ] && continue
  SRC="$HOME/.config/$d"
  [ -d "$SRC" ] || continue

  if [ -n "$THEME_CONFIG_DIR" ]; then
    _td_base="$HOME/.config/themes/$theme_to_backup"
    if [ ! -d "$THEME_CONFIG_DIR/$d" ] && [ ! -d "$_td_base/$d" ]; then
      printf '  ├─ %s (skipped: not in theme %s)\n' "$d" "$theme_to_backup"
      continue
    fi
  fi

  printf '  └─ %s\n' "$d"
  cp -r "$SRC" "$CONFIGS_DIR/" 2>/dev/null || true
done


printf '[start_point_update] Backing up wallpaper…\n'
SCRIPT_DIR="$(dirname "$0")"
THEME_WALL_FOUND=0
if [ -n "$theme_to_backup" ] && [ "$theme_to_backup" != "default" ]; then
  for ext in png jpg jpeg webp; do
    THEME_WALL="$HOME/.config/themes/$theme_to_backup/wallpaper.$ext"
    if [ -f "$THEME_WALL" ]; then
      cp "$THEME_WALL" "$WALL_DIR/"
      echo "$THEME_WALL" > "$WALL_DIR/wallpaper_source.txt"
      THEME_WALL_FOUND=1
      printf '  └─ wallpaper from theme dir: %s\n' "$theme_to_backup"
      break
    fi
  done
fi
if [ "$THEME_WALL_FOUND" = "0" ] && [ -x "$SCRIPT_DIR/find_and_backup_hyprland.sh" ]; then
  "$SCRIPT_DIR/find_and_backup_hyprland.sh" "$WALL_DIR" || true
fi


CURRENT_THEME_FILE="$PREF_DIR/current_theme"
if [ -f "$CURRENT_THEME_FILE" ]; then
  current_theme="$(cat "$CURRENT_THEME_FILE")"
fi
if [ -n "${current_theme:-}" ]; then
  if [ -d "$HOME/.config/themes/$current_theme/start-scripts" ]; then
    printf '[start_point_update] Copy start-scripts from theme %s…\n' "$current_theme"
    rm -rf "$START_SCRIPTS_DIR"/* || true
    cp -r "$HOME/.config/themes/$current_theme/start-scripts"/* "$START_SCRIPTS_DIR/" 2>/dev/null || true
  elif [ -d "$HOME/.config/themes/$current_theme/scripts" ]; then
    printf '[start_point_update] Copy scripts from theme %s…\n' "$current_theme"
    rm -rf "$START_SCRIPTS_DIR"/* || true
    cp -r "$HOME/.config/themes/$current_theme/scripts"/* "$START_SCRIPTS_DIR/" 2>/dev/null || true
  fi
fi


echo "default" > "$CURRENT_THEME_FILE"

SETTINGS_JSON="$HOME/.config/lastlayer_pref/theme_selector_settings.json"
if [ -f "$SETTINGS_JSON" ]; then
  tmpfile=$(mktemp)
  jq --arg theme "default" '.theme = $theme' "$SETTINGS_JSON" > "$tmpfile" && mv "$tmpfile" "$SETTINGS_JSON"
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
    rm -rf "$DEFAULT_DIR/hyprland"
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
  rm -rf "$TMP_HYPR_DIR"
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

detected_bar_cmd=""
if [ "$detected_bar" != "none" ]; then
  bar_pid=$(pgrep -u "$USER" -n -x "$detected_bar" 2>/dev/null || pgrep -n -x "$detected_bar" 2>/dev/null)
  if [ -n "$bar_pid" ] && [ -f "/proc/$bar_pid/cmdline" ]; then
    detected_bar_cmd=$(tr '\0' ' ' < "/proc/$bar_pid/cmdline" 2>/dev/null | sed 's/ $//')
  fi
  [ -z "$detected_bar_cmd" ] && detected_bar_cmd="$detected_bar"
  echo "Default bar command: $detected_bar_cmd"
fi

SETTINGS_JSON="$HOME/.config/lastlayer_pref/theme_selector_settings.json"
if [ -f "$SETTINGS_JSON" ]; then
  tmpfile=$(mktemp)
  jq --arg bar "$detected_bar" --arg cmd "$detected_bar_cmd" \
    '.default_theme_bar = $bar | .default_bar_manual = false | .default_theme_bar_cmd = $cmd' \
    "$SETTINGS_JSON" > "$tmpfile" && mv "$tmpfile" "$SETTINGS_JSON"
fi


if pgrep -f theme-selector-popup.js &>/dev/null; then
  notifySafe "lastlayer-rebuild-grid" "default theme selected"
fi

printf '[start_point_update] Done.\n'
