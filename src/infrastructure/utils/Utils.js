import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { tryOrNull } from './ErrorUtils.js';

const toStringSafe = (value) => (value == null ? '' : String(value));
const toTrimmedString = (value) => toStringSafe(value).trim();
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function numericFromValue(value, parser = parseInt) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed ? parser(trimmed, 10) : NaN;
}

export function isObjectLike(value) {
    return !!value && typeof value === 'object';
}

export function isPlainObject(value) {
    return isObjectLike(value) && !Array.isArray(value);
}

export function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

export function ensurePlainObject(value) {
    return isPlainObject(value) ? value : {};
}

export function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null) ?? null;
}

export function processGtkEvents(maxIterations = 5) {
    tryOrNull('processGtkEvents', () => {
        const context = GLib.MainContext.default();
        let i = 0;
        while (context.pending() && i < maxIterations) {
            context.iteration(false);
            i++;
        }
    });
}

export function removeSourceSafe(sourceId) {
    const id = Number(sourceId) || 0;
    const context = GLib.MainContext.default?.();
    const source = (id > 0 && typeof context?.find_source_by_id === 'function')
        ? context.find_source_by_id(id)
        : (id > 0 ? true : null);
    source && GLib.source_remove(id);
    return 0;
}

export function parseId(value) {
    const n = numericFromValue(value);
    return Number.isNaN(n) ? null : n;
}

export function toTrimmedStrings(arr) {
    return arr.map(item => toTrimmedString(typeof item === 'string' ? item : (item || ''))).filter(s => s.length > 0);
}

export function standardizeStringArray(value) {
    const source = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
    return toTrimmedStrings(source);
}

const stripEdgeQuotes = (value) => {
    const text = toTrimmedString(value || '');
    const first = text[0];
    const last = text[text.length - 1];
    return ((first === '"' && last === '"') || (first === '\'' && last === '\'')) ? text.slice(1, -1) : text;
};

const STRING_LIST_HANDLERS = [
    [Array.isArray, toTrimmedStrings],
    [isPlainObject, (v) => Object.keys(v).filter(key => Boolean(v[key]))]
];

export function parseStringList(value) {
    const handler = STRING_LIST_HANDLERS.find(([test]) => test(value));
    if (handler) return handler[1](value);

    const trimmed = toTrimmedString(value ?? '');
    if (!trimmed) return [];

    const content = (trimmed.startsWith('[') && trimmed.endsWith(']')) ? trimmed.slice(1, -1) : trimmed;
    return toTrimmedStrings(content.split(/[,;\n]+/).map(stripEdgeQuotes));
}

export function isAutoApplyEnabled(settings) {
    const safe = (settings && typeof settings === 'object') ? settings : {};
    const hasProp = (prop) => hasOwn(safe, prop);
    return hasProp('applyNetworkThemesImmediately')
        ? !!safe.applyNetworkThemesImmediately
        : (hasProp('applyImmediately') ? safe.applyImmediately !== false : true);
}

export function standardizeNumber(value, defaultValue = 0) {
    const n = numericFromValue(value);
    return Number.isNaN(n) ? defaultValue : n;
}

export function standardizeOptionalNumber(value, requireNonNegative = false) {
    const n = numericFromValue(value, parseFloat);
    return Number.isFinite(n) && (!requireNonNegative || n >= 0) ? n : null;
}

export function toNonNegativeInt(value) {
    const n = numericFromValue(value);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.round(n));
}

export function toNonNegativeNumber(value, defaultValue = null) {
    const parsed = standardizeOptionalNumber(value, true);
    return parsed === null ? defaultValue : parsed;
}

export function toNonNegativeCount(value, defaultValue = 0) {
    const parsed = standardizeOptionalNumber(value, true);
    return parsed === null ? defaultValue : Math.round(parsed);
}

const LINK_PARSERS = {
    string: (link) => ({label: link.trim(), url: ''}),
    object: (link) => {
        const result = {label: link.label || link.name || '', url: link.url || link.link || ''};
        return result.label || result.url ? result : null;
    }
};

export function parseLink(link) {
    if (!link) return null;
    const parser = LINK_PARSERS[typeof link];
    return typeof parser === 'function' ? (parser(link) ?? null) : null;
}

export function applyParams(text, params) {
    const isValid = params && typeof params === 'object' && typeof text === 'string';
    return !isValid ? text : Object.keys(params).reduce((acc, key) => {
        const safeValue = toStringSafe(params[key]);
        return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), safeValue);
    }, text);
}

