import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';

function buildOriginalMetadata(hotkey = {}) {
    return {
        originalDispatcher: hotkey.dispatcher,
        originalArgs: hotkey.args
    };
}

function setOrClearOverride(overrides, hotkeyId, payload) {
    return payload
        ? (overrides[hotkeyId] = payload)
        : delete overrides[hotkeyId];
}

export function applyHyprlandOverridePopupHotkeysActions(targetPrototype) {
    targetPrototype.handleHotkeyActionChange = function(hotkeyId, newAction, hotkey) {
        const [dispatcher = '', ...argsParts] = String(newAction ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        return dispatcher
            ? setOrClearOverride(this.currentHotkeyOverrides, hotkeyId, {
                dispatcher,
                args: argsParts.join(' '),
                action: HotkeyAction.REPLACE,
                metadata: buildOriginalMetadata(hotkey),
                timestamp: Date.now()
            })
            : setOrClearOverride(this.currentHotkeyOverrides, hotkeyId, null);
    };

    targetPrototype.handleGlobalToggle = function(hotkeyId, useGlobal, hotkey) {
        setOrClearOverride(
            this.currentHotkeyOverrides,
            hotkeyId,
            useGlobal
                ? {
                dispatcher: null,
                args: null,
                action: HotkeyAction.USE_GLOBAL,
                metadata: buildOriginalMetadata(hotkey),
                timestamp: Date.now()
            }
                : null
        );
    };

    targetPrototype.handleHotkeyDelete = function(hotkeyId, hotkey) {
        this.currentHotkeyOverrides[hotkeyId] = {
            dispatcher: null,
            args: null,
            action: HotkeyAction.DELETE,
            metadata: {
                modifiers: hotkey.modifiers,
                key: hotkey.key,
                ...buildOriginalMetadata(hotkey)
            },
            timestamp: Date.now()
        };
    };
}
