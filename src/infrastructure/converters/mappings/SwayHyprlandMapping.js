

export const PARAMETER_MAP = {
    'default_orientation': {
        hyprland: null,
        note: 'Layout handled by general:layout setting'
    },
    'workspace_layout': {
        hyprland: 'general:layout',
        valueMap: {
            'default': 'dwindle',
            'stacking': 'dwindle',
            'tabbed': 'dwindle'
        },
        note: 'Hyprland uses dwindle/master layouts'
    },
    'xwayland': {
        hyprland: 'xwayland:enabled',
        valueMap: {
            'enable': true,
            'disable': false,
            'force': true
        }
    },

    'gaps inner': {
        hyprland: 'general:gaps_in',
        type: 'int'
    },
    'gaps outer': {
        hyprland: 'general:gaps_out',
        type: 'int'
    },
    'gaps horizontal': {
        hyprland: 'general:gaps_out',
        note: 'Hyprland uses single gaps_out value'
    },
    'gaps vertical': {
        hyprland: 'general:gaps_out',
        note: 'Hyprland uses single gaps_out value'
    },
    'gaps top': {
        hyprland: 'general:gaps_out',
        note: 'Hyprland does not support per-side gaps'
    },
    'gaps bottom': {
        hyprland: 'general:gaps_out',
        note: 'Hyprland does not support per-side gaps'
    },
    'gaps left': {
        hyprland: 'general:gaps_out',
        note: 'Hyprland does not support per-side gaps'
    },
    'gaps right': {
        hyprland: 'general:gaps_out',
        note: 'Hyprland does not support per-side gaps'
    },
    'smart_gaps': {
        hyprland: null,
        note: 'Can be achieved with windowrules'
    },
    'smart_borders': {
        hyprland: 'general:no_border_on_floating',
        note: 'Partial equivalent'
    },

    'default_border': {
        hyprland: 'general:border_size',
        extract: (value) => {
            const match = value.match(/(?:pixel|normal)\s+(\d+)/);
            return match ? parseInt(match[1]) : 2;
        }
    },
    'default_floating_border': {
        hyprland: null,
        note: 'Hyprland uses same border for all windows'
    },
    'hide_edge_borders': {
        hyprland: null,
        note: 'No direct equivalent in Hyprland'
    },
    'titlebar_border_thickness': {
        hyprland: null,
        note: 'Hyprland does not have titlebars by default'
    },
    'titlebar_padding': {
        hyprland: null,
        note: 'Hyprland does not have titlebars by default'
    },

    'client.focused': {
        hyprland: 'general:col.active_border',
        extract: (value) => {
            const colors = value.trim().split(/\s+/);
            return colors[4] || colors[0] || '#33ccff';
        },
        format: 'gradient'
    },
    'client.focused_inactive': {
        hyprland: 'general:col.inactive_border',
        extract: (value) => {
            const colors = value.trim().split(/\s+/);
            return colors[4] || colors[0] || '#595959';
        }
    },
    'client.unfocused': {
        hyprland: 'general:col.inactive_border',
        extract: (value) => {
            const colors = value.trim().split(/\s+/);
            return colors[4] || colors[0] || '#595959';
        }
    },
    'client.urgent': {
        hyprland: null,
        note: 'Use windowrulev2 for urgent windows'
    },

    'focus_follows_mouse': {
        hyprland: 'input:follow_mouse',
        valueMap: {
            'yes': 1,
            'no': 0,
            'always': 2
        }
    },
    'focus_wrapping': {
        hyprland: null,
        note: 'No direct equivalent in Hyprland'
    },
    'focus_on_window_activation': {
        hyprland: 'misc:focus_on_activate',
        valueMap: {
            'smart': false,
            'urgent': false,
            'focus': true,
            'none': false
        }
    },
    'mouse_warping': {
        hyprland: null,
        note: 'Hyprland handles mouse differently'
    },
    'tiling_drag': {
        hyprland: null,
        note: 'Hyprland uses different drag model'
    },
    'tiling_drag_threshold': {
        hyprland: null,
        note: 'No direct equivalent'
    },

    'floating_modifier': {
        hyprland: '$mod',
        note: 'Hyprland uses bind for floating operations'
    },
    'floating_minimum_size': {
        hyprland: null,
        note: 'Use windowrulev2 = minsize'
    },
    'floating_maximum_size': {
        hyprland: null,
        note: 'Use windowrulev2 = maxsize'
    },

    'max_render_time': {
        hyprland: null,
        note: 'Hyprland handles rendering differently'
    },
    'allow_tearing': {
        hyprland: 'general:allow_tearing',
        valueMap: {
            'yes': true,
            'no': false
        }
    },

    'font': {
        hyprland: null,
        note: 'Hyprland does not render fonts, use bar/notification config'
    },

    'title_align': {
        hyprland: null,
        note: 'Hyprland does not have titlebars by default'
    },
    'show_marks': {
        hyprland: null,
        note: 'No marks concept in Hyprland'
    },
};


