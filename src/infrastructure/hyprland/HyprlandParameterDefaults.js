const HYPRLAND_PARAMS = {
    'monitor': { type: 'str', default: ',preferred,auto,1', description: 'Monitor configuration (name,res@hz,pos,scale)', popularity: 105 },

    'input:kb_layout': { type: 'str', default: 'us', description: 'Keyboard layout(s)', popularity: 100 },
    'input:kb_options': { type: 'str', default: '', description: 'XKB options (e.g., grp:alt_shift_toggle)', popularity: 95 },
    'input:kb_variant': { type: 'str', default: '', description: 'Keyboard variant(s)', popularity: 90 },
    'input:sensitivity': { type: 'float', default: 0, min: -1, max: 1, description: 'Mouse sensitivity', popularity: 85 },
    'input:accel_profile': { type: 'str', default: '', options: ['', 'flat', 'adaptive'], description: 'Acceleration profile', popularity: 80 },
    'input:natural_scroll': { type: 'bool', default: false, description: 'Natural (inverted) scroll', popularity: 75 },
    'input:follow_mouse': { type: 'int', default: 1, options: [0, 1, 2, 3], description: 'Focus follows mouse mode', popularity: 70 },
    'input:repeat_rate': { type: 'int', default: 25, description: 'Key repeat rate (keys/sec)', popularity: 65 },
    'input:repeat_delay': { type: 'int', default: 600, description: 'Delay before key repeat (ms)', popularity: 60 },
    'input:numlock_by_default': { type: 'bool', default: false, description: 'Enable numlock on start', popularity: 55 },
    'input:force_no_accel': { type: 'bool', default: false, description: 'Force disable acceleration', popularity: 50 },
    'input:left_handed': { type: 'bool', default: false, description: 'Left-handed mouse', popularity: 40 },

    'input:touchpad:disable_while_typing': { type: 'bool', default: true, description: 'Disable touchpad while typing', popularity: 70 },
    'input:touchpad:natural_scroll': { type: 'bool', default: false, description: 'Touchpad natural scroll', popularity: 65 },
    'input:touchpad:scroll_factor': { type: 'float', default: 1.0, description: 'Touchpad scroll speed', popularity: 60 },
    'input:touchpad:tap-to-click': { type: 'bool', default: true, description: 'Enable tap to click', popularity: 55 },
    'input:touchpad:tap_button_map': { type: 'str', default: 'lrm', description: 'Tap button map (e.g., lrm)', popularity: 52 },
    'input:touchpad:clickfinger_behavior': { type: 'bool', default: false, description: 'Enable clickfinger right/middle click', popularity: 50 },
    'input:touchpad:drag_lock': { type: 'bool', default: false, description: 'Drag lock', popularity: 40 },
    'input:touchpad:tap-and-drag': { type: 'bool', default: false, description: 'Tap and drag', popularity: 40 },

    'general:gaps_in': { type: 'int', default: 5, min: 0, description: 'Gaps between windows', popularity: 80 },
    'general:gaps_out': { type: 'int', default: 20, min: 0, description: 'Gaps from screen edges', popularity: 80 },
    'general:border_size': { type: 'int', default: 2, min: 0, description: 'Window border size', popularity: 75 },
    'general:col.active_border': { type: 'gradient', default: 'rgba(33ccffee) rgba(00ff99ee) 45deg', description: 'Active window border color', popularity: 70 },
    'general:col.inactive_border': { type: 'color', default: 'rgba(595959aa)', description: 'Inactive window border color', popularity: 65 },
    'general:layout': { type: 'str', default: 'dwindle', options: ['dwindle', 'master', 'floating', 'tiled'], description: 'Tiling layout mode', popularity: 98 },
    'general:resize_on_border': { type: 'bool', default: false, description: 'Resize by dragging borders', popularity: 50 },
    'general:allow_tearing': { type: 'bool', default: false, description: 'Allow tearing (for games)', popularity: 45 },

    'decoration:rounding': { type: 'int', default: 0, min: 0, description: 'Corner rounding radius', popularity: 85 },
    'decoration:active_opacity': { type: 'float', default: 1.0, min: 0, max: 1, description: 'Active window opacity', popularity: 70 },
    'decoration:inactive_opacity': { type: 'float', default: 1.0, min: 0, max: 1, description: 'Inactive window opacity', popularity: 65 },
    'decoration:dim_inactive': { type: 'bool', default: false, description: 'Dim inactive windows', popularity: 55 },
    'decoration:dim_strength': { type: 'float', default: 0.5, min: 0, max: 1, description: 'Dim amount', popularity: 50 },

    'decoration:blur:enabled': { type: 'bool', default: true, description: 'Enable blur', popularity: 75 },
    'decoration:blur:size': { type: 'int', default: 8, min: 1, description: 'Blur size', popularity: 70 },
    'decoration:blur:passes': { type: 'int', default: 1, min: 1, description: 'Blur passes', popularity: 65 },
    'decoration:blur:new_optimizations': { type: 'bool', default: true, description: 'Enable blur optimizations', popularity: 50 },
    'decoration:blur:xray': { type: 'bool', default: false, description: 'Floating ignores tiled behind', popularity: 40 },
    'decoration:blur:noise': { type: 'float', default: 0.0117, description: 'Noise amount', popularity: 35 },
    'decoration:blur:contrast': { type: 'float', default: 0.8916, description: 'Contrast adjustment', popularity: 35 },
    'decoration:blur:brightness': { type: 'float', default: 0.8172, description: 'Brightness adjustment', popularity: 35 },
    'decoration:blur:popups': { type: 'bool', default: false, description: 'Blur popups/menus', popularity: 45 },

    'decoration:shadow:enabled': { type: 'bool', default: true, description: 'Enable shadows', popularity: 60 },
    'decoration:shadow:range': { type: 'int', default: 4, description: 'Shadow range/size', popularity: 55 },
    'decoration:shadow:render_power': { type: 'int', default: 3, min: 1, max: 4, description: 'Shadow falloff', popularity: 50 },
    'decoration:shadow:color': { type: 'color', default: 'rgba(1a1a1aee)', description: 'Shadow color', popularity: 45 },
    'decoration:shadow:offset': { type: 'vec2', default: '0 0', description: 'Shadow offset', popularity: 40 },

    'gestures:workspace_swipe': { type: 'bool', default: false, description: 'Enable workspace swipe', popularity: 70 },
    'gestures:workspace_swipe_fingers': { type: 'int', default: 3, description: 'Fingers for swipe', popularity: 60 },
    'gestures:workspace_swipe_distance': { type: 'int', default: 300, description: 'Swipe distance threshold', popularity: 55 },
    'gestures:workspace_swipe_invert': { type: 'bool', default: true, description: 'Invert swipe direction', popularity: 50 },
    'gestures:workspace_swipe_create_new': { type: 'bool', default: true, description: 'Create workspace on swipe', popularity: 45 },

    'cursor:no_hardware_cursors': { type: 'bool', default: false, description: 'Disable hardware cursors (nvidia)', popularity: 75 },
    'cursor:inactive_timeout': { type: 'int', default: 0, description: 'Hide cursor after timeout', popularity: 50 },
    'cursor:use_cpu_buffer': { type: 'bool', default: false, description: 'Use CPU buffer (nvidia)', popularity: 45 },
    'cursor:hide_on_key_press': { type: 'bool', default: false, description: 'Hide on keypress', popularity: 40 },

    'misc:disable_hyprland_logo': { type: 'bool', default: false, description: 'Disable startup logo', popularity: 65 },
    'misc:disable_splash_rendering': { type: 'bool', default: false, description: 'Disable splash screen', popularity: 60 },
    'misc:vfr': { type: 'bool', default: true, description: 'Variable frame rate', popularity: 55 },
    'misc:vrr': { type: 'int', default: 0, options: [0, 1, 2], description: 'Variable refresh rate', popularity: 50 },
    'misc:animate_manual_resizes': { type: 'bool', default: false, description: 'Animate manual resizes', popularity: 40 },
    'misc:enable_swallow': { type: 'bool', default: false, description: 'Enable window swallow', popularity: 35 },
    'misc:focus_on_activate': { type: 'bool', default: false, description: 'Focus on activate', popularity: 45 },

    'animations:enabled': { type: 'bool', default: true, description: 'Enable animations', popularity: 70 },
    'animations:first_launch_animation': { type: 'bool', default: true, description: 'Show startup animation', popularity: 40 },

    'binds:workspace_back_and_forth': { type: 'bool', default: false, description: 'Workspace back and forth', popularity: 55 },
    'binds:allow_workspace_cycles': { type: 'bool', default: false, description: 'Allow workspace cycles', popularity: 45 },
    'binds:scroll_event_delay': { type: 'int', default: 300, description: 'Scroll event delay (ms)', popularity: 40 },

    'dwindle:pseudotile': { type: 'bool', default: false, description: 'Enable pseudotiling', popularity: 50 },
    'dwindle:force_split': { type: 'int', default: 0, options: [0, 1, 2], description: 'Force split direction', popularity: 45 },
    'dwindle:preserve_split': { type: 'bool', default: false, description: 'Preserve split direction', popularity: 55 },
    'dwindle:smart_split': { type: 'bool', default: false, description: 'Smart split by cursor', popularity: 40 },
    'dwindle:smart_resizing': { type: 'bool', default: true, description: 'Smart resizing', popularity: 40 },

    'master:mfact': { type: 'float', default: 0.55, min: 0.1, max: 0.9, description: 'Master area factor', popularity: 50 },
    'master:new_status': { type: 'str', default: 'slave', options: ['master', 'slave'], description: 'New window status', popularity: 45 },
    'master:orientation': { type: 'str', default: 'left', options: ['left', 'right', 'top', 'bottom', 'center'], description: 'Master orientation', popularity: 45 },

    'xwayland:force_zero_scaling': { type: 'bool', default: false, description: 'Force zero XWayland scaling', popularity: 60 },
    'xwayland:use_nearest_neighbor': { type: 'bool', default: true, description: 'Nearest neighbor scaling', popularity: 40 },

    'render:explicit_sync': { type: 'int', default: 2, options: [0, 1, 2], description: 'Explicit sync mode', popularity: 45 },
    'render:direct_scanout': { type: 'bool', default: false, description: 'Direct scanout', popularity: 35 },

    'opengl:nvidia_anti_flicker': { type: 'bool', default: true, description: 'Nvidia anti-flicker', popularity: 50 },
};

export { HYPRLAND_PARAMS };