export function translateWithFallback(translatorFn, key, params = null) {
    const value = typeof translatorFn === 'function' ? translatorFn(key, params ?? undefined) : null;
    if (typeof value === 'string') return value;
    const canApplyParams = isPlainObject(params) && typeof key === 'string';
    return canApplyParams ? applyParams(key, params) : (typeof key === 'string' ? key : '');
}

export function getFromContainer(container, name) {
    return container.has(name) ? container.get(name) : null;
}

export function firstNonEmptyString(...values) {
    const result = values
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .find(v => v.length > 0);
    return result ?? null;
}

export function fileExists(path) {
    return path && typeof path === 'string' && Gio.File.new_for_path(path).query_exists(null);
}

export function isDir(path) {
    return path && typeof path === 'string' && GLib.file_test(path, GLib.FileTest.IS_DIR);
}

export function readJsonFileSafe(path) {
    const result = tryOrNull('readJsonFileSafe.read', () => GLib.file_get_contents(path));
    const [ok, contents] = result || [];
    return (result && ok && contents)
        ? tryOrNull('readJsonFileSafe.parse', () => JSON.parse(new TextDecoder('utf-8').decode(contents)))
        : null;
}

export function decodeBytes(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    const bytes = (data instanceof Uint8Array) ? data : Array.isArray(data) ? new Uint8Array(data) : null;
    return bytes ? new TextDecoder('utf-8').decode(bytes) : String(data);
}

export function parseServerAddress(url) {
    const value = url ? toTrimmedString(url) : '';
    return (!value.length || !/^https?:/i.test(value))
        ? null
        : (value.endsWith('/') ? value.slice(0, -1) : value);
}

export function getThemePath(themeName, {theme = null, basePath = null, defaultBase = null} = {}) {
    const themePath = theme && typeof theme.path === 'string' && theme.path.length > 0 ? theme.path : null;
    const themesBase = (typeof basePath === 'string' && basePath.length > 0)
        ? basePath
        : (defaultBase || `${GLib.get_home_dir()}/.config/themes`);

    return themePath || (themeName ? `${themesBase}/${themeName}` : themesBase);
}

export function normalizeThemeStats(source) {
    return {
        downloadCount: toNonNegativeCount(source.downloadCount, 0),
        averageInstallMs: toNonNegativeNumber(source.averageInstallMs, null),
        averageApplyMs: toNonNegativeNumber(source.averageApplyMs, null),
        installCount: toNonNegativeCount(source.installCount, 0),
        applyCount: toNonNegativeCount(source.applyCount, 0)
    };
}

export function assignNumberFields(target, source, keys = []) {
    if (!target || !source || !Array.isArray(keys)) return target;
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'number') target[key] = value;
    }
    return target;
}

function valuesEqual(a, b) {
    const bothArrays = Array.isArray(a) && Array.isArray(b);
    return !bothArrays
        ? a === b
        : (a.length === b.length && a.every((v, i) => valuesEqual(v, b[i])));
}

export function snapshotsEqual(a, b) {
    const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
    return [...keys].every(key => valuesEqual(a?.[key], b?.[key]));
}

function expandTilde(value, home) {
    if (!value.startsWith('~')) return value;
    const rest = value.slice(1);
    return !rest.length ? home : (rest.startsWith('/') ? `${home}${rest}` : `${home}/${rest}`);
}

function standardizeSlashes(value, preserveUNC = false) {
    let result = value.replace(/\\/g, '/');
    const protocolMatch = result.match(/^([A-Za-z]+:\/\/+)/);
    result = protocolMatch
        ? `${protocolMatch[1]}${result.slice(protocolMatch[1].length).replace(/\/{2,}/g, '/')}`
        : result.replace(/\/{2,}/g, '/');
    return preserveUNC ? `//${result.replace(/^\/+/, '')}` : result;
}

export function parseThemesPath(path, home) {
    const defaultPath = `${home}/.config/themes`,
        raw = (typeof path === 'string') ? path.trim() : '';
    if (!raw.length) return defaultPath;

    let value = raw.replace(/\$\{HOME\}/g, home).replace(/\$HOME/g, home);
    value = expandTilde(value, home);
    value = value.startsWith('file://') ? (Gio.File.new_for_uri(value).get_path() || value) : value;

    value = (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('//') || GLib.path_is_absolute(value))
        ? value : GLib.build_filenamev([home, value]);
    value = standardizeSlashes(value, raw.startsWith('//'));

    return (value.startsWith(home) || value.startsWith('/usr/share/themes')) ? value : defaultPath;
}
