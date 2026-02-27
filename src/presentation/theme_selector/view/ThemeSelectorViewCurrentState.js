import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';
import {decodeBytes, translateWithFallback} from '../../../infrastructure/utils/Utils.js';
import {tryOrDefault, tryRun} from '../../../infrastructure/utils/ErrorUtils.js';
import {addPointerCursor} from '../../common/ViewUtils.js';


const TERMINAL_COMMANDS = [
    'foot', 'kitty', 'alacritty', 'wezterm', 'ghostty', 'urxvt', 'xterm', 'st',
    'gnome-terminal', 'konsole', 'xfce4-terminal', 'tilix', 'terminator', 'rio', 'warp'
];
const FILE_MANAGER_COMMANDS = [
    'thunar', 'nautilus', 'dolphin', 'pcmanfm', 'pcmanfm-qt', 'nemo',
    'caja', 'doublecmd', 'krusader', 'nnn', 'ranger', 'yazi', 'lf'
];
const SHORTCUTS_KEYWORDS = [
    'cheatsheet', 'shortcut', 'shortcuts', 'keybind', 'keybinds', 'keybinding', 'hotkey', 'hotkeys'
];
const DIRECT_LAUNCHER_KEYWORDS = [
    'rofi', 'wofi', 'fuzzel', 'bemenu', 'tofi', 'walker', 'dmenu', 'anyrun', 'wlogout', 'drun'
];
const SCREENSHOT_KEYWORDS = [
    'grimblast', 'hyprshot', 'flameshot', 'spectacle', 'maim', 'scrot',
    'grim', 'slurp', 'swappy', 'screenshot'
];
const CLOSE_COMMAND_KEYWORDS = [
    'hyprctl killactive', 'hyprctl dispatch killactive', 'hyprctl kill',
    'windowkill', 'wmctrl -c', 'xdotool windowkill'
];
const FULLSCREEN_COMMAND_KEYWORDS = [
    'dispatch fullscreen', 'fullscreenstate'
];
const SINGLE_WINDOW_COMMAND_KEYWORDS = [
    'dispatch fullscreen 1', 'fullscreen 1', 'dispatch pseudo', 'dispatch togglesplit'
];
const MOVE_WINDOW_COMMAND_KEYWORDS = [
    'dispatch movewindow', 'movewindow'
];
const MOVE_TO_WORKSPACE_COMMAND_KEYWORDS = [
    'dispatch movetoworkspace', 'movetoworkspace', 'dispatch movetoworkspacesilent', 'movetoworkspacesilent'
];
const RESIZE_WINDOW_COMMAND_KEYWORDS = [
    'dispatch resizewindow', 'resizewindow', 'resizeactive'
];
const WALLPAPER_PROCESSES = ['swww-daemon', 'swww', 'swaybg', 'hyprpaper', 'wpaperd', 'mpvpaper'];
const NOTIFICATION_PROCESSES = ['swaync', 'dunst', 'mako', 'fnott'];
const IDLE_PROCESSES = ['hypridle', 'swayidle'];
const LOCK_PROCESSES = ['swaylock', 'hyprlock'];
const PROCESS_DAEMON_MAP = {'swww': 'swww-daemon'};
const SERVICE_DOT_COLORS = {running: '#8cc85f', stopped: '#e85555', duplicates: '#e8c855', none: '#888888', optional_stopped: '#e8c855'};
const CATEGORY_LABELS = {wallpaper: 'Wallpaper', notifications: 'Notifications', idle: 'Idle', lock: 'Lock'};
const OPTIONAL_PROCESSES = new Set(['swaync', 'swayidle', 'swaybg', 'swaylock']);
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const HORIZONTAL_DIRECTION_TOKENS = new Set(['l', 'r', 'left', 'right', 'horizontal', 'horiz', 'h']);
const VERTICAL_DIRECTION_TOKENS = new Set(['u', 'd', 'up', 'down', 'vertical', 'vert', 'v']);

function toText(value) {
    return String(value ?? '').trim();
}

