const HYPRLAND_MIGRATIONS = {
    'gestures:workspace_swipe': {
        version: '0.51.0',
        action: 'removed',
        note: 'New gesture syntax: gesture = fingers, direction, action'
    },
    'gestures:workspace_swipe_fingers': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_min_fingers': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_distance': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_touch': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_invert': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_min_speed_to_force': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_cancel_ratio': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_create_new': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_direction_lock': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_direction_lock_threshold': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_forever': { version: '0.51.0', action: 'removed' },
    'gestures:workspace_swipe_use_r': { version: '0.51.0', action: 'removed' },

    'animations:first_launch_animation': {
        version: '0.51.0',
        action: 'removed',
        note: 'Use monitorAdded animation leaf instead'
    },

    'render:explicit_sync': { version: '0.50.0', action: 'removed', note: 'Always enabled now' },
    'render:explicit_sync_kms': { version: '0.50.0', action: 'removed' },
    'misc:render_ahead_of_time': { version: '0.50.0', action: 'removed' },
    'misc:render_ahead_safezone': { version: '0.50.0', action: 'removed' },

    'opengl:force_introspection': { version: '0.48.0', action: 'removed' },
    'render:allow_early_buffer_release': { version: '0.48.0', action: 'removed' },

    'decoration:drop_shadow': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:enabled'
    },
    'decoration:shadow_range': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:range'
    },
    'decoration:shadow_render_power': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:render_power'
    },
    'decoration:shadow_offset': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:offset'
    },
    'decoration:col.shadow': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:color'
    },
    'decoration:col.shadow_inactive': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:color_inactive'
    },
    'decoration:shadow_ignore_window': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:ignore_window'
    },
    'decoration:shadow_scale': {
        version: '0.45.0',
        action: 'moved',
        newPath: 'decoration:shadow:scale'
    },

    'decoration:blur': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:enabled'
    },
    'decoration:blur_size': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:size'
    },
    'decoration:blur_passes': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:passes'
    },
    'decoration:blur_new_optimizations': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:new_optimizations'
    },
    'decoration:blur_ignore_opacity': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:ignore_opacity'
    },
    'decoration:blur_xray': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:xray'
    },
    'decoration:blur_noise': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:noise'
    },
    'decoration:blur_contrast': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:contrast'
    },
    'decoration:blur_brightness': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:brightness'
    },
    'decoration:blur_vibrancy': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:vibrancy'
    },
    'decoration:blur_vibrancy_darkness': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:vibrancy_darkness'
    },
    'decoration:blur_special': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:special'
    },
    'decoration:blur_popups': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:popups'
    },
    'decoration:blur_popups_ignorealpha': {
        version: '0.28.0',
        action: 'moved',
        newPath: 'decoration:blur:popups_ignorealpha'
    },

    'decoration:multisample_edges': {
        version: '0.31.0',
        action: 'removed',
        note: 'Better algorithm used by default'
    },

    'dwindle:no_gaps_when_only': {
        version: '0.45.0',
        action: 'removed',
        note: 'Use workspace rules for smart gaps'
    },
    'master:no_gaps_when_only': {
        version: '0.45.0',
        action: 'removed',
        note: 'Use workspace rules for smart gaps'
    },

    'misc:no_direct_scanout': {
        version: '0.42.0',
        action: 'renamed',
        newPath: 'render:direct_scanout',
        transform: 'invert',
        note: 'Logic inverted: no_direct_scanout=true -> direct_scanout=false'
    },

    'cursor:dumb_copy': {
        version: '0.46.0',
        action: 'renamed',
        newPath: 'cursor:use_cpu_buffer'
    },

    'master:new_is_master': { version: '0.44.0', action: 'removed' },
    'master:new_on_top': {
        version: '0.44.0',
        action: 'renamed',
        newPath: 'master:new_on_active'
    },
    'master:always_center_master': {
        version: '0.47.0',
        action: 'renamed',
        newPath: 'master:slave_count_for_center_master',
        transform: 'boolToInt',
        note: 'Now accepts integer'
    },
    'master:center_master_slaves_on_right': {
        version: '0.49.0',
        action: 'renamed',
        newPath: 'master:center_master_fallback'
    },

    'misc:allow_session_lock_restore': {
        version: '0.50.0',
        action: 'renamed',
        newPath: 'misc:lockdead_screen_delay'
    },
    'misc:disable_hyprland_qtutils_check': {
        version: '0.52.0',
        action: 'renamed',
        newPath: 'misc:disable_hyprland_guiutils_check'
    },

    'input:touchpad:workspace_swipe': {
        version: '0.40.0',
        action: 'moved',
        newPath: 'gestures:workspace_swipe',
        note: 'Then removed in 0.51.0'
    },
    'input:touchpad:workspace_swipe_fingers': {
        version: '0.40.0',
        action: 'moved',
        newPath: 'gestures:workspace_swipe_fingers'
    },
    'input:touchpad:workspace_swipe_min_fingers': {
        version: '0.40.0',
        action: 'removed'
    }
};

