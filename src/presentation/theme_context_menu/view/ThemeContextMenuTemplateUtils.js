import GLib from 'gi://GLib';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';
import { loadTemplate, applyTemplate } from '../../../infrastructure/scripts/ScriptTemplateStore.js';

export const TEMPLATE_DIR = GLib.build_filenamev([GLib.get_current_dir(), 'assets', 'templates']);

export function getWebKit2() {
    return tryOrNull('getWebKit2', () => imports.gi.WebKit2);
}

export { loadTemplate, applyTemplate };
