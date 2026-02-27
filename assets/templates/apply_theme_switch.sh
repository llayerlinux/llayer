#!/bin/bash
{

HOME="{{HOME_DIR}}"
export HOME
{{ISOLATION_SECTION}}
LOCK_PID_FILE="$HOME/.cache/llayer-apply.pid"

if [ -f "$LOCK_PID_FILE" ]; then
    OLD_PID=$(cat "$LOCK_PID_FILE" 2>/dev/null)
    if [ -n "$OLD_PID" ] && [ "$OLD_PID" != "$$" ]; then
        pkill -P "$OLD_PID" 2>/dev/null || true
        kill "$OLD_PID" 2>/dev/null || true
        echo "Killed previous theme apply process: $OLD_PID"
    fi
fi
echo $$ > "$LOCK_PID_FILE"
trap 'rm -f "$LOCK_PID_FILE" 2>/dev/null' EXIT

THEME="{{THEME_NAME}}"
VARIANT="{{VARIANT}}"
ANIMATION_TYPE="{{ANIMATION_TYPE}}"
ANIMATION_FPS="{{ANIMATION_FPS}}"
ANIMATION_ANGLE="{{ANIMATION_ANGLE}}"
TRANSITION_DURATION="{{TRANSITION_DURATION}}"
THEME_DIR="$HOME/.config/themes/$THEME"
PREF_DIR="$HOME/.config/lastlayer_pref"
INTERMEDIATE_DEFAULT="{{INTERMEDIATE_DEFAULT}}"
SETTINGS_JSON="$HOME/.config/lastlayer/settings.json"
DEBUG_LOG="$HOME/.cache/llayer-debug.log"
APPLY_TIMESTAMP=$(date -Iseconds)
echo "[$APPLY_TIMESTAMP] [APPLY     ] Starting theme apply: $THEME (PID: $$)" >> "$DEBUG_LOG"
[ -n "$VARIANT" ] && echo "[$APPLY_TIMESTAMP] [APPLY     ] Variant: $VARIANT" >> "$DEBUG_LOG"

SHOW_INSTALL_TERMINAL="{{SHOW_INSTALL_TERMINAL}}"
AUTO_CLOSE_INSTALL_TERMINAL="{{AUTO_CLOSE_INSTALL_TERMINAL}}"
SHOW_AFTER_INSTALL_TERMINAL="{{SHOW_AFTER_INSTALL_TERMINAL}}"
AUTO_CLOSE_AFTER_INSTALL_TERMINAL="{{AUTO_CLOSE_AFTER_INSTALL_TERMINAL}}"

DAEMON_START_TIMEOUT="{{DAEMON_START_TIMEOUT}}"
POST_INSTALL_DELAY="{{POST_INSTALL_DELAY}}"
POST_RELOAD_DELAY="{{POST_RELOAD_DELAY}}"
BAR_CHECK_INTERVAL="{{BAR_CHECK_INTERVAL}}"
TERMINAL_POLL_INTERVAL="{{TERMINAL_POLL_INTERVAL}}"
WALLPAPER_RETRY_DELAY="{{WALLPAPER_RETRY_DELAY}}"
DAEMON_POLL_INTERVAL="{{DAEMON_POLL_INTERVAL}}"
SCRIPT_FILE_WAIT_INTERVAL="{{SCRIPT_FILE_WAIT_INTERVAL}}"
WINDOW_OPERATION_DELAY="{{WINDOW_OPERATION_DELAY}}"
PROCESS_CLEANUP_DELAY="{{PROCESS_CLEANUP_DELAY}}"
WALLPAPER_ALREADY_APPLIED=0

XTERM_WIDTH=80
XTERM_HEIGHT=24
XTERM_PIXEL_WIDTH=650
XTERM_PIXEL_HEIGHT=450
XTERM_BG='#2e3440'
XTERM_FG='#d8dee9'
XTERM_FONT='Monospace'
XTERM_FONT_SIZE=11

getLlayerWindowPos() {
    command -v hyprctl &>/dev/null || return 1
    command -v jq &>/dev/null || return 1
    local json
    json=$(hyprctl clients -j 2>/dev/null)
    [ -z "$json" ] && return 1
    local x y w h
    x=$(echo "$json" | jq -r '[.[] | select(.title == "LastLayer")][0].at[0] // empty')
    y=$(echo "$json" | jq -r '[.[] | select(.title == "LastLayer")][0].at[1] // empty')
    w=$(echo "$json" | jq -r '[.[] | select(.title == "LastLayer")][0].size[0] // empty')
    h=$(echo "$json" | jq -r '[.[] | select(.title == "LastLayer")][0].size[1] // empty')
    [ -n "$x" ] && [ -n "$y" ] && [ -n "$w" ] && [ -n "$h" ] && {
        LLAYER_X="$x"; LLAYER_Y="$y"; LLAYER_W="$w"; LLAYER_H="$h"
        return 0
    }
    return 1
}

setupXtermRules() {
    local xterm_class="$1"
    command -v hyprctl &>/dev/null || return 1
    hyprctl keyword windowrulev2 "float,class:^($xterm_class)$" 2>/dev/null
    hyprctl keyword windowrulev2 "noinitialfocus,class:^($xterm_class)$" 2>/dev/null
    [ -n "$XTERM_PIXEL_WIDTH" ] && [ -n "$XTERM_PIXEL_HEIGHT" ] &&         hyprctl keyword windowrulev2 "size $XTERM_PIXEL_WIDTH $XTERM_PIXEL_HEIGHT,class:^($xterm_class)$" 2>/dev/null
    getLlayerWindowPos && {
        local xterm_x=$((LLAYER_X + LLAYER_W + 10))
        local llayer_bottom=$((LLAYER_Y + LLAYER_H))
        local xterm_y=$((llayer_bottom - XTERM_PIXEL_HEIGHT))
        [ "$xterm_y" -lt 0 ] && xterm_y=0
        hyprctl keyword windowrulev2 "move $xterm_x $xterm_y,class:^($xterm_class)$" 2>/dev/null
    }
}

buildXtermArgs() {
    local xterm_class="$1"
    local args="-class '$xterm_class' -geometry ${XTERM_WIDTH}x${XTERM_HEIGHT}"
    args="$args -bg '$XTERM_BG' -fg '$XTERM_FG' -fa '$XTERM_FONT' -fs $XTERM_FONT_SIZE"
    args="$args -xrm 'XTerm*background: $XTERM_BG'"
    args="$args -xrm 'XTerm*foreground: $XTERM_FG'"
    args="$args -xrm 'XTerm*cursorColor: $XTERM_FG'"
    args="$args -xrm 'XTerm*faceName: $XTERM_FONT'"
    args="$args -xrm 'XTerm*faceSize: $XTERM_FONT_SIZE'"
    args="$args -xrm 'XTerm*allowColorOps: false'"
    args="$args -xrm 'XTerm*dynamicColors: false'"
    echo "$args"
}

positionXtermWindow() {
    local xterm_class="$1"
    command -v hyprctl &>/dev/null || return
    local xt_addr
    xt_addr=$(hyprctl clients -j 2>/dev/null | jq -r "[.[] | select(.class == \"$xterm_class\")][0].address // empty")
    [ -z "$xt_addr" ] && return
    [ -n "$XTERM_PIXEL_WIDTH" ] && [ -n "$XTERM_PIXEL_HEIGHT" ] &&         hyprctl dispatch resizewindowpixel "exact $XTERM_PIXEL_WIDTH $XTERM_PIXEL_HEIGHT,address:$xt_addr" 2>/dev/null
    sleep "$WINDOW_OPERATION_DELAY"
    getLlayerWindowPos && {
        local xt_info
        xt_info=$(hyprctl clients -j 2>/dev/null | jq -r "[.[] | select(.class == \"$xterm_class\")][0]")
        local xt_h xt_x
        xt_h=$(echo "$xt_info" | jq -r '.size[1] // empty')
        xt_x=$(echo "$xt_info" | jq -r '.at[0] // empty')
        [ -n "$xt_h" ] && {
            local ll_bottom=$((LLAYER_Y + LLAYER_H))
            local new_y=$((ll_bottom - xt_h))
            [ "$new_y" -lt 0 ] && new_y=0
            hyprctl dispatch movewindowpixel "exact $xt_x $new_y,address:$xt_addr" 2>/dev/null
        }
    }
    hyprctl dispatch focuswindow "title:^(LastLayer)$" 2>/dev/null || true
}

isBarRunning() {
    local bar="$1"
    case "$bar" in
        ags|agsv1)
            pgrep -x ags &>/dev/null \
                || pgrep -x agsv1 &>/dev/null \
                || pgrep -x ags-1.8.2 &>/dev/null \
                || pgrep -f "/run/user/$(id -u)/.*ags\\.js" &>/dev/null \
                || pgrep -f "gjs.*(ags|Aylur)" &>/dev/null
            ;;
        hyprpanel|nwg-dock-hyprland) pgrep -f "$bar" &>/dev/null ;;
        *) pgrep "$bar" &>/dev/null ;;
    esac
}

