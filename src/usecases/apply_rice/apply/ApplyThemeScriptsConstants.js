export const ISOLATION_PREAMBLE_CACHE = new Map();

export const PATTERN_PACMAN_FILE = /^\S+\s+(.+)$/;
export const PATTERN_SCRIPT_SHEBANG = /^#!.*\n?/;
export const PATTERN_TRAILING_BACKGROUND = /' &\s*$/gm;
export const PATTERN_SCRIPT_DIR = /\/[^\/]+$/;
export const PATTERN_SUDO_USAGE = /(^|[;&|\s])sudo\b/m;
export const PATTERN_TERMINAL_LAUNCHER = /^(xterm|foot|kitty|alacritty|wezterm|gnome-terminal|konsole|tilix)\s+(-[^\s]+\s+)*-e\s+bash\s+-c\s+'/m;
export const PATTERN_TERMINAL_INJECT = /(-e\s+bash\s+-c\s+'\n?)(set\s+\+e\n)?/;
export const PATTERN_WRAPPER_BINARY = /^# Real binary: (.+)$/m;

export const WIDGET_BINARIES = ['ags', 'agsv1', 'eww', 'waybar', 'polybar', 'fabric', 'goignis', 'ignis', 'hyprpanel', 'quickshell', 'nwg-dock-hyprland', 'swaybg', 'swww'];