function toLower(value) {
    return toText(value).toLowerCase();
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function unquote(value) {
    return toText(value).replace(/^['"`]+|['"`]+$/g, '');
}

function basenameToken(token) {
    return unquote(token).split('/').pop()?.replace(/[;,]+$/, '') || '';
}

function splitCommandTokens(command) {
    return toLower(command)
        .split(/[|\s]+/)
        .map(basenameToken)
        .filter(Boolean);
}

function includesAny(text, needles) {
    return needles.some((needle) => text.includes(needle));
}

function countMatches(text, needles, weight = 1) {
    return needles.reduce((score, needle) => score + (text.includes(needle) ? weight : 0), 0);
}

function normalizeHotkeys(hotkeys, hotkeyService, themePath) {
    return asArray(hotkeys).filter(Boolean).map((hotkey) => {
        const modifiers = hotkeyService?.standardizeModifiers?.(hotkey.modifiers, themePath) ?? asArray(hotkey.modifiers);
        const combo = hotkeyService?.formatDisplayKeyCombo?.(modifiers, hotkey.key)
            || hotkey.displayKeyCombo
            || '';
        const dispatcher = toLower(hotkey.dispatcher);
        const args = toText(hotkey.args);
        return {
            combo,
            dispatcher,
            args,
            text: toLower(`${dispatcher} ${args}`),
            command: toLower(args),
            tokens: splitCommandTokens(args),
            source: hotkey
        };
    });
}

function commandScoreFromTokens(tokens, values) {
    const valuesSet = new Set(values);
    return tokens.reduce((score, token, index) => {
        const matched = valuesSet.has(token);
        return score + (matched ? (index === 0 ? 8 : 5) : 0);
    }, 0);
}

function comboBias(combo, needs = []) {
    const lowerCombo = toLower(combo);
    return needs.reduce((score, need) => score + (lowerCombo.includes(need) ? 0.5 : 0), 0);
}

function pickBest(records, scorer, preferredComboParts = []) {
    let best = null;
    let bestScore = 0;
    records.forEach((record) => {
        const score = scorer(record) + comboBias(record.combo, preferredComboParts);
        if (score > bestScore) {
            bestScore = score;
            best = record;
        }
    });
    return best;
}

function stateEntry(record, fallback = 'not found') {
    return record
        ? {hotkey: record.combo || fallback, command: record.dispatcher === 'exec' ? record.args : toText(`${record.dispatcher} ${record.args}`)}
        : {hotkey: fallback, command: fallback};
}

function orientationFromDirection(direction) {
    const value = toLower(direction).replace(/[^a-z]/g, '');
    switch (true) {
    case HORIZONTAL_DIRECTION_TOKENS.has(value):
        return 'horizontal';
    case VERTICAL_DIRECTION_TOKENS.has(value):
        return 'vertical';
    default:
        return '';
    }
}

function firstPositiveInteger(value) {
    const match = toText(value).match(/\d+/);
    switch (true) {
    case !match:
        return '';
    default: {
        const count = Number.parseInt(match[0], 10);
        return Number.isFinite(count) && count > 0 ? String(count) : '';
    }
    }
}

function stripConfComment(line) {
    return toText(line.split('#')[0]);
}

function readTextFile(path) {
    const [ok, data] = GLib.file_get_contents(path) || [];
    return ok && data ? decodeBytes(data) : '';
}

function pgrepCount(process) {
    return tryOrDefault('pgrepCount', () => {
        const result = GLib.spawn_command_line_sync(`pgrep -x ${process}`);
        const ok = result?.[0];
        const stdout = result?.[1];
        const output = ok && stdout ? decodeBytes(stdout).trim() : '';
        return output ? output.split('\n').filter(Boolean).length : 0;
    }, 0);
}

function t(ctx, key, params = null) {
    return translateWithFallback((k, p) => ctx?.translate?.(k, p), key, params);
}

export function applyThemeSelectorViewCurrentState(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewCurrentState.prototype);
}

class ThemeSelectorViewCurrentState {
    formatSwipeOrientation(value) {
        switch (toLower(value)) {
        case 'horizontal':
            return t(this, 'CURRENT_STATE_SWIPE_HORIZONTAL');
        case 'vertical':
            return t(this, 'CURRENT_STATE_SWIPE_VERTICAL');
        case 'disabled':
            return t(this, 'CURRENT_STATE_SWIPE_DISABLED');
        case 'not specified':
            return t(this, 'CURRENT_STATE_SWIPE_NOT_SPECIFIED');
        default:
            return t(this, 'CURRENT_STATE_SWIPE_NOT_FOUND');
        }
    }

    formatSwipeTouches(value) {
        const normalized = toLower(value);
        switch (true) {
        case /^\d+$/.test(toText(value)):
            return toText(value);
        case normalized === 'not specified':
            return t(this, 'CURRENT_STATE_SWIPE_NOT_SPECIFIED');
        default:
            return t(this, 'CURRENT_STATE_SWIPE_NOT_FOUND');
        }
    }

    getCurrentStateTheme() {
        const store = this.controller?.store;
        const settingsTheme = this.controller?.settingsService?.getCurrentTheme?.() || '';
        const currentTheme = toText(store?.get?.('currentTheme') || settingsTheme);
        const selectedTheme = store?.get?.('selectedTheme');
        const isSelectedLocal = selectedTheme && toLower(selectedTheme.source || 'local') !== 'network';
        const localFromStore = asArray(store?.get?.('localThemes')).find(theme => theme?.name === currentTheme) || null;
        const themeRepository = this.tryGetService('themeRepository') || this.controller?.themeRepository;
        const loadedTheme = !localFromStore && currentTheme && typeof themeRepository?.loadLocalTheme === 'function'
            ? themeRepository.loadLocalTheme(currentTheme)
            : null;
        const theme = isSelectedLocal ? selectedTheme : (localFromStore || loadedTheme);
        const themeName = toText(theme?.name || currentTheme);
        const basePath = toText(themeRepository?.basePath || `${GLib.get_home_dir()}/.config/themes`);
        const themePath = toText(theme?.path || (themeName ? `${basePath}/${themeName}` : ''));
        return themePath && GLib.file_test(themePath, GLib.FileTest.IS_DIR)
            ? {name: themeName, path: themePath}
            : null;
    }

    readThemeHotkeys(themePath) {
        const hotkeyService = this.tryGetService('hotkeyService');
        const parsed = hotkeyService?.parseThemeOriginals?.(themePath, {includeGenerated: false}) || [];
        return normalizeHotkeys(parsed, hotkeyService, themePath);
    }

    detectSwipeOrientation(themePath) {
        const hotkeyService = this.tryGetService('hotkeyService');
        const confFiles = [...new Set(asArray(hotkeyService?.findAllConfFiles?.(themePath)).filter(Boolean))];
        let explicitLegacyDirection = '';
        let hasLegacySwipeToggle = false;
        let hasLegacySwipeDisabled = false;
        let workspaceAnimationOrientation = '';

        for (const confFile of confFiles) {
            for (const rawLine of readTextFile(confFile).split('\n')) {
                const line = stripConfComment(rawLine);
                switch (true) {
                case !line:
                    continue;
                default:
                    break;
                }

                const swipeMatch = line.match(/^workspace_swipe\s*=\s*(.+)$/i);
                switch (true) {
                case Boolean(swipeMatch): {
                    const value = toLower(swipeMatch[1]).split(/[\s,;]+/)[0];
                    const direction = orientationFromDirection(value);
                    direction && (explicitLegacyDirection = direction);
                    TRUE_VALUES.has(value) && (hasLegacySwipeToggle = true);
                    FALSE_VALUES.has(value) && (hasLegacySwipeDisabled = true);
                    break;
                }
                default:
                    break;
                }
                const swipeDirectionMatch = line.match(/^workspace_swipe_direction\s*=\s*(.+)$/i);
                switch (true) {
                case Boolean(swipeDirectionMatch): {
                    const direction = orientationFromDirection(swipeDirectionMatch[1]);
                    direction && (explicitLegacyDirection = direction);
                    break;
                }
                default:
                    break;
                }
                const workspaceAnimationMatch = line.match(/^animation\s*=\s*workspaces\s*,.*\b(slidevert|slide)\b/i);
                switch (true) {
                case Boolean(workspaceAnimationMatch):
                    workspaceAnimationOrientation = workspaceAnimationMatch[1].toLowerCase() === 'slidevert'
                        ? 'vertical'
                        : 'horizontal';
                    break;
                default:
                    break;
                }

                const gestureMatch = line.match(/^gesture\s*=\s*([^,]+),\s*([^,]+),\s*(.+)$/i);
                switch (true) {
                case !gestureMatch:
                    continue;
                default:
                    break;
                }
                const action = toLower(gestureMatch[3]);
                switch (true) {
                case !action.includes('workspace'):
                    continue;
                default:
                    break;
                }
                const orientation = orientationFromDirection(gestureMatch[2]);
                switch (true) {
                case Boolean(orientation):
                    return orientation;
                default:
                    break;
                }
            }
        }

        switch (true) {
        case Boolean(explicitLegacyDirection):
            return explicitLegacyDirection;
        case Boolean(workspaceAnimationOrientation):
            return workspaceAnimationOrientation;
        case hasLegacySwipeDisabled:
            return 'disabled';
        case hasLegacySwipeToggle:
            return 'not specified';
        default:
            return 'not found';
        }
    }

    detectSwipeTouches(themePath) {
        const hotkeyService = this.tryGetService('hotkeyService');
        const confFiles = [...new Set(asArray(hotkeyService?.findAllConfFiles?.(themePath)).filter(Boolean))];
        let explicitFingers = '';
        let gestureFingers = '';
        let hasWorkspaceSwipeSetting = false;

        for (const confFile of confFiles) {
            for (const rawLine of readTextFile(confFile).split('\n')) {
                const line = stripConfComment(rawLine);
                switch (true) {
                case !line:
                    continue;
                default:
                    break;
                }

                const swipeMatch = line.match(/^workspace_swipe\s*=\s*(.+)$/i);
                switch (true) {
                case Boolean(swipeMatch): {
                    const value = toLower(swipeMatch[1]).split(/[\s,;]+/)[0];
                    switch (true) {
                    case TRUE_VALUES.has(value):
                    case FALSE_VALUES.has(value):
                        hasWorkspaceSwipeSetting = true;
                        break;
                    default:
                        break;
                    }
                    break;
                }
                default:
                    break;
                }

                const swipeFingersMatch = line.match(/^workspace_swipe_fingers\s*=\s*(.+)$/i);
                switch (true) {
                case Boolean(swipeFingersMatch): {
                    const count = firstPositiveInteger(swipeFingersMatch[1]);
                    count && (explicitFingers = count);
                    break;
                }
                default:
                    break;
                }

                const gestureMatch = line.match(/^gesture\s*=\s*([^,]+),\s*([^,]+),\s*(.+)$/i);
                switch (true) {
                case !gestureMatch:
                    continue;
                default:
                    break;
                }
                const action = toLower(gestureMatch[3]);
                switch (true) {
                case !action.includes('workspace'):
                    continue;
                default:
                    break;
                }
                const count = firstPositiveInteger(gestureMatch[1]);
                count && (gestureFingers = count);
            }
        }

        switch (true) {
        case Boolean(explicitFingers):
            return explicitFingers;
        case Boolean(gestureFingers):
            return gestureFingers;
        case hasWorkspaceSwipeSetting:
            return 'not specified';
        default:
            return 'not found';
        }
    }

    detectManualResizeAvailability(themePath, records = []) {
        const hotkeyService = this.tryGetService('hotkeyService');
        const confFiles = [...new Set(asArray(hotkeyService?.findAllConfFiles?.(themePath)).filter(Boolean))];
        let resizeOnBorder = '';

        for (const confFile of confFiles) {
            for (const rawLine of readTextFile(confFile).split('\n')) {
                const line = stripConfComment(rawLine);
                switch (true) {
                case !line:
                    continue;
                default:
                    break;
                }
                const resizeMatch = line.match(/^resize_on_border\s*=\s*(.+)$/i);
                switch (true) {
                case Boolean(resizeMatch): {
                    const value = toLower(resizeMatch[1]).split(/[\s,;]+/)[0];
                    switch (true) {
                    case TRUE_VALUES.has(value):
                        resizeOnBorder = 'true';
                        break;
                    case FALSE_VALUES.has(value):
                        resizeOnBorder = 'false';
                        break;
                    default:
                        break;
                    }
                    break;
                }
                default:
                    break;
                }
            }
        }

        const resizeHotkey = pickBest(records, (record) => {
            const isResizeDispatcher = ['resizewindow', 'resizeactive'].includes(record.dispatcher);
            const isResizeExec = record.dispatcher === 'exec' && includesAny(record.command, RESIZE_WINDOW_COMMAND_KEYWORDS);
            const isResize = isResizeDispatcher || isResizeExec;
            const isMouseDrag = toLower(record.combo).includes('mouse')
                || toLower(record.source?.bindType || '').startsWith('bindm')
                || toLower(record.source?.key || '').startsWith('mouse:');
            switch (true) {
            case isResize && isMouseDrag:
                return 30;
            case isResize:
                return 18;
            default:
                return 0;
            }
        }, ['super', 'mouse']);

        const isAvailable = resizeOnBorder === 'true' || Boolean(resizeHotkey);
        const command = resizeOnBorder === 'true'
            ? 'resize_on_border = true'
            : resizeOnBorder === 'false'
                ? 'resize_on_border = false'
                : (resizeHotkey?.dispatcher === 'exec' ? resizeHotkey?.args : toText(`${resizeHotkey?.dispatcher || ''} ${resizeHotkey?.args || ''}`)).trim();

        return {
            available: isAvailable,
            command: command || '-'
        };
    }

    parseExecOnceLines(themePath) {
        const hotkeyService = this.tryGetService('hotkeyService');
        const confFiles = [...new Set(asArray(hotkeyService?.findAllConfFiles?.(themePath)).filter(Boolean))];
        const lines = [];
        for (const confFile of confFiles) {
            for (const rawLine of readTextFile(confFile).split('\n')) {
                const line = stripConfComment(rawLine);
                const match = line.match(/^\s*exec(?:-once)?\s*=\s*(.+)$/i);
                match && lines.push(toText(match[1]));
            }
        }
        return lines;
    }

    detectCategoryService(category, execLines, themePath) {
        for (const process of category.processes) {
            const line = execLines.find(l => toLower(l).includes(process));
            switch (true) {
            case Boolean(line): {
                const daemon = PROCESS_DAEMON_MAP[process] || process;
                return {category: category.id, process: daemon, execLine: daemon !== process ? daemon : line, ...this.buildServiceStatus(daemon)};
            }
            default:
                continue;
            }
        }
        for (const process of category.processes) {
            const count = pgrepCount(process);
            switch (true) {
            case count > 0:
                return {category: category.id, process, execLine: process, status: count > 1 ? 'duplicates' : 'running', pidCount: count};
            default:
                continue;
            }
        }
        switch (true) {
        case Boolean(themePath):
            for (const process of category.processes) {
                const found = this.themeReferencesProcess(themePath, process);
                switch (true) {
                case found: {
                    const daemon = PROCESS_DAEMON_MAP[process] || process;
                    return {category: category.id, process: daemon, execLine: daemon, ...this.buildServiceStatus(daemon)};
                }
                default:
                    continue;
                }
            }
            break;
        default:
            break;
        }
        return null;
    }

    themeReferencesProcess(themePath, processName) {
        return tryOrDefault('themeReferencesProcess', () => {
            const [ok, stdout] = GLib.spawn_command_line_sync(`grep -rl --include='*.sh' --include='*.conf' --include='*.py' --include='*.toml' '${processName}' '${themePath}'`);
            return ok && decodeBytes(stdout).trim().length > 0;
        }, false);
    }

    buildServiceStatus(process) {
        const count = pgrepCount(process);
        return {
            status: count === 0 ? 'stopped' : count > 1 ? 'duplicates' : 'running',
            pidCount: count
        };
    }

    detectAndCheckServices(themePath) {
        const execLines = this.parseExecOnceLines(themePath);
        const categories = [
            {id: 'wallpaper', processes: WALLPAPER_PROCESSES},
            {id: 'notifications', processes: NOTIFICATION_PROCESSES},
            {id: 'idle', processes: IDLE_PROCESSES},
            {id: 'lock', processes: LOCK_PROCESSES}
        ];
        this._previousServices = this._previousServices || [];
        const services = [];
        for (const category of categories) {
            let detected = this.detectCategoryService(category, execLines, themePath);
            switch (true) {
            case Boolean(detected):
                break;
            default: {
                const prev = this._previousServices.find(s => s.category === category.id);
                switch (true) {
                case Boolean(prev):
                    detected = {category: prev.category, process: prev.process, execLine: prev.execLine, ...this.buildServiceStatus(prev.process)};
                    break;
                default: {
                    const alts = [...new Set(category.processes.map(p => PROCESS_DAEMON_MAP[p] || p))];
                    detected = {category: category.id, process: null, status: 'none', pidCount: 0, alternatives: alts};
                    break;
                }
                }
                break;
            }
            }
            services.push(detected);
        }
        this._previousServices = services.filter(s => s.status !== 'none').map(s => ({category: s.category, process: s.process, execLine: s.execLine}));
        return services;
    }

    restartFirstAvailable(alternatives, onComplete) {
        for (const process of alternatives) {
            const installed = tryOrDefault('restartFirstAvailable', () => {
                const [ok, stdout] = GLib.spawn_command_line_sync(`which ${process}`);
                return ok && decodeBytes(stdout).trim().length > 0;
            }, false);
            switch (true) {
            case installed:
                this.restartService({process, execLine: process}, onComplete);
                return;
            default:
                continue;
            }
        }
        onComplete?.();
    }

    restartService(service, onComplete) {
        tryRun('restartService:kill', () => GLib.spawn_command_line_sync(`pkill -x ${service.process}`));
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            tryRun('restartService:spawn', () => {
                const [ok, pid] = GLib.spawn_async(
                    null,
                    ['bash', '-c', service.execLine],
                    null,
                    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                    null
                );
                ok && pid && GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {});
            });
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                onComplete?.();
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    checkServicesForAlert(themePath) {
        const services = this.detectAndCheckServices(themePath);
        return services.some(s => s.status === 'stopped' && s.process === 'swww-daemon');
    }

    refreshServiceAlert() {
        const theme = this.getCurrentStateTheme();
        switch (true) {
        case !theme:
            this.bottomBarComponent?.setInfoButtonAlert?.(false);
            return;
        default: {
            const hasIssues = this.checkServicesForAlert(theme.path);
            this.bottomBarComponent?.setInfoButtonAlert?.(hasIssues);
        }
        }
    }

    collectCurrentState(themePath) {
        const records = this.readThemeHotkeys(themePath);

        const shortcuts = pickBest(
            records,
            (record) => (
                record.dispatcher !== 'exec'
                    ? 0
                    : countMatches(record.command, SHORTCUTS_KEYWORDS, 4)
                        + countMatches(record.command, DIRECT_LAUNCHER_KEYWORDS, 2)
                        + (includesAny(record.command, ['ags', 'eww']) ? 2 : 0)
                        + (includesAny(record.command, ['launcher', 'menu']) ? 1 : 0)
            ),
            ['super', 'enter']
        );

        const terminal = pickBest(
            records,
            (record) => record.dispatcher === 'exec'
                ? commandScoreFromTokens(record.tokens, TERMINAL_COMMANDS)
                : 0,
            ['super', 't']
        );

        const fileManager = pickBest(
            records,
            (record) => record.dispatcher === 'exec'
                ? commandScoreFromTokens(record.tokens, FILE_MANAGER_COMMANDS)
                : 0,
            ['super', 'e']
        );

        const screenshot = pickBest(
            records,
            (record) => (
                record.dispatcher !== 'exec'
                    ? 0
                    : countMatches(record.command, SCREENSHOT_KEYWORDS, 3)
                        + (includesAny(record.command, ['grimblast', 'hyprshot', 'flameshot', 'spectacle']) ? 6 : 0)
            ),
            ['super', 'shift', 's']
        );

        const closeWindow = pickBest(
            records,
            (record) => {
                switch (true) {
                case record.dispatcher === 'killactive':
                    return 30;
                case record.dispatcher === 'closewindow':
                    return 24;
                case record.dispatcher !== 'exec':
                    return 0;
                default:
                    return countMatches(record.command, CLOSE_COMMAND_KEYWORDS, 6)
                        + (record.command.includes('hyprctl') && record.command.includes('kill') ? 3 : 0);
                }
            },
            ['super', 'q']
        );

        const fullscreenWindow = pickBest(
            records,
            (record) => {
                const isNativeFullscreen = record.dispatcher === 'fullscreen';
                const isExecFullscreen = record.dispatcher === 'exec'
                    && record.command.includes('hyprctl')
                    && includesAny(record.command, FULLSCREEN_COMMAND_KEYWORDS);
                const isModeOne = toLower(record.args).split(/[\s,;]+/)[0] === '1';
                switch (true) {
                case isNativeFullscreen && !isModeOne:
                    return 36;
                case isExecFullscreen && /\bfullscreen\s+0\b/.test(record.command):
                    return 30;
                case isNativeFullscreen:
                    return 18;
                case isExecFullscreen:
                    return 14;
                default:
                    return 0;
                }
            },
            ['super', 'f']
        );

        const singleWindow = pickBest(
            records,
            (record) => {
                const isModeOneFullscreen = record.dispatcher === 'fullscreen'
                    && toLower(record.args).split(/[\s,;]+/)[0] === '1';
                const isPseudo = record.dispatcher === 'pseudo'
                    || (record.dispatcher === 'exec' && record.command.includes('dispatch pseudo'));
                const isToggleSplit = record.dispatcher === 'togglesplit'
                    || (record.dispatcher === 'exec' && record.command.includes('dispatch togglesplit'));
                const isExecSingleFullscreen = record.dispatcher === 'exec'
                    && record.command.includes('hyprctl')
                    && includesAny(record.command, SINGLE_WINDOW_COMMAND_KEYWORDS)
                    && /\bfullscreen\s+1\b/.test(record.command);
                switch (true) {
                case isModeOneFullscreen:
                    return 38;
                case isExecSingleFullscreen:
                    return 30;
                case isPseudo:
                    return 24;
                case isToggleSplit:
                    return 18;
                default:
                    return 0;
                }
            },
            ['super', 'd']
        );

        const moveWindow = pickBest(
            records,
            (record) => {
                const isNativeMove = record.dispatcher === 'movewindow';
                const isExecMove = record.dispatcher === 'exec' && includesAny(record.command, MOVE_WINDOW_COMMAND_KEYWORDS);
                const isMove = isNativeMove || isExecMove;
                const isMouseDrag = toLower(record.combo).includes('mouse')
                    || toLower(record.source?.bindType || '').startsWith('bindm')
                    || toLower(record.source?.key || '').startsWith('mouse:');
                switch (true) {
                case isMove && isMouseDrag:
                    return 36;
                case isMove:
                    return 18;
                default:
                    return 0;
                }
            },
            ['super', 'mouse']
        );

        const moveToWorkspace = pickBest(
            records,
            (record) => {
                const isNativeMove = record.dispatcher === 'movetoworkspace'
                    || record.dispatcher === 'movetoworkspacesilent';
                const isExecMove = record.dispatcher === 'exec'
                    && includesAny(record.command, MOVE_TO_WORKSPACE_COMMAND_KEYWORDS);
                switch (true) {
                case isNativeMove:
                    return 30;
                case isExecMove:
                    return 18;
                default:
                    return 0;
                }
            },
            ['super', 'shift']
        );

        const manualResize = this.detectManualResizeAvailability(themePath, records);

        return {
            services: this.detectAndCheckServices(themePath),
            shortcuts: stateEntry(shortcuts),
            terminal: stateEntry(terminal),
            fileManager: stateEntry(fileManager),
            screenshot: stateEntry(screenshot),
            closeWindow: stateEntry(closeWindow),
            swipeOrientation: this.detectSwipeOrientation(themePath),
            swipeTouches: this.detectSwipeTouches(themePath),
            focusControls: {
                fullscreenWindow: stateEntry(fullscreenWindow),
                singleWindow: stateEntry(singleWindow),
                moveWindow: stateEntry(moveWindow),
                moveToWorkspace: (() => {
                    const entry = stateEntry(moveToWorkspace);
                    return {
                        hotkey: entry.hotkey.replace(/\s*\d+\s*$/, ' N'),
                        command: entry.command.replace(/\s+\d+\s*$/, ' N')
                    };
                })(),
                manualResize
            }
        };
    }

    createCurrentStateCell(text, className, {selectable = false, wrap = false, xalign = 0} = {}) {
        const label = new Gtk.Label({
            label: toText(text) || '-',
            xalign,
            selectable,
            wrap
        });
        label.get_style_context().add_class(className);
        return label;
    }

    stateNotFoundLabel(value) {
        return toLower(value) === 'not found' ? t(this, 'CURRENT_STATE_NOT_FOUND') : value;
    }

    createCurrentStateGrid(rows = []) {
        const grid = new Gtk.Grid({
            column_spacing: 18,
            row_spacing: 8,
            hexpand: true,
            vexpand: false
        });
        grid.get_style_context().add_class('current-state-grid');
        [
            [t(this, 'CURRENT_STATE_ACTION_HEADER'), 'current-state-table-head'],
            [t(this, 'CURRENT_STATE_HOTKEY_HEADER'), 'current-state-table-head'],
            [t(this, 'CURRENT_STATE_COMMAND_HEADER'), 'current-state-table-head']
        ].forEach(([title, className], column) => {
            grid.attach(this.createCurrentStateCell(title, className), column, 0, 1, 1);
        });

        rows.forEach(([action, hotkey, command], rowIndex) => {
            const y = rowIndex + 1;
            const actionLabel = this.createCurrentStateCell(action, 'current-state-action');
            const hotkeyLabel = this.createCurrentStateCell(this.stateNotFoundLabel(hotkey), 'current-state-hotkey', {selectable: true, wrap: true});
            const commandLabel = this.createCurrentStateCell(this.stateNotFoundLabel(command || '-'), 'current-state-command', {selectable: true, wrap: true});
            commandLabel.set_hexpand(true);
            commandLabel.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            commandLabel.set_max_width_chars(44);
            grid.attach(actionLabel, 0, y, 1, 1);
            grid.attach(hotkeyLabel, 1, y, 1, 1);
            grid.attach(commandLabel, 2, y, 1, 1);
        });

        return grid;
    }

    showCurrentStatePopup() {
        const theme = this.getCurrentStateTheme();
        if (!theme) {
            this.showNotification(t(this, 'CURRENT_STATE_NO_ACTIVE_LOCAL_THEME'), 'info');
            return;
        }

        this.currentStateDialog?.destroy?.();

        const state = this.collectCurrentState(theme.path);
        const dialog = new Gtk.Dialog({
            title: t(this, 'CURRENT_STATE_TITLE'),
            transient_for: this.window || null,
            modal: true,
            resizable: false,
            default_width: 780,
            window_position: Gtk.WindowPosition.CENTER
        });
        dialog.get_style_context().add_class('config-dialog');
        dialog.get_style_context().add_class('current-state-dialog');
        dialog.set_keep_above?.(true);
        dialog.connect('destroy', () => {
            this.currentStateDialog = null;
        });
        dialog.connect('response', () => dialog.destroy());
        const closeBtn = dialog.add_button(this.translate('CLOSE'), Gtk.ResponseType.CLOSE);
        closeBtn.get_style_context().add_class('current-state-close-btn');
        addPointerCursor(closeBtn);
        const actionArea = dialog.get_action_area?.();
        actionArea?.set_spacing?.(8);
        actionArea?.set_margin_top?.(0);
        actionArea?.set_margin_bottom?.(10);
        actionArea?.set_margin_left?.(16);
        actionArea?.set_margin_right?.(16);
        this.currentStateDialog = dialog;

        const content = dialog.get_content_area();
        content.get_style_context().add_class('current-state-content');
        content.set_spacing(12);
        content.set_margin_top(16);
        content.set_margin_bottom(2);
        content.set_margin_left(16);
        content.set_margin_right(16);

        const titleLabel = new Gtk.Label({
            label: t(this, 'CURRENT_STATE_TITLE'),
            xalign: 0
        });
        titleLabel.get_style_context().add_class('current-state-title');
        titleLabel.set_margin_top(4);
        titleLabel.set_margin_start(10);
        content.pack_start(titleLabel, false, false, 0);

        const riceName = GLib.markup_escape_text(theme.name || 'unknown', -1);
        const riceLabel = new Gtk.Label({
            label: `rice: <span color="#8cc85f">${riceName}</span>`,
            use_markup: true,
            xalign: 0
        });
        riceLabel.get_style_context().add_class('current-state-rice');
        riceLabel.set_margin_start(10);
        content.pack_start(riceLabel, false, false, 0);

        if (state.services.length > 0) {
            const servicesBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 3
            });
            servicesBox.set_margin_start(10);
            servicesBox.set_margin_end(10);
            servicesBox.set_margin_top(2);
            servicesBox.get_style_context().add_class('current-state-services');

            for (const service of state.services) {
                const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
                row.get_style_context().add_class('current-state-service-row');

                switch (true) {
                case service.status === 'none': {
                    const dotLabel = new Gtk.Label({label: `<span color="${SERVICE_DOT_COLORS.none}">\u25CB</span>`, use_markup: true});
                    dotLabel.get_style_context().add_class('current-state-service-dot');
                    const categoryName = CATEGORY_LABELS[service.category] || service.category;
                    const altsText = (service.alternatives || []).join(', ');
                    const nameLabel = new Gtk.Label({label: categoryName, xalign: 0});
                    nameLabel.get_style_context().add_class('current-state-service-name');
                    const statusLabel = new Gtk.Label({label: `${t(this, 'CURRENT_STATE_SERVICE_NOT_FOUND')} (${altsText})`, xalign: 0});
                    statusLabel.get_style_context().add_class('current-state-service-status');
                    statusLabel.get_style_context().add_class('current-state-service-none');
                    row.pack_start(dotLabel, false, false, 0);
                    row.pack_start(nameLabel, false, false, 0);
                    row.pack_start(statusLabel, false, false, 0);
                    const spacer = new Gtk.Box({hexpand: true});
                    const restartBtn = new Gtk.Button();
                    restartBtn.set_image(Gtk.Image.new_from_icon_name('view-refresh-symbolic', Gtk.IconSize.MENU));
                    restartBtn.get_style_context().add_class('current-state-restart-btn');
                    restartBtn.set_tooltip_text(t(this, 'CURRENT_STATE_SERVICE_RESTART_TOOLTIP'));
                    addPointerCursor(restartBtn);
                    restartBtn.connect('clicked', () => {
                        restartBtn.set_sensitive(false);
                        this.restartFirstAvailable(service.alternatives || [], () => {
                            const started = (service.alternatives || []).find(p => pgrepCount(p) > 0);
                            switch (true) {
                            case Boolean(started): {
                                dotLabel.set_markup(`<span color="${SERVICE_DOT_COLORS.running}">\u25CF</span>`);
                                nameLabel.set_label(started);
                                statusLabel.set_label(t(this, 'CURRENT_STATE_SERVICE_RUNNING'));
                                statusLabel.get_style_context().remove_class('current-state-service-none');
                                statusLabel.get_style_context().add_class('current-state-service-running');
                                restartBtn.set_visible(false);
                                spacer.set_visible(false);
                                break;
                            }
                            default:
                                restartBtn.set_sensitive(true);
                                break;
                            }
                        });
                    });
                    row.pack_start(spacer, true, true, 0);
                    row.pack_start(restartBtn, false, false, 0);
                    break;
                }
                default: {
                    const isOptional = OPTIONAL_PROCESSES.has(service.process);
                    const dotColorKey = (service.status === 'stopped' && isOptional) ? 'optional_stopped' : service.status;
                    const dotColor = SERVICE_DOT_COLORS[dotColorKey] || SERVICE_DOT_COLORS.stopped;
                    const dotLabel = new Gtk.Label({label: `<span color="${dotColor}">\u25CF</span>`, use_markup: true});
                    dotLabel.get_style_context().add_class('current-state-service-dot');

                    const processLabel = new Gtk.Label({label: service.process, xalign: 0});
                    processLabel.get_style_context().add_class('current-state-service-name');

                    const statusText = service.status === 'running'
                        ? t(this, 'CURRENT_STATE_SERVICE_RUNNING')
                        : service.status === 'stopped'
                            ? t(this, 'CURRENT_STATE_SERVICE_STOPPED')
                            : t(this, 'CURRENT_STATE_SERVICE_DUPLICATES', {count: String(service.pidCount)});
                    const statusLabel = new Gtk.Label({label: statusText, xalign: 0});
                    statusLabel.get_style_context().add_class('current-state-service-status');
                    const statusClass = (service.status === 'stopped' && isOptional) ? 'current-state-service-duplicates' : `current-state-service-${service.status}`;
                    statusLabel.get_style_context().add_class(statusClass);

                    row.pack_start(dotLabel, false, false, 0);
                    row.pack_start(processLabel, false, false, 0);
                    row.pack_start(statusLabel, false, false, 0);

                    if (service.status === 'stopped') {
                        const spacer = new Gtk.Box({hexpand: true});
                        const restartBtn = new Gtk.Button();
                        restartBtn.set_image(Gtk.Image.new_from_icon_name('view-refresh-symbolic', Gtk.IconSize.MENU));
                        restartBtn.get_style_context().add_class('current-state-restart-btn');
                        restartBtn.set_tooltip_text(t(this, 'CURRENT_STATE_SERVICE_RESTART_TOOLTIP'));
                        addPointerCursor(restartBtn);
                        restartBtn.connect('clicked', () => {
                            restartBtn.set_sensitive(false);
                            this.restartService(service, () => {
                                const newCount = pgrepCount(service.process);
                                const newStatus = newCount === 0 ? 'stopped' : newCount > 1 ? 'duplicates' : 'running';
                                const newColor = SERVICE_DOT_COLORS[newStatus] || SERVICE_DOT_COLORS.stopped;
                                dotLabel.set_markup(`<span color="${newColor}">\u25CF</span>`);
                                const newText = newStatus === 'running'
                                    ? t(this, 'CURRENT_STATE_SERVICE_RUNNING')
                                    : newStatus === 'stopped'
                                        ? t(this, 'CURRENT_STATE_SERVICE_STOPPED')
                                        : t(this, 'CURRENT_STATE_SERVICE_DUPLICATES', {count: String(newCount)});
                                statusLabel.set_label(newText);
                                const ctx = statusLabel.get_style_context();
                                ctx.remove_class('current-state-service-stopped');
                                ctx.remove_class('current-state-service-running');
                                ctx.remove_class('current-state-service-duplicates');
                                ctx.add_class(`current-state-service-${newStatus}`);
                                switch (true) {
                                case newStatus === 'running':
                                    restartBtn.set_visible(false);
                                    spacer.set_visible(false);
                                    break;
                                default:
                                    restartBtn.set_sensitive(true);
                                    break;
                                }
                            });
                        });
                        row.pack_start(spacer, true, true, 0);
                        row.pack_start(restartBtn, false, false, 0);
                    }
                    break;
                }
                }

                servicesBox.pack_start(row, false, false, 0);
            }
            content.pack_start(servicesBox, false, false, 0);
        }

        const swipeBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        swipeBox.get_style_context().add_class('current-state-swipe-row');
        swipeBox.set_hexpand(true);
        swipeBox.set_margin_start(10);
        swipeBox.set_margin_end(10);
        const swipeLabel = this.createCurrentStateCell(
            t(this, 'CURRENT_STATE_SWIPE_LABEL'),
            'current-state-swipe-label'
        );
        const swipeValue = this.createCurrentStateCell(
            this.formatSwipeOrientation(state.swipeOrientation),
            'current-state-swipe-value'
        );
        const swipeSpacer = new Gtk.Box({hexpand: true});
        const swipeTouchesLabel = this.createCurrentStateCell(
            t(this, 'CURRENT_STATE_SWIPE_TOUCHES_LABEL'),
            'current-state-swipe-label'
        );
        swipeTouchesLabel.set_margin_start(18);
        const swipeTouchesValue = this.createCurrentStateCell(
            this.formatSwipeTouches(state.swipeTouches),
            'current-state-swipe-value'
        );
        swipeBox.pack_start(swipeLabel, false, false, 0);
        swipeBox.pack_start(swipeValue, false, false, 0);
        swipeBox.pack_start(swipeSpacer, true, true, 0);
        swipeBox.pack_start(swipeTouchesLabel, false, false, 0);
        swipeBox.pack_start(swipeTouchesValue, false, false, 0);
        content.pack_start(swipeBox, false, false, 0);

        const focusSubtitleLabel = new Gtk.Label({
            label: t(this, 'CURRENT_STATE_FOCUS_SUBTITLE'),
            xalign: 0
        });
        focusSubtitleLabel.get_style_context().add_class('current-state-subtitle');
        focusSubtitleLabel.set_margin_start(10);
        content.pack_start(focusSubtitleLabel, false, false, 0);

        const focusRows = [
            [
                t(this, 'CURRENT_STATE_ACTION_FULLSCREEN_WINDOW'),
                state.focusControls.fullscreenWindow.hotkey,
                state.focusControls.fullscreenWindow.command
            ],
            [
                t(this, 'CURRENT_STATE_ACTION_SINGLE_WINDOW'),
                state.focusControls.singleWindow.hotkey,
                state.focusControls.singleWindow.command
            ],
            [
                t(this, 'CURRENT_STATE_ACTION_MOVE_WINDOW'),
                state.focusControls.moveWindow.hotkey,
                state.focusControls.moveWindow.command
            ],
            [
                t(this, 'CURRENT_STATE_ACTION_MOVE_TO_WORKSPACE'),
                state.focusControls.moveToWorkspace.hotkey,
                state.focusControls.moveToWorkspace.command
            ],
            [
                t(this, 'CURRENT_STATE_ACTION_MANUAL_RESIZE'),
                state.focusControls.manualResize.available ? t(this, 'CURRENT_STATE_YES') : t(this, 'CURRENT_STATE_NO'),
                state.focusControls.manualResize.command
            ],
            [
                t(this, 'CURRENT_STATE_ACTION_CLOSE_FOCUSED_WINDOW'),
                state.closeWindow.hotkey,
                state.closeWindow.command
            ]
        ];
        const focusContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: false
        });
        focusContainer.set_margin_start(10);
        focusContainer.set_margin_end(10);
        focusContainer.get_style_context().add_class('current-state-scroll');
        focusContainer.pack_start(this.createCurrentStateGrid(focusRows), false, false, 0);
        content.pack_start(focusContainer, false, false, 0);

        const subtitleLabel = new Gtk.Label({
            label: t(this, 'CURRENT_STATE_SUBTITLE'),
            xalign: 0
        });
        subtitleLabel.get_style_context().add_class('current-state-subtitle');
        subtitleLabel.set_margin_start(10);
        content.pack_start(subtitleLabel, false, false, 0);

        const rows = [
            [t(this, 'CURRENT_STATE_ACTION_SHORTCUTS_LIST'), state.shortcuts.hotkey, state.shortcuts.command],
            [t(this, 'CURRENT_STATE_ACTION_OPEN_TERMINAL'), state.terminal.hotkey, state.terminal.command],
            [t(this, 'CURRENT_STATE_ACTION_OPEN_FILE_MANAGER'), state.fileManager.hotkey, state.fileManager.command],
            [t(this, 'CURRENT_STATE_ACTION_SCREENSHOT'), state.screenshot.hotkey, state.screenshot.command]
        ];
        const actionsContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: false
        });
        actionsContainer.set_margin_start(10);
        actionsContainer.set_margin_end(10);
        actionsContainer.get_style_context().add_class('current-state-scroll');
        actionsContainer.pack_start(this.createCurrentStateGrid(rows), false, false, 0);
        content.pack_start(actionsContainer, false, false, 0);

        const noteLabel = new Gtk.Label({
            label: t(this, 'CURRENT_STATE_NOTE'),
            xalign: 0
        });
        noteLabel.get_style_context().add_class('current-state-note');
        noteLabel.set_margin_start(10);
        noteLabel.set_margin_top(1);
        noteLabel.set_margin_bottom(0);
        content.pack_start(noteLabel, false, false, 0);

        dialog.show_all();
        dialog.present?.();
    }
}