const HYPRLAND_FUTURE_PARAMS = {
    'decoration:shadow:enabled': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:drop_shadow'
    },
    'decoration:shadow:range': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_range'
    },
    'decoration:shadow:render_power': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_render_power'
    },
    'decoration:shadow:offset': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_offset'
    },
    'decoration:shadow:color': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:col.shadow'
    },
    'decoration:shadow:color_inactive': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:col.shadow_inactive'
    },
    'decoration:shadow:ignore_window': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_ignore_window'
    },
    'decoration:shadow:scale': {
        minVersion: '0.45.0',
        action: 'rename',
        oldPath: 'decoration:shadow_scale'
    },

    'decoration:blur:enabled': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur'
    },
    'decoration:blur:size': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_size'
    },
    'decoration:blur:passes': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_passes'
    },
    'decoration:blur:new_optimizations': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_new_optimizations'
    },
    'decoration:blur:ignore_opacity': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_ignore_opacity'
    },
    'decoration:blur:xray': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_xray'
    },
    'decoration:blur:noise': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_noise'
    },
    'decoration:blur:contrast': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_contrast'
    },
    'decoration:blur:brightness': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_brightness'
    },
    'decoration:blur:vibrancy': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_vibrancy'
    },
    'decoration:blur:vibrancy_darkness': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_vibrancy_darkness'
    },
    'decoration:blur:special': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_special'
    },
    'decoration:blur:popups': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_popups'
    },
    'decoration:blur:popups_ignorealpha': {
        minVersion: '0.28.0',
        action: 'rename',
        oldPath: 'decoration:blur_popups_ignorealpha'
    },

    'cursor:use_cpu_buffer': {
        minVersion: '0.46.0',
        action: 'rename',
        oldPath: 'cursor:dumb_copy'
    },

    'master:new_on_active': {
        minVersion: '0.44.0',
        action: 'rename',
        oldPath: 'master:new_on_top'
    },
    'master:slave_count_for_center_master': {
        minVersion: '0.47.0',
        action: 'rename',
        oldPath: 'master:always_center_master',
        transform: 'intToBool'
    },
    'master:center_master_fallback': {
        minVersion: '0.49.0',
        action: 'rename',
        oldPath: 'master:center_master_slaves_on_right'
    },

    'render:direct_scanout': {
        minVersion: '0.42.0',
        action: 'rename',
        oldPath: 'misc:no_direct_scanout',
        transform: 'invert'
    },

    'misc:lockdead_screen_delay': {
        minVersion: '0.50.0',
        action: 'rename',
        oldPath: 'misc:allow_session_lock_restore'
    },
    'misc:disable_hyprland_guiutils_check': {
        minVersion: '0.52.0',
        action: 'rename',
        oldPath: 'misc:disable_hyprland_qtutils_check'
    },

    'ecosystem:no_update_news': {
        minVersion: '0.45.0',
        action: 'disable',
        note: 'ecosystem section not available in older versions'
    },
    'ecosystem:no_donation_nag': {
        minVersion: '0.45.0',
        action: 'disable',
        note: 'ecosystem section not available in older versions'
    },

    'experimental:xx_color_management_v4': {
        minVersion: '0.48.0',
        action: 'disable',
        note: 'experimental color management not available in older versions'
    },

    'render:cm_enabled': {
        minVersion: '0.48.0',
        action: 'disable',
        note: 'Color management not available in older versions'
    },
    'render:cm_fs_passthrough': {
        minVersion: '0.48.0',
        action: 'disable',
        note: 'Color management not available in older versions'
    }
};

export { HYPRLAND_MIGRATIONS, HYPRLAND_FUTURE_PARAMS };
