import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';

export function runByRecommendationType(rec, handlers = {}, fallback = null) {
    const handler = rec && handlers[rec.type];
    return typeof handler === 'function' ? handler(rec) : fallback;
}

export function standardizeModifiers(modifiers) {
    const modMap = {
        'super': 'SUPER',
        'shift': 'SHIFT',
        'ctrl': 'CTRL',
        'control': 'CTRL',
        'alt': 'ALT',
        '$mainmod': 'SUPER',
        'mod1': 'ALT',
        'mod4': 'SUPER'
    };
    const unique = new Set();
    const entries = Array.isArray(modifiers) ? modifiers : [];
    for (const mod of entries.filter((entry) => typeof entry === 'string' && entry.length > 0)) {
        const parts = mod.split(/[\s+]+/).filter(Boolean);
        for (const part of parts) {
            unique.add(modMap[part.toLowerCase()] || part.toUpperCase());
        }
    }

    return [...unique].sort();
}

export function buildHotkeyTarget(key, modifiers, bindType) {
    return {
        key: String(key || '').toUpperCase(),
        bindType: String(bindType || 'bind').toLowerCase(),
        modifiers: standardizeModifiers(modifiers)
    };
}

export function isHotkeyTargetMatch(source, target) {
    if (!source || !target) return false;
    const mods = standardizeModifiers(source.modifiers);
    return String(source.key || '').toUpperCase() === target.key
        && String(source.bindType || 'bind').toLowerCase() === target.bindType
        && mods.length === target.modifiers.length
        && mods.every((mod, index) => mod === target.modifiers[index]);
}

export function isHotkeyOverrideMatch(override, target) {
    return !!override
        && override.action !== HotkeyAction.DELETE
        && isHotkeyTargetMatch(override.metadata ?? {}, target);
}

export function isHotkeyMatch(hotkey, target) {
    return isHotkeyTargetMatch(hotkey, target);
}

export function standardizeRuleLine(line) {
    return String(line || '').replace(/\s+/g, ' ').trim();
}

export function standardizeParamValue(value) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    const lower = text.toLowerCase();
    return ({
        '1': 'true',
        'yes': 'true',
        'true': 'true',
        'on': 'true',
        '0': 'false',
        'no': 'false',
        'false': 'false',
        'off': 'false'
    })[lower] || text;
}

export function findHotkeyOverride(overrides, target) {
    const pair = Object.entries(overrides || {}).find(([, override]) => isHotkeyOverrideMatch(override, target));
    return pair ? { id: pair[0], override: pair[1] } : null;
}

export function findOriginalHotkeyAny(collection, target) {
    return collection?.getAllOriginalHotkeys?.()
        .find((hotkey) => isHotkeyMatch(hotkey, target)) || null;
}

export function findOriginalHotkeyExact(collection, target, dispatcher, args) {
    const hotkeys = collection?.getAllOriginalHotkeys?.() || [];
    const expectedArgs = args || '';
    return dispatcher
        ? hotkeys.find((hotkey) => (
            isHotkeyMatch(hotkey, target)
            && hotkey.dispatcher === dispatcher
            && (hotkey.args || '') === expectedArgs
        )) || null
        : hotkeys.find((hotkey) => isHotkeyMatch(hotkey, target)) || null;
}
