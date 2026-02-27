import GLib from 'gi://GLib';
import { decodeBytes } from '../utils/Utils.js';

const TEMPLATE_DIR = GLib.build_filenamev([GLib.get_current_dir(), 'assets', 'templates']);

function createTemplatePath(fileName) {
    return GLib.build_filenamev([TEMPLATE_DIR, fileName]);
}

function loadTemplate(path) {
    const [ok, contents] = GLib.file_get_contents(path);
    return ok ? decodeBytes(contents) : null;
}

function applyTemplate(template, replacements = {}) {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.split(`{{${key}}}`).join(String(value));
    }
    return result;
}

function getCachedTemplate(path, cache = null) {
    const targetCache = cache || ScriptTemplateStoreCache.shared;
    return targetCache.has(path)
        ? targetCache.get(path)
        : (() => {
            const template = loadTemplate(path);
            targetCache.set(path, template);
            return template;
        })();
}

const ScriptTemplateStoreCache = {
    shared: new Map()
};

export {
    createTemplatePath,
    loadTemplate,
    applyTemplate,
    getCachedTemplate
};
