#!/usr/bin/env bash

BACKUP_DIR="${1:-{{DEFAULT_BACKUP_DIR}}}"
mkdir -p "$BACKUP_DIR"

recordSource() {
    echo "$1" > "$BACKUP_DIR/wallpaper_source.txt"
}

copyWall() {
    local src="$1"
    [ -f "$src" ] && { cp -u "$src" "$BACKUP_DIR/"; recordSource "$src"; exit 0; }
}

if command -v swww &>/dev/null; then
    wall=$(swww query 2>/dev/null | grep -oP '(?<=image: ).*' | head -1)
    echo "$wall" | grep -q '/themes/default/' || {
        [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"
    }
fi

if command -v hyprctl &>/dev/null; then
    wall=$(hyprctl hyprpaper listactive 2>/dev/null | head -1 | awk '{print $NF}')
    [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"

    wall=$(hyprctl -j monitors 2>/dev/null | grep -oP '"wallpaper":\s*"\K[^"]+' | head -1)
    [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"
fi

if command -v pgrep &>/dev/null; then
    wall=$(pgrep -a swaybg 2>/dev/null | grep -oE '/[^ ]*\.(png|jpg|jpeg|webp)' | head -1)
    [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"
fi

if [ -d "$HOME/.cache/swww" ]; then
    for cache_file in "$HOME/.cache/swww/"eDP-* "$HOME/.cache/swww/"HDMI-* "$HOME/.cache/swww/"DP-*; do
        [ ! -f "$cache_file" ] && continue
        wall=$(cat "$cache_file" 2>/dev/null | sed -E 's/^[^/]*//' | head -c 500 | tr -d '\0')
        echo "$wall" | grep -q '/themes/default/' && continue
        [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"
    done

    for cache_file in "$HOME/.cache/swww/WAYLAND-"*; do
        [ ! -f "$cache_file" ] && continue
        wall=$(cat "$cache_file" 2>/dev/null | sed -E 's/^[^/]*//' | head -c 500 | tr -d '\0')
        echo "$wall" | grep -q '/themes/default/' && continue
        [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"
    done
fi

HYPR_CONF="$HOME/.config/hypr/hyprland.conf"
if [ -f "$HYPR_CONF" ]; then
    wall=$(grep -iE '^\s*wallpaper\s*=' "$HYPR_CONF" | head -n1 | cut -d'=' -f2- | xargs)
    [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"

    wall=$(grep -E '^\s*exec.*swww\s+img' "$HYPR_CONF" | head -n1 | sed -E 's/.*swww\s+img\s+([^ ]+).*/\1/')
    [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall"
fi

for cache in "$HOME/.cache/swww/current" "$HOME/.cache/swww/current_wallpaper"; do
    [ -f "$cache" ] && {
        wall=$(cat "$cache" 2>/dev/null | xargs);
        [ -n "$wall" ] && [ -f "$wall" ] && copyWall "$wall";
    }
done

for wall in \
    "$HOME/.config/hyprland/wallpaper.png" \
    "$HOME/.config/hypr/wallpaper.png" \
    "$HOME/Pictures/wallpaper.jpg" \
    "$HOME/Pictures/wallpaper.png" \
    "$HOME/.local/share/wallpapers/current" \
    "$HOME/.config/wallpapers/default.jpg"; do
    [ -f "$wall" ] && copyWall "$wall"
done

echo "Wallpaper not found!"
exit 1