killAgs() {
    local user_ags="$HOME/.local/bin/ags"
    command -v gdbus &>/dev/null && gdbus call --session \
        --dest com.github.Aylur.ags \
        --object-path /com/github/Aylur/ags/Application \
        --method com.github.Aylur.ags.Application.Quit &>/dev/null || true
    command -v busctl &>/dev/null && busctl --user call \
        com.github.Aylur.ags \
        /com/github/Aylur/ags/Application \
        com.github.Aylur.ags.Application Quit &>/dev/null || true
    [ -x "$user_ags" ] && "$user_ags" -q &>/dev/null || true
    [ -x "$user_ags" ] && "$user_ags" quit -i astal &>/dev/null || true
    command -v ags &>/dev/null && ags -q &>/dev/null || true
    command -v ags &>/dev/null && ags quit -i astal &>/dev/null || true
    pkill -TERM -x ags 2>/dev/null || true
    pkill -TERM -x agsv1 2>/dev/null || true
    pkill -TERM -x ags-1.8.2 2>/dev/null || true
    pkill -TERM -f "/run/user/$(id -u)/.*ags\\.js" 2>/dev/null || true
    pkill -TERM -f "gjs.*(ags|Aylur)" 2>/dev/null || true
    pkill -TERM -f "$HOME/.config/themes/yume/hyprland/scripts/controls.sh" 2>/dev/null || true
    pkill -TERM -f "$HOME/.local/bin/ags request sidebar:" 2>/dev/null || true
    pkill -TERM -f "socat -u UNIX-CONNECT:$XDG_RUNTIME_DIR/hypr/.*/\\.socket2\\.sock" 2>/dev/null || true
    sleep 0.25
    pkill -KILL -x ags 2>/dev/null || true
    pkill -KILL -x agsv1 2>/dev/null || true
    pkill -KILL -x ags-1.8.2 2>/dev/null || true
    pkill -KILL -f "/run/user/$(id -u)/.*ags\\.js" 2>/dev/null || true
    pkill -KILL -f "gjs.*(ags|Aylur)" 2>/dev/null || true
    pkill -KILL -f "$HOME/.config/themes/yume/hyprland/scripts/controls.sh" 2>/dev/null || true
    pkill -KILL -f "$HOME/.local/bin/ags request sidebar:" 2>/dev/null || true
    pkill -KILL -f "socat -u UNIX-CONNECT:$XDG_RUNTIME_DIR/hypr/.*/\\.socket2\\.sock" 2>/dev/null || true
}

killBar() {
    local bar="$1"
    case "$bar" in
        ags|agsv1) killAgs ;;
        hyprpanel|nwg-dock-hyprland) pkill -f "$bar" 2>/dev/null || true ;;
        *) pkill "$bar" 2>/dev/null || true ;;
    esac
    local attempts=0
    while isBarRunning "$bar" && [ "$attempts" -lt 20 ]; do
        sleep 0.1
        attempts=$((attempts + 1))
    done
    isBarRunning "$bar" && {
        case "$bar" in
            ags|agsv1) killAgs ;;
            hyprpanel|nwg-dock-hyprland) pkill -9 -f "$bar" 2>/dev/null || true ;;
            *) pkill -9 "$bar" 2>/dev/null || true ;;
        esac
        sleep 0.2
    }
}

manageBars() {
    local action="$1"
    local ALL_BARS={{BAR_ARRAY}}
    local REC_FILE="$PREF_DIR/recorded_bars.lst"
    mkdir -p "$PREF_DIR"

    getBarStartCmd() {
        case "$1" in
{{BAR_START_CASES}}
            *) echo "$1" ;;
        esac
    }

    startBar() {
        local cmd=$(getBarStartCmd "$1")
        eval "nohup $cmd &>/dev/null & disown" || true
    }

    if [ "$action" = "record" ]; then
        > "$REC_FILE"
        for bar in ${ALL_BARS[@]}; do
            isBarRunning "$bar" && { echo "$bar" >> "$REC_FILE"; killBar "$bar"; }
        done
        pkill -15 -f "/run/user/$(id -u)/.*ags\.js" 2>/dev/null || true

    elif [ "$action" = "restore" ]; then
        default_bar=$( [ -f "$SETTINGS_JSON" ] && jq -r '.default_theme_bar // "none"' "$SETTINGS_JSON" 2>/dev/null || echo "none")
        default_bar_cmd=$( [ -f "$SETTINGS_JSON" ] && jq -r '.default_theme_bar_cmd // ""' "$SETTINGS_JSON" 2>/dev/null || echo "")
        if [ "$default_bar" != "none" ]; then
            if isBarRunning "$default_bar"; then
                echo "Bar $default_bar already running, skipping restart"
            else
                local _bar_launch_cmd="$default_bar_cmd"

                if [ "$default_bar" = "waybar" ]; then
                    local _wb_dir="$HOME/.config/waybar"
                    if [ -z "$_bar_launch_cmd" ] || [ "$_bar_launch_cmd" = "waybar" ]; then
                        if [ -f "$_wb_dir/config" ] || [ -f "$_wb_dir/config.jsonc" ]; then
                            :
                        else
                            local _wb_cfg=""
                            for _cand in config-hypr config-hyprland config.json; do
                                [ -f "$_wb_dir/$_cand" ] && { _wb_cfg="$_wb_dir/$_cand"; break; }
                            done
                            if [ -n "$_wb_cfg" ]; then
                                _bar_launch_cmd="waybar -c $_wb_cfg"
                                [ -f "$_wb_dir/style.css" ] && _bar_launch_cmd="$_bar_launch_cmd -s $_wb_dir/style.css"
                                echo "Waybar: no standard config found, using: $_bar_launch_cmd"
                            fi
                        fi
                    fi
                fi

                if [ -n "$_bar_launch_cmd" ] && [ "$_bar_launch_cmd" != "$default_bar" ]; then
                    echo "Starting bar with command: $_bar_launch_cmd"
                    eval "nohup $_bar_launch_cmd &>/dev/null & disown" || true
                else
                    startBar "$default_bar"
                fi
                local _verify=0
                while ! isBarRunning "$default_bar" && [ "$_verify" -lt 15 ]; do
                    sleep 0.2
                    _verify=$((_verify + 1))
                done
            fi
        fi
    fi
}

checkThemeDir() {
    [ -d "$THEME_DIR" ] || { echo "Theme directory $THEME_DIR does not exist."; exit 1; }
}

