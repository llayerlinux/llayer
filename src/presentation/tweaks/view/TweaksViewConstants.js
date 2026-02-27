import {Commands} from '../../../infrastructure/constants/Commands.js';
import {TRUTHY_VALUES} from '../../../infrastructure/constants/BooleanValues.js';

export const COMMAND_BIN = Commands;
export {TRUTHY_VALUES};

export const BASIC_LABEL_DEFAULTS = {
    BASIC_ROUNDING: 'Rounding',
    BASIC_BLUR: 'Blur',
    BASIC_GAPS_IN: 'Gaps In',
    BASIC_GAPS_OUT: 'Gaps Out',
    BASIC_BLUR_PASSES: 'Blur Passes',
    BASIC_BLUR_OPTIMIZATION: 'Blur Optimizations',
    BASIC_ANIMATIONS: 'Animations',
    BASIC_TAB: 'Basic',
    ADVANCED_TAB: 'Advanced',
    PLUGINS_TAB: 'Plugins',
    ADVANCED_TAB_COMING_SOON: 'Advanced settings coming soon...',
    PLUGINS_TAB_COMING_SOON: 'Plugins settings coming soon...',
    BASIC_TILING_MODE: 'Tiling Mode',
    BASIC_DIM_INACTIVE: 'Dim Inactive',
    BASIC_DIM_STRENGTH: 'Dim Strength',
    BASIC_ACTIVE_OPACITY: 'Active Opacity',
    BASIC_INACTIVE_OPACITY: 'Inactive Opacity',
    BASIC_FULLSCREEN_OPACITY: 'Fullscreen Opacity',
    BASIC_MOUSE_SENSITIVITY: 'Mouse Sensitivity',
    BASIC_SCROLL_FACTOR: 'Scroll Factor',
    BASIC_FOLLOW_MOUSE: 'Follow Mouse',
    BASIC_FORCE_NO_ACCEL: 'Force No Accel',
    BASIC_NATURAL_SCROLL: 'Natural Scroll'
};

export const HYPRLAND_VERSION_PATTERNS = [
    /(?:Hyprland|hyprland)\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)\s+built/i,
    /(?:Hyprland|hyprland)\s+v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i,
    /Tag:\s*v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i,
    /([0-9]+\.[0-9]+(?:\.[0-9]+)?)/
];

export const HYPRLAND_LAYOUT_MAP = [['master', 'master'], ['dwindle', 'dwindle']];

const boolToFlag = (value) => value ? '1' : '0';

export const TWEAK_MAPPING = [
    ['rounding', 'decoration:rounding'],
    ['blur', 'decoration:blur:size'],
    ['blurEnabled', 'decoration:blur:enabled'],
    ['gapsIn', 'general:gaps_in'],
    ['gapsOut', 'general:gaps_out'],
    ['blurPasses', 'decoration:blur:passes'],
    ['blurOptim', 'decoration:blur:new_optimizations', boolToFlag],
    ['animations', 'animations:enabled', boolToFlag]
];
