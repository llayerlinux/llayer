import GLib from 'gi://GLib';
import { tryOrNull } from '../utils/ErrorUtils.js';

export const AUTO_DETECT_PARAMS = [
    'monitor',
    'input:kb_layout',
    'input:kb_variant',
    'input:kb_options'
];

export function readHyprctlOption(option) {
    const [ok, stdout] = tryOrNull(`readHyprctlOption.${option}`,
        () => GLib.spawn_command_line_sync(`hyprctl getoption ${option} -j`)) || [];
    if (!ok || !stdout || stdout.length === 0) return null;
    const value = tryOrNull(`readHyprctlOption.parse.${option}`, () => JSON.parse(new TextDecoder().decode(stdout)))?.str;
    return value && value !== '[[EMPTY]]' ? value : null;
}

export function buildMonitorConfigString(m) {
    return `${m.name || ''},${m.width || 1920}x${m.height || 1080}@${Math.round(m.refreshRate || 60)},${m.x || 0}x${m.y || 0},${m.scale || 1}`;
}