syncThemeConfigs() {
    local apps=(waybar rofi dunst mako swaync kitty alacritty foot wlogout wofi fuzzel hyprpanel)
    for app in "${apps[@]}"; do
        local src="$THEME_DIR/config/$app"
        [ -d "$src" ] || src="$THEME_DIR/$app"

        [ -n "$VARIANT" ] && {
            [ -d "$THEME_DIR/variants/$VARIANT/config/$app" ] && src="$THEME_DIR/variants/$VARIANT/config/$app"
            [ -d "$THEME_DIR/variants/$VARIANT/$app" ] && src="$THEME_DIR/variants/$VARIANT/$app"
        }

        [ -d "$src" ] && {
            mkdir -p "$HOME/.config/$app"
            rm -rf "$HOME/.config/$app"/* 2>/dev/null
            cp -rf "$src/"* "$HOME/.config/$app/" 2>/dev/null
        }
    done
}

syncGtkSettings() {
    local gtk_source=""
    local locations=("$THEME_DIR/gtk-settings.ini" "$THEME_DIR/config/gtk-3.0/settings.ini")
    [ -n "$VARIANT" ] && locations=("$THEME_DIR/variants/$VARIANT/gtk-settings.ini" "$THEME_DIR/variants/$VARIANT/config/gtk-3.0/settings.ini" "${locations[@]}")

    for loc in "${locations[@]}"; do
        [ -f "$loc" ] && { gtk_source="$loc"; break; }
    done
    [ -z "$gtk_source" ] && return 0

    local icon_theme=$(grep -i "gtk-icon-theme-name" "$gtk_source" 2>/dev/null | head -1 | cut -d= -f2 | xargs)
    local gtk_theme=$(grep -i "gtk-theme-name" "$gtk_source" 2>/dev/null | head -1 | cut -d= -f2 | xargs)
    local cursor_theme=$(grep -i "gtk-cursor-theme-name" "$gtk_source" 2>/dev/null | head -1 | cut -d= -f2 | xargs)
    local cursor_size=$(grep -i "gtk-cursor-theme-size" "$gtk_source" 2>/dev/null | head -1 | cut -d= -f2 | xargs)

    command -v gsettings &>/dev/null && {
        [ -n "$icon_theme" ] && gsettings set org.gnome.desktop.interface icon-theme "$icon_theme" 2>/dev/null
        [ -n "$gtk_theme" ] && gsettings set org.gnome.desktop.interface gtk-theme "$gtk_theme" 2>/dev/null
        [ -n "$cursor_theme" ] && gsettings set org.gnome.desktop.interface cursor-theme "$cursor_theme" 2>/dev/null
        [ -n "$cursor_size" ] && gsettings set org.gnome.desktop.interface cursor-size "$cursor_size" 2>/dev/null
    }

    mkdir -p "$HOME/.config/gtk-3.0" "$HOME/.config/gtk-4.0"
    cp "$gtk_source" "$HOME/.config/gtk-3.0/settings.ini" 2>/dev/null
    cp "$gtk_source" "$HOME/.config/gtk-4.0/settings.ini" 2>/dev/null

    [ -n "$cursor_theme" ] && command -v hyprctl &>/dev/null && hyprctl setcursor "$cursor_theme" "${cursor_size:-24}" 2>/dev/null
}

updateConfigs() {
    echo "Switching to theme: $THEME"

    local hypr_source="$THEME_DIR/hyprland.conf"
    [ -n "$VARIANT" ] && {
        [ -f "$THEME_DIR/variants/$VARIANT/hyprland.conf" ] && hypr_source="$THEME_DIR/variants/$VARIANT/hyprland.conf"
        [ -f "$THEME_DIR/variants/$VARIANT/hypr/hyprland.conf" ] && hypr_source="$THEME_DIR/variants/$VARIANT/hypr/hyprland.conf"
    }

    if [ -f "$hypr_source" ]; then
        [ -L "$HOME/.config/hypr/hyprland.conf" ] && rm -f "$HOME/.config/hypr/hyprland.conf"
        cp -f "$hypr_source" "$HOME/.config/hypr/hyprland.conf"
    fi

    patchLastlayerConf
    patchVariantAppearance
    neutralizeWallpaperExecs
}

neutralizeWallpaperExecs() {
    local hypr_conf="$HOME/.config/hypr/hyprland.conf"
    local hypr_dir="$HOME/.config/hypr"
    local theme_hypr_dir="$THEME_DIR/hyprland"
    local sed_patterns='-e s/^\(\s*exec\(-once\)\?\s*=.*swww\s\+img\)/# LLAYER_NEUTRALIZED \1/ -e s/^\(\s*exec\(-once\)\?\s*=.*swaybg\)/# LLAYER_NEUTRALIZED \1/ -e s/^\(\s*exec\(-once\)\?\s*=.*hyprctl\s\+hyprpaper\)/# LLAYER_NEUTRALIZED \1/ -e s/^\(\s*exec\(-once\)\?\s*=.*swww-daemon\)/# LLAYER_NEUTRALIZED \1/ -e s/^\(\s*exec\(-once\)\?\s*=.*swww\s\+init\)/# LLAYER_NEUTRALIZED \1/ -e s/^\(\s*exec\(-once\)\?\s*=.*swww\s\+restore\)/# LLAYER_NEUTRALIZED \1/ -e s/^\(\s*exec\(-once\)\?\s*=.*hyprpaper\)/# LLAYER_NEUTRALIZED \1/'

    [ -d "$hypr_dir" ] && {
        find "$hypr_dir" -name '*.conf' -type f 2>/dev/null | while read -r conf; do
            sed -i $sed_patterns "$conf" 2>/dev/null || true
        done
    }

    [ -d "$theme_hypr_dir" ] && {
        find "$theme_hypr_dir" -name '*.conf' -type f 2>/dev/null | while read -r conf; do
            sed -i $sed_patterns "$conf" 2>/dev/null || true
        done
    }

    echo "Neutralized theme wallpaper exec lines for LastLayer control"
}

patchLastlayerConf() {
    local LASTLAYER_CONF="$THEME_DIR/hyprland/lastlayer.conf"
    local THEME_HYPR_CONF="$THEME_DIR/hyprland.conf"

    [ -d "$THEME_DIR/hyprland" ] && [ ! -f "$LASTLAYER_CONF" ] && cat > "$LASTLAYER_CONF" << 'LLEOF'
windowrulev2 = opacity 0.0,class:^(lastlayerhidden)$
windowrulev2 = nofocus,class:^(lastlayerhidden)$
windowrulev2 = float,class:^(lastlayerhidden)$
windowrulev2 = workspace special silent,class:^(lastlayerhidden)$
windowrulev2 = float, class:^(lastlayer_install)$
bind = SUPER, F12, exec, ~/.local/bin/lastlayer
LLEOF

    [ -f "$THEME_HYPR_CONF" ] && [ -f "$LASTLAYER_CONF" ] && ! grep -qF "lastlayer.conf" "$THEME_HYPR_CONF" && {
        local source_line='source=$HOME/.config/themes/'"$THEME"'/hyprland/lastlayer.conf'
        local last_src=$(grep -n "^source=" "$THEME_HYPR_CONF" | tail -1 | cut -d: -f1)
        [ -n "$last_src" ] && sed -i "${last_src}a\\${source_line}" "$THEME_HYPR_CONF" || sed -i "1i\\${source_line}" "$THEME_HYPR_CONF"
    }
}

patchVariantAppearance() {
    [ -z "$VARIANT" ] && return 0

    local variant_conf=""
    [ -f "$THEME_DIR/themes/$VARIANT/hyprland/general.conf" ] && variant_conf="$THEME_DIR/themes/$VARIANT/hyprland/general.conf"
    [ -f "$THEME_DIR/variants/$VARIANT/hyprland/general.conf" ] && variant_conf="$THEME_DIR/variants/$VARIANT/hyprland/general.conf"
    [ -z "$variant_conf" ] && return 0

    local HYPR_CONF="$HOME/.config/hypr/hyprland.conf"
    sed -i '/# LLAYER_VARIANT_CONFIG/d' "$HYPR_CONF" 2>/dev/null
    sed -i '/variants\/.*\/hyprland\/general\.conf/d' "$HYPR_CONF" 2>/dev/null

    echo "" >> "$HYPR_CONF"
    echo "source = $variant_conf" >> "$HYPR_CONF"

    local variant_alacritty="$THEME_DIR/themes/$VARIANT/alacritty"
    [ -d "$variant_alacritty" ] && {
        mkdir -p "$HOME/.config/alacritty"
        cp -f "$variant_alacritty"/* "$HOME/.config/alacritty/" 2>/dev/null
    }
}

detectWallpaperBackend() {
    local execs_conf="$THEME_DIR/hyprland/execs.conf"
    command -v swww &>/dev/null && command -v swww-daemon &>/dev/null && {
        echo "swww"
        return 0
    }

    local backend=""

    if [ -f "$execs_conf" ]; then
        if grep -qE '^\s*exec(-once)?\s*=.*swaybg' "$execs_conf" 2>/dev/null; then
            backend="swaybg"
        elif grep -qE '^\s*exec(-once)?\s*=.*hyprpaper' "$execs_conf" 2>/dev/null; then
            backend="hyprpaper"
        fi
    fi

    [ -n "$backend" ] && { echo "$backend"; return 0; }
    command -v hyprpaper &>/dev/null && { echo "hyprpaper"; return 0; }
    command -v swaybg &>/dev/null && { echo "swaybg"; return 0; }
    echo "swww"
}

inferImageExtensionFromMimeType() {
    local mime_type="$1"
    case "$mime_type" in
        image/png) echo "png" ;;
        image/jpeg|image/jpg) echo "jpg" ;;
        image/webp) echo "webp" ;;
        *) echo "" ;;
    esac
}

ensureWallpaperPathMatchesMimeType() {
    local wall_file="$1"

    command -v file &>/dev/null || { echo "$wall_file"; return 0; }

    local mime_type expected_ext
    mime_type=$(file --mime-type -b "$wall_file" 2>/dev/null || true)
    expected_ext=$(inferImageExtensionFromMimeType "$mime_type")
    [ -n "$expected_ext" ] || { echo "$wall_file"; return 0; }

    local ext="${wall_file##*.}"
    ext="${ext,,}"

    if [ "$expected_ext" = "jpg" ] && { [ "$ext" = "jpg" ] || [ "$ext" = "jpeg" ]; }; then
        echo "$wall_file"
        return 0
    fi

    [ "$ext" = "$expected_ext" ] && { echo "$wall_file"; return 0; }

    local slug="$THEME"
    [ -n "$VARIANT" ] && slug="${slug}_${VARIANT}"
    slug="${slug//[^a-zA-Z0-9._-]/_}"

    local cache_dir="$HOME/.cache/llayer-wallpapers"
    mkdir -p "$cache_dir" 2>/dev/null || { echo "$wall_file"; return 0; }

    local normalized="$cache_dir/${slug}.${expected_ext}"

    if [ -f "$normalized" ]; then
        local src_sig dst_sig
        src_sig=$(stat -c '%s:%Y' "$wall_file" 2>/dev/null || echo "")
        dst_sig=$(stat -c '%s:%Y' "$normalized" 2>/dev/null || echo "")
        [ -n "$src_sig" ] && [ "$src_sig" = "$dst_sig" ] && { echo "$normalized"; return 0; }
    fi

    if [ ! -L "$wall_file" ] && ln -f "$wall_file" "$normalized" 2>/dev/null; then
        echo "$normalized"
        return 0
    fi

    cp -f --preserve=timestamps "$wall_file" "$normalized" 2>/dev/null || { echo "$wall_file"; return 0; }
    echo "$normalized"
}

killConflictingWallpaperDaemons() {
    local keep="$1"
    local daemons="swww-daemon swaybg hyprpaper"

    for daemon in $daemons; do
        local base_name="${daemon%-daemon}"
        if [ "$base_name" != "$keep" ] && [ "$daemon" != "$keep" ]; then
            if pgrep -x "$daemon" &>/dev/null; then
                echo "Killing conflicting wallpaper daemon: $daemon"
                pkill -9 -x "$daemon" 2>/dev/null || true
            fi
        fi
    done
}

ensureSwwwRunning() {
    if ! pgrep -x swww-daemon &>/dev/null; then
        echo "swww-daemon not running, starting it..."
        restartSwwwDaemon
    fi
}

restartSwwwDaemon() {
    pkill -9 -x swww-daemon 2>/dev/null || true
    pkill -9 -f "swww-daemon" 2>/dev/null || true
    sleep "$PROCESS_CLEANUP_DELAY"
    rm -f "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/wayland-1-swww-daemon"*.sock 2>/dev/null
    rm -f "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/swww"*.socket 2>/dev/null
    rm -f "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/swww-"*.socket 2>/dev/null
    rm -f "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/swww"*.sock 2>/dev/null
    RUST_MIN_STACK=8388608 swww-daemon --format xrgb &
    local max_checks=$(awk -v timeout="$DAEMON_START_TIMEOUT" -v interval="$DAEMON_POLL_INTERVAL" 'BEGIN {
        t = timeout + 0
        i = interval + 0
        if (i <= 0) i = 0.1
        c = int((t / i) + 0.999999)
        if (c < 10) c = 10
        print c
    }' 2>/dev/null || echo 10)
    for _ in $(seq 1 $max_checks); do
        pgrep -x swww-daemon &>/dev/null && break
        sleep "$DAEMON_POLL_INTERVAL"
    done
}

setSwwwWallpaper() {
    local wall_file="$1"
    local max_attempts=3
    local attempt=1

    while [ "$attempt" -le "$max_attempts" ]; do
        ensureSwwwRunning
        echo "swww animation: type=$ANIMATION_TYPE, fps=$ANIMATION_FPS, duration=$TRANSITION_DURATION, angle=$ANIMATION_ANGLE"

        if swww img \
            --transition-type "$ANIMATION_TYPE" \
            --transition-fps "$ANIMATION_FPS" \
            --transition-duration "$TRANSITION_DURATION" \
            --transition-angle "$ANIMATION_ANGLE" \
            "$wall_file"; then
            return 0
        fi

        if [ "$attempt" -lt "$max_attempts" ]; then
            echo "swww failed to set wallpaper (attempt $attempt/$max_attempts), restarting daemon..."
            restartSwwwDaemon
            sleep "$WALLPAPER_RETRY_DELAY"
        fi

        attempt=$((attempt + 1))
    done

    return 1
}

ensureSwaybgRunning() {
    local wall_file="$1"
    pkill -x swaybg 2>/dev/null || true
    sleep "$DAEMON_START_TIMEOUT"
    swaybg -o \* -i "$wall_file" -m fill &
    disown
}

ensureHyprpaperRunning() {
    if ! pgrep -x hyprpaper &>/dev/null; then
        echo "hyprpaper not running, starting it..."
        rm -f "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/hyprpaper.lock" 2>/dev/null
        hyprpaper &
        local max_checks=$(awk -v timeout="$DAEMON_START_TIMEOUT" -v interval="$DAEMON_POLL_INTERVAL" 'BEGIN {
            t = timeout + 0
            i = interval + 0
            if (i <= 0) i = 0.1
            c = int((t / i) + 0.999999)
            if (c < 10) c = 10
            print c
        }' 2>/dev/null || echo 10)
        for _ in $(seq 1 $max_checks); do
            pgrep -x hyprpaper &>/dev/null && break
            sleep "$DAEMON_POLL_INTERVAL"
        done
    fi
}

setHyprpaperWallpaper() {
    local wall_file="$1"

    local ok=0

    for _ in 1 2; do
        hyprctl hyprpaper preload "$wall_file" 2>/dev/null && { ok=1; break; }
        echo "Failed to preload wallpaper, retrying..."
        sleep "$WALLPAPER_RETRY_DELAY"
    done

    [ "$ok" -eq 1 ] || { echo "Failed to preload wallpaper"; return 1; }

    ok=0
    for _ in 1 2; do
        hyprctl hyprpaper wallpaper ",$wall_file" 2>/dev/null && { ok=1; break; }
        echo "Failed to set wallpaper, retrying..."
        sleep "$WALLPAPER_RETRY_DELAY"
    done

    [ "$ok" -eq 1 ] || { echo "Failed to set wallpaper"; return 1; }

    (sleep "$WALLPAPER_RETRY_DELAY" && hyprctl hyprpaper unload unused 2>/dev/null) &
    return 0
}

changeWallpaper() {
    local wall_file=""

    if [ -n "$1" ]; then
        wall_file="$1"
    else
        local search_dirs="$THEME_DIR"
        [ -n "$VARIANT" ] && search_dirs="$THEME_DIR/variants/$VARIANT $THEME_DIR/themes/$VARIANT $THEME_DIR"

        for dir in $search_dirs; do
            for ext in png jpg jpeg webp; do
                [ -f "$dir/wallpaper.$ext" ] && { wall_file="$dir/wallpaper.$ext"; break 2; }
            done
        done

        [ -z "$wall_file" ] && {
            for dir in $search_dirs; do
                for sub in Wallpaper wallpaper Wallpapers wallpapers; do
                    [ -d "$dir/$sub" ] && {
                        wall_file=$(find "$dir/$sub" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -printf '%s\t%p\n' 2>/dev/null | sort -nr | head -n1 | cut -f2-)
                        [ -n "$wall_file" ] && break 2
                    }
                done
            done
        }
    fi

    [ -f "$wall_file" ] || { echo "Wallpaper not found"; return 1; }

    echo "Changing wallpaper: $wall_file"

    local backend=$(detectWallpaperBackend)
    echo "Detected wallpaper backend: $backend"

    if [ "$backend" = "hyprpaper" ]; then
        local normalized_wall_file
        normalized_wall_file=$(ensureWallpaperPathMatchesMimeType "$wall_file")
        if [ "$normalized_wall_file" != "$wall_file" ]; then
            echo "Wallpaper file extension mismatch; using: $normalized_wall_file"
            wall_file="$normalized_wall_file"
        fi
    fi

    killConflictingWallpaperDaemons "$backend"

    case "$backend" in
        swww)
            if setSwwwWallpaper "$wall_file"; then
                echo "Wallpaper set with swww"
            else
                echo "Failed to change wallpaper with swww"
            fi
            ;;
        swaybg)
            ensureSwaybgRunning "$wall_file"
            echo "Wallpaper set with swaybg"
            ;;
        hyprpaper)
            ensureHyprpaperRunning
            if setHyprpaperWallpaper "$wall_file"; then
                echo "Wallpaper set with hyprpaper"
            else
                echo "Failed to change wallpaper with hyprpaper"
            fi
            ;;
        *)
            if setSwwwWallpaper "$wall_file"; then
                echo "Wallpaper set with swww"
            else
                echo "Failed to change wallpaper"
            fi
            ;;
    esac
}

applyHyprlandOverrides() {
    local OVERRIDES_FILE="$THEME_DIR/.effective_hyprland.json"

    [ ! -f "$OVERRIDES_FILE" ] && {
        echo "No effective overrides file found, skipping parameter overrides"
        return 0
    }

    echo "Applying Hyprland parameter overrides..."

    local params
    params=$(jq -r '.parameters // {} | to_entries[] | select(.value.source != "original") | [.key, (.value.value | tostring)] | @tsv' "$OVERRIDES_FILE" 2>/dev/null)

    [ -z "$params" ] && {
        echo "No parameter overrides to apply"
        return 0
    }

    local count=0
    while IFS=$'\t' read -r param_path param_value; do
        if [ -n "$param_path" ] && [ -n "$param_value" ]; then
            echo "  Setting $param_path = $param_value"
            hyprctl keyword "$param_path" "$param_value" 2>/dev/null || true
            ((count++)) || true
        fi
    done <<< "$params"

    echo "Applied $count parameter override(s)"
}

applyHotkeyOverrides() {
    local HOTKEY_OVERRIDES_FILE="$THEME_DIR/.effective_hotkeys.json"

    [ ! -f "$HOTKEY_OVERRIDES_FILE" ] && {
        echo "No effective hotkey overrides file found, skipping hotkey overrides"
        return 0
    }

    echo "Applying Hyprland hotkey overrides..."
    local count=0

    local deletes
    deletes=$(jq -r '.hotkeys // {} | to_entries[] | select(.value.source != "original") | select(.value.action == "delete") | .value.metadata | [((.modifiers // []) | join(" ")), (.key // "")] | @tsv' "$HOTKEY_OVERRIDES_FILE" 2>/dev/null)

    while IFS=$'\t' read -r mods key; do
        if [ -n "$key" ]; then
            echo "  Unbinding $mods + $key (deleted)"
            hyprctl keyword unbind "$mods, $key" 2>/dev/null || true
            ((count++)) || true
        fi
    done <<< "$deletes"

    local replaces
    replaces=$(jq -r '.hotkeys // {} | to_entries[] | select(.value.source != "original") | select(.value.action == "replace") | [(.value.metadata.modifiers // [] | join(" ")), (.value.metadata.key // ""), (.value.dispatcher // ""), (.value.args // "")] | @tsv' "$HOTKEY_OVERRIDES_FILE" 2>/dev/null)

    while IFS=$'\t' read -r mods key dispatcher args; do
        if [ -n "$key" ] && [ -n "$dispatcher" ]; then
            echo "  Replacing $mods + $key -> $dispatcher $args"
            hyprctl keyword unbind "$mods, $key" 2>/dev/null || true
            hyprctl keyword bind "$mods, $key, $dispatcher, $args" 2>/dev/null || true
            ((count++)) || true
        fi
    done <<< "$replaces"

    local adds
    adds=$(jq -r '.hotkeys // {} | to_entries[] | select(.value.source != "original") | select(.value.action == "add") | [(.value.metadata.modifiers // [] | join(" ")), (.value.metadata.key // ""), (.value.dispatcher // ""), (.value.args // ""), (.value.metadata.bindType // "bind")] | @tsv' "$HOTKEY_OVERRIDES_FILE" 2>/dev/null)

    while IFS=$'\t' read -r mods key dispatcher args bindType; do
        if [ -n "$key" ] && [ -n "$dispatcher" ]; then
            echo "  Adding $mods + $key -> $dispatcher $args"
            hyprctl keyword "$bindType" "$mods, $key, $dispatcher, $args" 2>/dev/null || true
            ((count++)) || true
        fi
    done <<< "$adds"

    echo "Applied $count hotkey override(s)"
}

detectExpectedBar() {
    local bars_found=""
    local search_files="$THEME_DIR/hyprland.conf $THEME_DIR/hyprland/hyprland.conf $THEME_DIR/hyprland/execs.conf"

    [ -d "$THEME_DIR/hyprland" ] && search_files="$search_files $THEME_DIR/hyprland/*.conf"
    [ -n "$VARIANT" ] && search_files="$search_files $THEME_DIR/variants/$VARIANT/hyprland.conf $THEME_DIR/variants/$VARIANT/hypr/hyprland.conf $THEME_DIR/variants/$VARIANT/hyprland/*.conf"
    local exec_lines
    exec_lines=$(grep -hE "^[[:space:]]*(exec-once|exec)[[:space:]]*=" $search_files 2>/dev/null || true)
    exec_lines=$(printf '%s\n' "$exec_lines" | grep -vE "^[[:space:]]*(exec-once|exec)[[:space:]]*=[[:space:]]*(pkill|killall|kill)\\b" || true)

    local extra_lines=""
    while IFS= read -r line; do
        local candidates
        candidates=$(printf '%s\n' "$line" | grep -oE '((~|\$HOME|/)[^ ;|&"]*autostart[^ ;|&"]*)' 2>/dev/null || true)
        [ -z "$candidates" ] && continue
        while IFS= read -r candidate; do
            [ -z "$candidate" ] && continue
            local resolved="$candidate"
            resolved="${resolved/#\~/$HOME}"
            resolved="${resolved//\$HOME/$HOME}"
            [ -f "$resolved" ] || continue
            extra_lines="${extra_lines}"$'\n'"$(grep -hEv '^[[:space:]]*(#|$)' "$resolved" 2>/dev/null || true)"
        done <<< "$candidates"
    done <<< "$exec_lines"

    [ -n "$extra_lines" ] && exec_lines=$(printf '%s\n%s\n' "$exec_lines" "$extra_lines")

    for bar in {{BAR_LIST}}; do
        if printf '%s\n' "$exec_lines" | grep -qiE "(^|[^[:alnum:]_-])$bar([^[:alnum:]_-]|$)"; then
            if ! echo "$bars_found" | grep -qE "(^|,)$bar(,|$)"; then
                [ -n "$bars_found" ] && bars_found="$bars_found,"
                bars_found="$bars_found$bar"
            fi
        fi
    done

    echo "$bars_found"
}

getRiceBarCommand() {
    local bar="$1"

    case "$bar" in
        waybar)
            local config_dir=""
            for dir in "$THEME_DIR/waybar" "$THEME_DIR/config/waybar" "$THEME_DIR/base/waybar"; do
                [ -d "$dir" ] && { config_dir="$dir"; break; }
            done

            if [ -n "$config_dir" ]; then
                local config_file=""
                for f in "$config_dir/config" "$config_dir/config-hypr" "$config_dir/config.jsonc" "$config_dir/config.json"; do
                    [ -f "$f" ] && { config_file="$f"; break; }
                done

                local style_file=""
                [ -f "$config_dir/style.css" ] && style_file="$config_dir/style.css"

                if [ -n "$config_file" ] && [ -n "$style_file" ]; then
                    echo "waybar -c $config_file -s $style_file"
                elif [ -n "$config_file" ]; then
                    echo "waybar -c $config_file"
                else
                    echo "waybar"
                fi
            else
                echo "waybar"
            fi
            ;;
        eww)
            [ -d "$THEME_DIR/eww" ] && echo "eww daemon -c $THEME_DIR/eww && eww open bar -c $THEME_DIR/eww" || echo "eww daemon && eww open bar"
            ;;
        ags)
            [ -d "$THEME_DIR/ags" ] && echo "ags -c $THEME_DIR/ags/config.js" || echo "ags"
            ;;
        hyprpanel)
            local rice_bin="$HOME/.local/share/lastlayer/programs/rices/$THEME/bin/hyprpanel"
            [ -x "$rice_bin" ] && echo "setsid $rice_bin" || echo "hyprpanel"
            ;;
        nwg-dock-hyprland)
            local dock_cmd="nwg-dock-hyprland -p bottom -l overlay -x -mb 6"
            local launcher="$THEME_DIR/config/rofi/launchers/type-3/grid/grid-launcher.sh"
            [ -x "$launcher" ] && dock_cmd="$dock_cmd -c $launcher"
            echo "env -u XDG_CONFIG_HOME -u GDK_BACKEND $dock_cmd"
            ;;
        *)
            echo "$bar"
            ;;
    esac
}

prestartConfiguredBars() {
    [ -f "$THEME_DIR/lastlayer-metadata.json" ] || return 0
    command -v jq &>/dev/null || return 0

    mapfile -t bars < <(jq -r '.apply.prestartBars[]? // empty' "$THEME_DIR/lastlayer-metadata.json" 2>/dev/null)
    [ "${#bars[@]}" -eq 0 ] && return 0

    for bar in "${bars[@]}"; do
        [ -z "$bar" ] && continue
        isBarRunning "$bar" && continue

        local cmd=$(getBarStartCmd "$bar")
        [ -n "$cmd" ] && {
            command -v hyprctl &>/dev/null && hyprctl dispatch exec "$cmd" 2>/dev/null || setsid bash -c "$cmd" &>/dev/null &
        }
    done
}

resolveThemeScriptPath() {
    local base_dir="$1"
    shift

    for relative_path in "$@"; do
        [ -n "$relative_path" ] || continue
        local candidate="$base_dir/$relative_path"
        [ -f "$candidate" ] && { echo "$candidate"; return 0; }
    done

    return 1
}

resolveInstallScriptPath() {
    local base_dir="$1"
    local resolved=""
    resolved=$(resolveThemeScriptPath "$base_dir" \
        "start-scripts/installThemeApps.sh" \
        "start-scripts/install_theme_apps.sh" \
        "scripts/installThemeApps.sh" \
        "scripts/install_theme_apps.sh")
    [ -n "$resolved" ] && { echo "$resolved"; return 0; }
    echo "$base_dir/start-scripts/installThemeApps.sh"
    return 1
}

resolvePostInstallScriptPath() {
    local base_dir="$1"
    local resolved=""
    resolved=$(resolveThemeScriptPath "$base_dir" \
        "start-scripts/setAfterInstallActions.sh" \
        "start-scripts/set_after_install_actions.sh" \
        "scripts/setAfterInstallActions.sh" \
        "scripts/set_after_install_actions.sh")
    [ -n "$resolved" ] && { echo "$resolved"; return 0; }
    echo "$base_dir/start-scripts/setAfterInstallActions.sh"
    return 1
}

installThemeApps() {
    manageBars record

    local variant_dir="$THEME_DIR"
    [ -n "$VARIANT" ] && [ -d "$THEME_DIR/variants/$VARIANT" ] && variant_dir="$THEME_DIR/variants/$VARIANT"
    local install_script="${PATCHED_INSTALL_SCRIPT:-$(resolveInstallScriptPath "$variant_dir")}"

    [ ! -f "$install_script" ] && { echo "Install script not found: $install_script"; return 1; }

    echo "Running install script: $install_script"

    local xterm_class="lastlayer_install"
    local script_has_xterm=false
    grep -q "xterm " "$install_script" && script_has_xterm=true

    setupXtermRules "$xterm_class"

    local xterm_args=$(buildXtermArgs "$xterm_class")

    if [ "$script_has_xterm" = "true" ]; then
        local temp_script
        temp_script=$(mktemp --suffix=_install.sh)
        sed "s|xterm |xterm $xterm_args |g" "$install_script" > "$temp_script"
        chmod +x "$temp_script"

        bash "$temp_script" || true

        local max_wait=50 waited=0
        while ! hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; do
            sleep "$TERMINAL_POLL_INTERVAL"
            ((waited++)) || true
            [ $waited -ge $max_wait ] && break
        done

        if hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; then
            sleep "$TERMINAL_POLL_INTERVAL"
            positionXtermWindow "$xterm_class"
            while hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; do
                sleep "$BAR_CHECK_INTERVAL"
            done
        fi

        rm -f "$temp_script"
    elif [ "$SHOW_INSTALL_TERMINAL" = "true" ]; then
        local wrapper_script
        wrapper_script=$(mktemp --suffix=_wrap.sh)
        cat > "$wrapper_script" << WRAPEOF
bash "$install_script"
WRAPEOF
        [ "$AUTO_CLOSE_INSTALL_TERMINAL" != "true" ] && echo 'echo ""; echo "Press Enter to close..."; read -r' >> "$wrapper_script"
        chmod +x "$wrapper_script"

        eval "xterm $xterm_args -title 'Installing $THEME Apps' -e '$wrapper_script'" &
        local xterm_pid=$!

        local max_wait=50 waited=0
        while ! hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; do
            sleep "$TERMINAL_POLL_INTERVAL"
            ((waited++)) || true
            [ $waited -ge $max_wait ] && break
        done

        sleep "$TERMINAL_POLL_INTERVAL"
        positionXtermWindow "$xterm_class"

        wait $xterm_pid 2>/dev/null || true
        rm -f "$wrapper_script"
    else
        echo "Running install script silently (SHOW_INSTALL_TERMINAL=false)"
        bash "$install_script" || true
    fi
}

setAfterInstallActions() {
    local variant_dir="$THEME_DIR"
    [ -n "$VARIANT" ] && [ -d "$THEME_DIR/variants/$VARIANT" ] && variant_dir="$THEME_DIR/variants/$VARIANT"
    local script="${PATCHED_POSTINSTALL_SCRIPT:-$(resolvePostInstallScriptPath "$variant_dir")}"

    [ "$SKIP_INSTALL_SCRIPT" = "1" ] && [ ! -f "$script" ] && {
        local i=0; while [ ! -f "$script" ] && [ $i -lt 40 ]; do sleep "$SCRIPT_FILE_WAIT_INTERVAL"; i=$((i+1)); done
    }

    [ ! -f "$script" ] && { echo "Post-install script not found: $script"; return 1; }

    echo "Running post-install script: $script"

    local xterm_class="lastlayer_install"
    local script_has_xterm=false
    grep -q "xterm " "$script" && script_has_xterm=true

    setupXtermRules "$xterm_class"

    local xterm_args=$(buildXtermArgs "$xterm_class")

    if [ "$script_has_xterm" = "true" ]; then
        local temp_script
        temp_script=$(mktemp --suffix=_postinstall.sh)
        sed "s|xterm |xterm $xterm_args |g" "$script" > "$temp_script"
        chmod +x "$temp_script"

        bash "$temp_script" || true

        local max_wait=50 waited=0
        while ! hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; do
            sleep "$TERMINAL_POLL_INTERVAL"
            ((waited++)) || true
            [ $waited -ge $max_wait ] && break
        done

        if hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; then
            sleep "$TERMINAL_POLL_INTERVAL"
            positionXtermWindow "$xterm_class"
            while hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; do
                sleep "$BAR_CHECK_INTERVAL"
            done
        fi

        rm -f "$temp_script"
    elif [ "$SHOW_AFTER_INSTALL_TERMINAL" = "true" ]; then
        local wrapper_script
        wrapper_script=$(mktemp --suffix=_wrap.sh)
        cat > "$wrapper_script" << WRAPEOF
bash "$script"
WRAPEOF
        [ "$AUTO_CLOSE_AFTER_INSTALL_TERMINAL" != "true" ] && echo 'echo ""; echo "Press Enter to close..."; read -r' >> "$wrapper_script"
        chmod +x "$wrapper_script"

        eval "xterm $xterm_args -title 'Post-install $THEME' -e '$wrapper_script'" &
        local xterm_pid=$!

        local max_wait=50 waited=0
        while ! hyprctl clients -j 2>/dev/null | jq -e ".[] | select(.class == \"$xterm_class\")" &>/dev/null; do
            sleep "$TERMINAL_POLL_INTERVAL"
            ((waited++)) || true
            [ $waited -ge $max_wait ] && break
        done

        sleep "$TERMINAL_POLL_INTERVAL"
        positionXtermWindow "$xterm_class"

        wait $xterm_pid 2>/dev/null || true
        rm -f "$wrapper_script"
    else
        echo "Running post-install script silently (SHOW_AFTER_INSTALL_TERMINAL=false)"
        bash "$script" || true
    fi
}

altBarCheck() {
    alt=$(jq -r '.alt_bar // "none"' "$SETTINGS_JSON" 2>/dev/null)
    global_timeout=$(jq -r '.alt_timeout // 1.5' "$SETTINGS_JSON" 2>/dev/null)
    [ -z "$alt" ] && alt="none"
    [ -z "$global_timeout" ] && global_timeout="1.5"

    expected_bars=$(detectExpectedBar)
    echo "Expected bars from rice config: ${expected_bars:-none detected}"

    [ -z "$expected_bars" ] && [ -z "$alt" -o "$alt" = "none" ] && return

    local max_checks=$(awk -v timeout="$global_timeout" -v interval="$BAR_CHECK_INTERVAL" 'BEGIN {
        t = timeout + 0
        i = interval + 0
        if (i <= 0) i = 0.1
        c = int((t / i) + 0.999999)
        if (c < 1) c = 1
        print c
    }' 2>/dev/null || echo 1)
    local checks=0
    echo "Checking for theme bar (max ${global_timeout}s)..."
    while [ $checks -lt $max_checks ]; do
        for bar in $(echo "$expected_bars" | tr ',' ' '); do
            [ -z "$bar" ] && continue
            isBarRunning "$bar" && { echo "Bar $bar detected early"; checks=$max_checks; break; }
        done
        [ $checks -ge $max_checks ] && break
        sleep "$BAR_CHECK_INTERVAL"
        ((checks++)) || true
    done

    local running_bars=""
    local any_running=false
    for bar in {{BAR_LIST}}; do
        isBarRunning "$bar" || continue
        [ -n "$running_bars" ] && running_bars="$running_bars,"
        running_bars="$running_bars$bar"
        any_running=true
    done

    if [ "$any_running" = "true" ]; then
        echo "Running bars: $running_bars"

        if [ -n "$expected_bars" ]; then
            local missing_bars=""
            IFS=',' read -ra BARS_ARRAY <<< "$expected_bars"
            for bar in "${BARS_ARRAY[@]}"; do
                bar=$(echo "$bar" | tr -d ' ')
                [ -z "$bar" ] && continue
                isBarRunning "$bar" || missing_bars="${missing_bars}${missing_bars:+,}$bar"
            done

            if [ -n "$missing_bars" ]; then
                echo "Starting missing expected bars: $missing_bars"
                IFS=',' read -ra BARS_ARRAY <<< "$missing_bars"
                for bar in "${BARS_ARRAY[@]}"; do
                    bar=$(echo "$bar" | tr -d ' ')
                    [ -z "$bar" ] && continue
                    local start_cmd=$(getRiceBarCommand "$bar")
                    [ -n "$start_cmd" ] && {
                        echo "  Starting: $start_cmd"
                        bash -c "$start_cmd" &>/dev/null &
                        disown 2>/dev/null || true
                    }
                done
            fi
        fi

        echo ",$expected_bars," | grep -q ",eww," && command -v eww &>/dev/null && {
            eww close bar &>/dev/null || true
            sleep "$WINDOW_OPERATION_DELAY"
            eww open bar &>/dev/null || true
        }
        return
    fi

    if [ -n "$expected_bars" ]; then
        echo "No bars running, attempting to start expected bars..."
        IFS=',' read -ra BARS_ARRAY <<< "$expected_bars"
        for bar in "${BARS_ARRAY[@]}"; do
            bar=$(echo "$bar" | tr -d ' ')
            [ -z "$bar" ] && continue

            local start_cmd=$(getRiceBarCommand "$bar")
            [ -z "$start_cmd" ] && continue

            echo "  Trying: $start_cmd"
            bash -c "$start_cmd" &>/dev/null &
            disown 2>/dev/null || true

            local started="false"
            for _ in 1 2 3 4 5; do
                isBarRunning "$bar" && { started="true"; break; }
                sleep "$BAR_CHECK_INTERVAL"
            done

            [ "$started" = "true" ] && {
                echo "  Started: $bar"
                echo ",$expected_bars," | grep -q ",eww," && command -v eww &>/dev/null && {
                    eww close bar &>/dev/null || true
                    sleep "$WINDOW_OPERATION_DELAY"
                    eww open bar &>/dev/null || true
                }
                return
            }
        done
    fi

    if [ -n "$alt" ] && [ "$alt" != "none" ]; then
        echo "Falling back to alt bar: $alt"
        nohup "$alt" &>/dev/null & disown
    fi
}

updateActiveVariant() {
    [ -z "$VARIANT" ] && return 0
    local meta="$THEME_DIR/lastlayer-metadata.json"
    [ -f "$meta" ] && command -v jq &>/dev/null && {
        jq --arg v "$VARIANT" '.activeVariant = $v' "$meta" > "$meta.tmp" && mv "$meta.tmp" "$meta"
    }
}

reapplyOverrides() {
    command -v hyprctl &>/dev/null || return 0

    [ -n "$VARIANT" ] && patchVariantAppearance

    if [ -n "$VARIANT" ]; then
        hyprctl reload 2>/dev/null || true
        sleep "$POST_RELOAD_DELAY"
    fi

    applyHyprlandOverrides
    applyHotkeyOverrides

    [ "$WALLPAPER_ALREADY_APPLIED" = "1" ] || changeWallpaper
}

[ -z "$THEME" ] && { echo "Usage: switch_theme.sh <theme-name>"; exit 1; }

CURRENT_THEME=$(jq -r '.theme // "default"' "$SETTINGS_JSON" 2>/dev/null)

[ "$THEME" != "default" ] && [ "$CURRENT_THEME" != "default" ] && [ "$INTERMEDIATE_DEFAULT" = "1" ] && {
    [ -d "$HOME/.config/themes/default" ] && cp -r "$HOME/.config/themes/default/"* "$HOME/.config/"
}

if [ "$THEME" = "default" ]; then
    manageBars record
    echo "Restoring default configuration"

    for item in "$HOME/.config/themes/default/"*; do
        [ ! -e "$item" ] && continue
        item_name=$(basename "$item")
        [ "$item_name" = "configs" ] && continue
        cp -r "$item" "$HOME/.config/" 2>/dev/null
    done

    CONFIGS_DIR="$HOME/.config/themes/default/configs"
    if [ -d "$CONFIGS_DIR" ]; then
        echo "Restoring configs from: $CONFIGS_DIR"
        for app_dir in "$CONFIGS_DIR/"*/; do
            [ "$app_dir" = "$CONFIGS_DIR/*/" ] && continue
            [ ! -d "$app_dir" ] && continue

            app_name=$(basename "$app_dir")
            echo "  - Restoring $app_name configs"
            mkdir -p "$HOME/.config/$app_name"
            rm -rf "$HOME/.config/$app_name"/* 2>/dev/null
            cp -r "$app_dir"* "$HOME/.config/$app_name/" 2>/dev/null || echo "    Warning: failed to copy $app_name"
        done
        echo "Configs restore completed"
    else
        echo "Warning: configs directory not found at $CONFIGS_DIR"
    fi

    updateConfigs
    sed -i 's|\.config/themes/[^/]*/|.config/themes/default/|g' "$HOME/.config/hypr/hyprland.conf" 2>/dev/null || true
    pkill -9 -x swww-daemon 2>/dev/null || true
    pkill -9 -x hyprpaper 2>/dev/null || true
    pkill -9 -x swaybg 2>/dev/null || true
    sleep "$PROCESS_CLEANUP_DELAY"
    hyprctl reload 2>/dev/null || true
    _reload_wait=0
    while [ "$_reload_wait" -lt 10 ]; do
        hyprctl version &>/dev/null && break
        sleep 0.1
        _reload_wait=$((_reload_wait + 1))
    done

    applyHyprlandOverrides
    applyHotkeyOverrides

    WP_SOURCE="$HOME/.config/themes/default/default_wallpapers/wallpaper_source.txt"
    if [ -f "$WP_SOURCE" ]; then
        wall_path=$(cat "$WP_SOURCE")
        if [ -n "$wall_path" ]; then
            wall_file="$HOME/.config/themes/default/default_wallpapers/$(basename "$wall_path")"
            if [ -f "$wall_file" ]; then
                echo "Restoring wallpaper: $wall_file"
                changeWallpaper "$wall_file"
            else
                echo "Wallpaper file not found: $wall_file"
            fi
        fi
    fi

    setAfterInstallActions
    sync
    manageBars restore
    mkdir -p "$PREF_DIR"
    echo "$THEME" > "$PREF_DIR/current_theme"
    exit 0
fi

manageBars record
checkThemeDir
syncThemeConfigs
prestartConfiguredBars
syncGtkSettings
updateConfigs
if changeWallpaper; then
    WALLPAPER_ALREADY_APPLIED=1
fi
applyHyprlandOverrides
applyHotkeyOverrides
theme_in_skip=false
[ -f "$SETTINGS_JSON" ] && jq -e --arg theme "$THEME" '.skip_install_theme_apps | index($theme)' "$SETTINGS_JSON" >/dev/null && theme_in_skip=true
[ "$SKIP_INSTALL_SCRIPT" = "1" ] && theme_in_skip=true

if [ "$theme_in_skip" = "true" ]; then
    echo "Theme $THEME skip install, running only post-install"
    setAfterInstallActions

    [ -f "$SETTINGS_JSON" ] && {
        jq --arg theme "$THEME" '.theme = $theme' "$SETTINGS_JSON" > "$SETTINGS_JSON.tmp" && mv "$SETTINGS_JSON.tmp" "$SETTINGS_JSON"
    }

    updateActiveVariant
    mkdir -p "$PREF_DIR"
    echo "$THEME" > "$PREF_DIR/current_theme"

    hyprctl reload
    sleep "$POST_RELOAD_DELAY"
    reapplyOverrides

    pkill -9 wal 2>/dev/null || true
    altBarCheck

    echo "Theme $THEME applied successfully"
    [ -n "$VARIANT" ] && echo "Active variant: $VARIANT"

    COMPLETE_TS=$(date -Iseconds)
    echo "[$COMPLETE_TS] [APPLY     ] Theme apply completed successfully: $THEME" >> "$DEBUG_LOG"
else
    echo "Theme $THEME not in skip list, running installation"
    installThemeApps
    setAfterInstallActions

    pkill -9 wal 2>/dev/null || true
    pkill -9 pywal 2>/dev/null || true
    sleep "$POST_INSTALL_DELAY"

    hyprctl reload
    sleep "$POST_RELOAD_DELAY"
    reapplyOverrides

    pkill -9 wal 2>/dev/null || true
    altBarCheck

    [ -f "$SETTINGS_JSON" ] && {
        jq --arg theme "$THEME" '.theme = $theme' "$SETTINGS_JSON" > "$SETTINGS_JSON.tmp" && mv "$SETTINGS_JSON.tmp" "$SETTINGS_JSON"
    }

    updateActiveVariant
    mkdir -p "$PREF_DIR"
    echo "$THEME" > "$PREF_DIR/current_theme"

    echo "Theme $THEME installed and applied successfully"
    [ -n "$VARIANT" ] && echo "Active variant: $VARIANT"

    COMPLETE_TS=$(date -Iseconds)
    echo "[$COMPLETE_TS] [INSTALL   ] Theme install completed successfully: $THEME" >> "$DEBUG_LOG"
fi
} >> ~/.cache/switch_theme.log 2>&1

exit 0
