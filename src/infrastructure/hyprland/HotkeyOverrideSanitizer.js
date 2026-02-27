import { HotkeyAction } from '../../domain/valueObjects/HotkeyOverride.js';

function toText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function toTimestamp(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeModifiers(modifiers) {
    const source = Array.isArray(modifiers) ? modifiers : [];
    return source
        .map((item) => toText(item).toUpperCase())
        .filter(Boolean)
        .sort();
}

function buildComboSignature(override) {
    const metadata = override?.metadata;
    const key = toText(metadata?.key).toUpperCase();
    if (!key) {
        return '';
    }
    const bindType = toText(metadata?.bindType).toLowerCase() || 'bind';
    const modifiers = normalizeModifiers(metadata?.modifiers);
    return `${bindType}:${modifiers.join('+')}:${key}`;
}

function isOverrideObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function shouldDropOverride(override) {
    if (!isOverrideObject(override)) {
        return true;
    }
    if (override.action === HotkeyAction.DELETE) {
        return false;
    }
    const dispatcher = toText(override.dispatcher);
    const key = toText(override?.metadata?.key);
    return !dispatcher && !key;
}

export function sanitizeHotkeyOverrideMap(overrides) {
    const source = isOverrideObject(overrides) ? overrides : {},
        clean = {},
        byCombo = new Map(),
        removedIds = [];

    for (const [id, override] of Object.entries(source)) {
        if (!id || shouldDropOverride(override)) {
            removedIds.push(id);
            continue;
        }

        let cloned = { ...override },
            signature = buildComboSignature(cloned);
        if (!signature) {
            clean[id] = cloned;
            continue;
        }

        let candidate = { id, timestamp: toTimestamp(cloned.timestamp), override: cloned },
            current = byCombo.get(signature);
        if (!current) {
            byCombo.set(signature, candidate);
            continue;
        }

        if (candidate.timestamp >= current.timestamp) {
            removedIds.push(current.id);
            byCombo.set(signature, candidate);
        } else {
            removedIds.push(candidate.id);
        }
    }

    for (const winner of byCombo.values()) {
        clean[winner.id] = winner.override;
    }

    return {
        overrides: clean,
        removedIds
    };
}

export function filterOverrideInitiators(initiators, overrides) {
    const source = isOverrideObject(initiators) ? initiators : {};
    const params = isOverrideObject(overrides) ? overrides : {};
    return Object.fromEntries(
        Object.entries(source).filter(([key, value]) =>
            Object.prototype.hasOwnProperty.call(params, key)
            && typeof value === 'string'
            && value.trim().length > 0
        )
    );
}
