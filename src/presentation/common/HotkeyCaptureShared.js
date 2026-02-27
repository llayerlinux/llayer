import Gtk from 'gi://Gtk?version=3.0';

const HOTKEY_CAPTURE_SPECIAL_KEYS = {
    Super_L: 'SUPER',
    Super_R: 'SUPER',
    Shift_L: 'SHIFT',
    Shift_R: 'SHIFT',
    Control_L: 'CTRL',
    Control_R: 'CTRL',
    Alt_L: 'ALT',
    Alt_R: 'ALT',
    Return: 'Return',
    space: 'Space',
    Tab: 'Tab',
    Delete: 'Delete'
};

const HOTKEY_CAPTURE_MODIFIER_MAP = {
    SUPER: true,
    SHIFT: true,
    CTRL: true,
    ALT: true,
    CONTROL: 'CTRL'
};

function standardizeCapturedHotkeyName(keyname) {
    const mappedSpecialKey = keyname && HOTKEY_CAPTURE_SPECIAL_KEYS[keyname];
    return mappedSpecialKey || (keyname ? (keyname.length === 1 ? keyname.toUpperCase() : keyname) : null);
}

function parseHotkeyToken(token, modifierMap = HOTKEY_CAPTURE_MODIFIER_MAP) {
    const normalized = String(token || '').trim().toUpperCase(),
        modifierMapping = modifierMap[normalized];
    if (!normalized || modifierMapping) {
        return {
            modifier: modifierMapping ? (modifierMapping === true ? normalized : modifierMapping) : null,
            key: ''
        };
    }
    return {modifier: null, key: normalized.length === 1
        ? normalized
        : normalized.charAt(0) + normalized.slice(1).toLowerCase()};
}

function extractHotkeyFromInput({
    keyMode = false,
    capturedKeys = [],
    keyText = '',
    modifierMap = HOTKEY_CAPTURE_MODIFIER_MAP
} = {}) {
    const modifiers = [];
    let key = '';
    const useCaptured = keyMode && capturedKeys.length > 0;
    const normalizedText = useCaptured ? '' : String(keyText || '').trim();
    if (!(useCaptured || normalizedText)) {
        return {modifiers: [], key: '', error: 'empty'};
    }

    const tokens = useCaptured
        ? capturedKeys
        : normalizedText.split(/\s*\+\s*/).map((part) => part.trim().toUpperCase());
    for (const token of tokens) {
        const parsed = useCaptured
            ? {modifier: modifierMap[token] === true ? token : null, key: modifierMap[token] === true ? '' : token}
            : parseHotkeyToken(token, modifierMap);
        parsed.modifier && modifiers.push(parsed.modifier);
        parsed.key && (key = parsed.key);
    }

    if (!key) {
        return {modifiers, key: '', error: 'missing_key'};
    }

    return {modifiers, key, error: null};
}

function updateCapturedKeysDisplay(box, keys, hintLabel = null) {
    box.get_children().forEach((child) => child.destroy());

    if (keys.length === 0) {
        hintLabel && (box.pack_start(hintLabel, true, true, 0), hintLabel.show?.());
        box.show_all();
        return;
    }

    keys.forEach((key, index) => {
        index > 0 && (() => {
            const plus = new Gtk.Label({label: '+'});
            plus.get_style_context().add_class('dim-label');
            box.pack_start(plus, false, false, 0);
        })();
        const label = new Gtk.Label({label: key});
        label.get_style_context().add_class(`captured-key-${index % 5}`);
        box.pack_start(label, false, false, 0);
    });

    box.show_all();
}

export {
    HOTKEY_CAPTURE_MODIFIER_MAP,
    extractHotkeyFromInput,
    standardizeCapturedHotkeyName,
    parseHotkeyToken,
    updateCapturedKeysDisplay
};