export const INPUT_MAP = {
    'xkb_layout': {
        hyprland: 'input:kb_layout'
    },
    'xkb_variant': {
        hyprland: 'input:kb_variant'
    },
    'xkb_options': {
        hyprland: 'input:kb_options'
    },
    'xkb_model': {
        hyprland: 'input:kb_model'
    },
    'xkb_rules': {
        hyprland: 'input:kb_rules'
    },
    'xkb_numlock': {
        hyprland: 'input:numlock_by_default',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'xkb_capslock': {
        hyprland: null,
        note: 'No direct equivalent'
    },
    'repeat_delay': {
        hyprland: 'input:repeat_delay'
    },
    'repeat_rate': {
        hyprland: 'input:repeat_rate'
    },

    'accel_profile': {
        hyprland: 'input:accel_profile',
        valueMap: { 'adaptive': 'adaptive', 'flat': 'flat' }
    },
    'pointer_accel': {
        hyprland: 'input:sensitivity',
        note: 'Range differs: Sway -1..1, Hyprland -1..1'
    },
    'natural_scroll': {
        hyprland: 'input:natural_scroll',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'scroll_factor': {
        hyprland: 'input:scroll_factor'
    },
    'scroll_method': {
        hyprland: 'input:scroll_method',
        valueMap: {
            'none': 'no_scroll',
            'two_finger': 'two_finger',
            'edge': 'edge',
            'on_button_down': 'on_button_down'
        }
    },
    'left_handed': {
        hyprland: 'input:left_handed',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'middle_emulation': {
        hyprland: 'input:touchpad:middle_button_emulation',
        valueMap: { 'enabled': true, 'disabled': false }
    },

    'tap': {
        hyprland: 'input:touchpad:tap-to-click',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'tap_button_map': {
        hyprland: 'input:touchpad:tap_button_map',
        valueMap: { 'lrm': 'lrm', 'lmr': 'lmr' }
    },
    'drag': {
        hyprland: 'input:touchpad:tap-and-drag',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'drag_lock': {
        hyprland: 'input:touchpad:drag_lock',
        valueMap: { 'enabled': true, 'disabled': false, 'enabled_sticky': true }
    },
    'dwt': {
        hyprland: 'input:touchpad:disable_while_typing',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'dwtp': {
        hyprland: null,
        note: 'No trackpoint equivalent in Hyprland'
    },
    'click_method': {
        hyprland: 'input:touchpad:clickfinger_behavior',
        valueMap: {
            'none': false,
            'button_areas': false,
            'clickfinger': true
        }
    },

    'touchpad:tap': {
        hyprland: 'input:touchpad:tap-to-click',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'touchpad:tap_button_map': {
        hyprland: 'input:touchpad:tap_button_map',
        valueMap: { 'lrm': 'lrm', 'lmr': 'lmr' }
    },
    'touchpad:drag': {
        hyprland: 'input:touchpad:tap-and-drag',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'touchpad:drag_lock': {
        hyprland: 'input:touchpad:drag_lock',
        valueMap: { 'enabled': true, 'disabled': false, 'enabled_sticky': true }
    },
    'touchpad:dwt': {
        hyprland: 'input:touchpad:disable_while_typing',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'touchpad:natural_scroll': {
        hyprland: 'input:touchpad:natural_scroll',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'touchpad:middle_emulation': {
        hyprland: 'input:touchpad:middle_button_emulation',
        valueMap: { 'enabled': true, 'disabled': false }
    },
    'touchpad:click_method': {
        hyprland: 'input:touchpad:clickfinger_behavior',
        valueMap: {
            'none': false,
            'button_areas': false,
            'clickfinger': true
        }
    },
    'touchpad:accel_profile': {
        hyprland: 'input:touchpad:accel_profile',
        valueMap: { 'adaptive': 'adaptive', 'flat': 'flat' }
    },
    'touchpad:pointer_accel': {
        hyprland: 'input:touchpad:sensitivity'
    },
    'touchpad:scroll_factor': {
        hyprland: 'input:touchpad:scroll_factor'
    },
    'touchpad:scroll_method': {
        hyprland: 'input:touchpad:scroll_method',
        valueMap: {
            'none': 'no_scroll',
            'two_finger': 'two_finger',
            'edge': 'edge',
            'on_button_down': 'on_button_down'
        }
    },

    'keyboard:xkb_layout': {
        hyprland: 'input:kb_layout'
    },
    'keyboard:xkb_variant': {
        hyprland: 'input:kb_variant'
    },
    'keyboard:xkb_options': {
        hyprland: 'input:kb_options'
    },
    'keyboard:xkb_model': {
        hyprland: 'input:kb_model'
    },
    'keyboard:xkb_rules': {
        hyprland: 'input:kb_rules'
    },
    'keyboard:repeat_delay': {
        hyprland: 'input:repeat_delay'
    },
    'keyboard:repeat_rate': {
        hyprland: 'input:repeat_rate'
    },

    'touch:events': {
        hyprland: null,
        note: 'Hyprland does not have touch events toggle'
    },
};


export const OUTPUT_MAP = {
    'mode': 'resolution',
    'resolution': 'resolution',
    'res': 'resolution',
    'position': 'position',
    'pos': 'position',
    'scale': 'scale',
    'scale_filter': null,
    'transform': 'transform',
    'background': 'wallpaper',
    'bg': 'wallpaper',
    'enable': null,
    'disable': 'disable',
    'power': null,
    'dpms': null,
    'adaptive_sync': 'vrr',
    'render_bit_depth': null,
    'allow_tearing': 'allow_tearing',
};


export const COMMAND_MAP = {
    'exec': 'exec',
    'exec_always': 'exec',
    'exec --no-startup-id': 'exec-once',

    'set': 'set',

    'bindsym': 'bind',
    'bindcode': 'bind',
    'bindswitch': null,
    'bindgesture': 'bindg',

    'mode': 'submap',

    'include': 'source',

    'bar': null,

    'kill': 'killactive',

    'focus': 'movefocus',
    'focus left': 'movefocus, l',
    'focus right': 'movefocus, r',
    'focus up': 'movefocus, u',
    'focus down': 'movefocus, d',
    'focus parent': null,
    'focus child': null,

    'move': 'movewindow',
    'move left': 'movewindow, l',
    'move right': 'movewindow, r',
    'move up': 'movewindow, u',
    'move down': 'movewindow, d',

    'resize': 'resizeactive',
    'resize shrink width': 'resizeactive, -40 0',
    'resize grow width': 'resizeactive, 40 0',
    'resize shrink height': 'resizeactive, 0 -40',
    'resize grow height': 'resizeactive, 0 40',

    'workspace': 'workspace',
    'workspace number': 'workspace',
    'workspace prev': 'workspace, -1',
    'workspace next': 'workspace, +1',
    'workspace back_and_forth': 'workspace, previous',

    'move container to workspace': 'movetoworkspace',
    'move window to workspace': 'movetoworkspace',

    'move scratchpad': 'movetoworkspace, special',
    'scratchpad show': 'togglespecialworkspace',

    'floating toggle': 'togglefloating',
    'floating enable': 'setfloating',
    'floating disable': 'settiling',

    'fullscreen': 'fullscreen',
    'fullscreen toggle': 'fullscreen, 0',

    'split horizontal': 'layoutmsg, preselect l',
    'split vertical': 'layoutmsg, preselect d',
    'split toggle': 'layoutmsg, togglesplit',
    'splith': 'layoutmsg, preselect l',
    'splitv': 'layoutmsg, preselect d',

    'layout': null,
    'layout stacking': null,
    'layout tabbed': null,
    'layout toggle': 'togglegroup',
    'layout toggle split': 'layoutmsg, togglesplit',
    'layout splith': 'layoutmsg, preselect l',
    'layout splitv': 'layoutmsg, preselect d',

    'sticky toggle': 'pin',
    'sticky enable': 'pin',

    'reload': 'exec, hyprctl reload',

    'exit': 'exit',
};


export const MODIFIER_MAP = {
    'Mod1': 'ALT',
    'Mod2': 'MOD2',
    'Mod3': 'MOD3',
    'Mod4': 'SUPER',
    'Mod5': 'MOD5',
    'mod': 'SUPER',
    '$mod': 'SUPER',
    'Shift': 'SHIFT',
    'Control': 'CTRL',
    'Ctrl': 'CTRL',
    'Alt': 'ALT',
    'Super': 'SUPER',
    'Lock': 'CAPS',
};

export const KEY_MAP = {
    'Return': 'Return',
    'Escape': 'Escape',
    'space': 'space',
    'Tab': 'Tab',
    'BackSpace': 'BackSpace',
    'Delete': 'Delete',
    'Insert': 'Insert',
    'Home': 'Home',
    'End': 'End',
    'Prior': 'Page_Up',
    'Next': 'Page_Down',
    'Page_Up': 'Page_Up',
    'Page_Down': 'Page_Down',
    'Left': 'Left',
    'Right': 'Right',
    'Up': 'Up',
    'Down': 'Down',

    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
    'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
    'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',

    'XF86AudioRaiseVolume': 'XF86AudioRaiseVolume',
    'XF86AudioLowerVolume': 'XF86AudioLowerVolume',
    'XF86AudioMute': 'XF86AudioMute',
    'XF86AudioMicMute': 'XF86AudioMicMute',
    'XF86AudioPlay': 'XF86AudioPlay',
    'XF86AudioPause': 'XF86AudioPause',
    'XF86AudioNext': 'XF86AudioNext',
    'XF86AudioPrev': 'XF86AudioPrev',
    'XF86AudioStop': 'XF86AudioStop',
    'XF86MonBrightnessUp': 'XF86MonBrightnessUp',
    'XF86MonBrightnessDown': 'XF86MonBrightnessDown',
    'XF86Display': 'XF86Display',
    'XF86PowerOff': 'XF86PowerOff',
    'Print': 'Print',
};


export const CRITERIA_MAP = {
    'app_id': 'class',
    'class': 'class',
    'instance': 'class',
    'title': 'title',
    'shell': null,
    'con_id': null,
    'con_mark': null,
    'floating': 'floating',
    'tiling': 'tiling',
    'urgent': null,
    'window_role': null,
    'window_type': null,
    'workspace': 'workspace',
    'pid': 'pid',
};

export const WINDOW_RULE_MAP = {
    'floating enable': 'float',
    'floating disable': 'tile',
    'fullscreen enable': 'fullscreen',
    'focus': 'focus',
    'move scratchpad': 'workspace special',
    'sticky enable': 'pin',
    'opacity': 'opacity',
    'border pixel': 'noborder',
    'border none': 'noborder',
    'border normal': null,
    'resize set': 'size',
    'move position': 'move',
    'move container to workspace': 'workspace',
    'inhibit_idle': 'idleinhibit',
    'max_render_time': null,
    'shortcuts_inhibitor': null,
};


export const BAR_MAP = {
    'position': 'position',
    'mode': null,
    'hidden_state': null,
    'modifier': null,

    'height': 'height',
    'font': 'font-family',
    'gaps': null,

    'colors': {
        'background': 'background-color',
        'statusline': 'color',
        'separator': 'border-color',
        'focused_workspace': null,
        'active_workspace': null,
        'inactive_workspace': null,
        'urgent_workspace': null,
    },

    'status_command': 'exec',
    'workspace_buttons': null,
    'strip_workspace_numbers': null,
    'strip_workspace_name': null,
};


export const GESTURE_MAP = {
    'swipe': 'swipe',
    'pinch': 'pinch',
    'hold': null,

    'up': 'u',
    'down': 'd',
    'left': 'l',
    'right': 'r',
    'inward': 'i',
    'outward': 'o',
    'clockwise': 'cw',
    'counterclockwise': 'ccw',
};


export function convertBoolean(value) {
    const trueValues = ['yes', 'true', 'on', 'enabled', '1'];
    const falseValues = ['no', 'false', 'off', 'disabled', '0'];

    const v = String(value).toLowerCase().trim();
    if (trueValues.includes(v)) return true;
    if (falseValues.includes(v)) return false;
    return null;
}

export function convertColor(swayColor) {
    if (!swayColor || typeof swayColor !== 'string') return null;

    const color = swayColor.trim();

    if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
        return color;
    }

    if (color.startsWith('#')) {
        const hex = color.slice(1);
        switch (hex.length) {
            case 6:
                return `rgb(${hex})`;
            case 8:
                return `rgba(${hex})`;
        }
    }

    return color;
}

export function convertSize(swaySize) {
    if (!swaySize || typeof swaySize !== 'string') return null;

    const match = swaySize.match(/(\d+)\s*x\s*(\d+)/i);
    if (match) {
        return `${match[1]} ${match[2]}`;
    }
    return swaySize;
}

export function convertPosition(swayPos) {
    if (!swayPos || typeof swayPos !== 'string') return null;

    const parts = swayPos.trim().split(/\s+/);
    if (parts.length >= 2) {
        return `${parts[0]} ${parts[1]}`;
    }
    return swayPos;
}

export function convertTransform(swayTransform) {
    const transformMap = {
        'normal': '0',
        '90': '1',
        '180': '2',
        '270': '3',
        'flipped': '4',
        'flipped-90': '5',
        'flipped-180': '6',
        'flipped-270': '7',
    };
    return transformMap[swayTransform] || '0';
}


export const SwayHyprlandMapping = {
    PARAMETER_MAP,
    INPUT_MAP,
    OUTPUT_MAP,
    COMMAND_MAP,
    MODIFIER_MAP,
    KEY_MAP,
    CRITERIA_MAP,
    WINDOW_RULE_MAP,
    BAR_MAP,
    GESTURE_MAP,
    convertBoolean,
    convertColor,
    convertSize,
    convertPosition,
    convertTransform,
};

export default SwayHyprlandMapping;
