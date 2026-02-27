import { HotkeyAction, HotkeySource } from '../../../../domain/valueObjects/HotkeyOverride.js';

const PARSE_MODIFIER_RULES = [
    { aliases: ['super', 'mod4', 'meta'], value: 'SUPER' },
    { aliases: ['shift'], value: 'SHIFT' },
    { aliases: ['ctrl', 'control'], value: 'CTRL' },
    { aliases: ['alt', 'mod1'], value: 'ALT' }
];

const METADATA_MODIFIER_LABELS = {
    SUPER: 'Super',
    SHIFT: 'Shift',
    CTRL: 'Ctrl',
    ALT: 'Alt'
};

const MOUSE_KEY_LABELS = {
    '272': 'Mouse Left',
    '273': 'Mouse Right',
    '274': 'Mouse Middle'
};

const MODIFIER_LABELS = {
    SUPER: 'Super',
    SHIFT: 'Shift',
    CTRL: 'Ctrl',
    CONTROL: 'Ctrl',
    ALT: 'Alt',
    MOD1: 'Alt',
    MOD2: 'Num',
    MOD3: 'Mod3',
    MOD4: 'Super',
    MOD5: 'Mod5'
};

function parseModifierToken(token = '') {
    const normalized = String(token || '').toLowerCase();
    const rule = PARSE_MODIFIER_RULES.find(entry => entry.aliases.includes(normalized));
    return rule ? rule.value : null;
}

function stringifyHotkeyAction(override) {
    return `${override?.dispatcher || ''} ${override?.args || ''}`.trim();
}

export function determineHotkeyDisplayState(context, hotkeyData = {}) {
    const { hotkey, override, source } = hotkeyData;
    const emptyState = {
        action: '',
        perRiceOverride: null,
        effectiveSource: source,
        isUseGlobal: false,
        hasGlobalOverride: false,
        isGlobalActive: false
    };
    return hotkey
        ? (() => {
            const perRiceOverride = context.currentHotkeyOverrides?.[hotkey.id] ?? null;
            const isDeleted = perRiceOverride?.action === HotkeyAction.DELETE || override?.action === HotkeyAction.DELETE;
            return isDeleted
                ? { ...emptyState, perRiceOverride }
                : (() => {
                    const isUseGlobal = perRiceOverride?.action === HotkeyAction.USE_GLOBAL;
                    const hasGlobalOverride = !!context.globalHotkeyOverrides?.[hotkey.id];
                    const effectiveSource = isUseGlobal ? HotkeySource.GLOBAL : source;
                    const isGlobalActive = isUseGlobal || (source === HotkeySource.GLOBAL && !perRiceOverride);

                    const action = (() => {
                        switch (true) {
                        case isUseGlobal && hasGlobalOverride:
                            return stringifyHotkeyAction(context.globalHotkeyOverrides[hotkey.id]);
                        case Boolean(override) && override.action !== HotkeyAction.USE_GLOBAL:
                            return stringifyHotkeyAction(override);
                        default:
                            return hotkey.displayAction;
                        }
                    })();

                    return {
                        action,
                        perRiceOverride,
                        effectiveSource,
                        isUseGlobal,
                        hasGlobalOverride,
                        isGlobalActive
                    };
                })();
        })()
        : emptyState;
}

export function applyHyprlandOverridePopupHotkeysFormat(targetPrototype) {
    targetPrototype.formatModifiers = function(modifiers) {
        return Array.isArray(modifiers) && modifiers.length > 0
            ? `${modifiers.map(m => this.formatModifierName(m)).join(' + ')} +`
            : '';
    };

    targetPrototype.getCurrentActionForHotkey = function(hotkey, override, _source) {
        return determineHotkeyDisplayState(this, { hotkey, override, source: _source }).action;
    };

    targetPrototype.formatKeyName = function(key) {
        switch (true) {
        case !key:
            return '';
        case key.startsWith('mouse:'): {
            const btn = key.split(':')[1];
            return MOUSE_KEY_LABELS[btn] || `Mouse ${btn}`;
        }
        default:
            return (/^[fF]\d+$/.test(key) || key.length === 1)
            ? key.toUpperCase()
            : key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
        }
    };

    targetPrototype.formatModifierName = function(mod) {
        return MODIFIER_LABELS[mod?.toUpperCase?.() || mod] || mod;
    };

    targetPrototype.formatKeyComboFromParts = function(modifiers = [], key = '') {
        return [...(modifiers ?? []).map((m) => this.formatModifierName(m)), this.formatKeyName(String(key || ''))]
            .filter(Boolean).join(' + ');
    };

    targetPrototype.parseKeyComboText = function(text) {
        const cleaned = typeof text === 'string' ? text.replace(/[,+]/g, ' ').trim() : '';
        const tokens = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
        const parsed = tokens.reduce((acc, token) => {
            const modifier = parseModifierToken(token);
            return modifier
                ? {...acc, modifiers: [...acc.modifiers, modifier]}
                : {...acc, key: token};
        }, { modifiers: [], key: '' });
        return parsed.key ? parsed : null;
    };

    targetPrototype.formatKeyComboFromMetadata = function(metadata) {
        const mods = metadata?.modifiers ?? [];
        const key = metadata?.key || '';

        const modNames = mods.map((mod) => {
            const normalized = String(mod || '').toUpperCase();
            return METADATA_MODIFIER_LABELS[normalized] || mod;
        });

        const keyName = this.formatKeyName(String(key || ''));
        return (!key && !mods.length)
            ? 'Unknown'
            : [...modNames, keyName].filter(Boolean).join(' + ');
    };

    targetPrototype.hexToRgb = function(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? [
                parseInt(result[1], 16) / 255,
                parseInt(result[2], 16) / 255,
                parseInt(result[3], 16) / 255
            ]
            : [0.5, 0.5, 0.5];
    };
}
