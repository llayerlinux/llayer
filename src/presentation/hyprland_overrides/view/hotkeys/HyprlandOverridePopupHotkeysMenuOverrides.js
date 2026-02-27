import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';

function standardizeMods(modifiers = []) {
    return modifiers.map((mod) => String(mod).toUpperCase()).sort();
}

function isSameHotkeyKey(hotkey, parsedKey) {
    const normalizedMods = standardizeMods(parsedKey.modifiers ?? []);
    const originalMods = standardizeMods(hotkey.modifiers ?? []);
    return normalizedMods.join('_') === originalMods.join('_')
        && String(parsedKey.key).toUpperCase() === String(hotkey.key).toUpperCase();
}

function applyMenuRebindOverrides(overrides, hotkey, parsedKey, parsedAction) {
    const addId = `menu_rebind_${hotkey.id}`;
    const normalizedMods = standardizeMods(parsedKey.modifiers ?? []);

    overrides[addId] = {
        dispatcher: parsedAction.dispatcher,
        args: parsedAction.args,
        action: HotkeyAction.ADD,
        metadata: {
            modifiers: normalizedMods,
            key: parsedKey.key,
            bindType: 'bind',
            menuRebindFor: hotkey.id
        },
        timestamp: Date.now()
    };

    overrides[hotkey.id] = {
        dispatcher: null,
        args: null,
        action: HotkeyAction.DELETE,
        metadata: {
            modifiers: hotkey.modifiers,
            key: hotkey.key,
            originalDispatcher: hotkey.dispatcher,
            originalArgs: hotkey.args,
            menuRebindFor: hotkey.id
        },
        timestamp: Date.now()
    };
}

export function applyHyprlandOverridePopupHotkeysMenuOverrides(prototype) {
    prototype.getMenuRebindOverride = function(hotkeyId) {
        const overrides = this.currentHotkeyOverrides ?? {};
        const match = Object.entries(overrides).find(([, override]) =>
            override?.metadata?.menuRebindFor === hotkeyId && override.action === HotkeyAction.ADD
        );
        return match ? { id: match[0], override: match[1] } : null;
    };

    prototype.clearMenuRebindOverride = function(hotkeyId) {
        for (const [id, override] of Object.entries(this.currentHotkeyOverrides ?? {})) {
            override?.metadata?.menuRebindFor === hotkeyId && delete this.currentHotkeyOverrides[id];
        }
    };

    prototype.applyMenuKeyChangeForHotkey = function(item, parsedKey, actionText) {
        return (item?.hotkey && parsedKey)
            ? (() => {
                const { hotkey } = item;
                const sameKey = isSameHotkeyKey(hotkey, parsedKey);
                return sameKey
                    ? (
                        this.clearMenuRebindOverride(hotkey.id),
                        (() => {
                            const existing = this.currentHotkeyOverrides?.[hotkey.id];
                            existing?.metadata?.menuRebindFor === hotkey.id && delete this.currentHotkeyOverrides[hotkey.id];
                            actionText && this.handleHotkeyActionChange(hotkey.id, actionText, hotkey);
                        })()
                    )
                    : (() => {
                        const parsedAction = this.parseAction(actionText || hotkey.displayAction);
                        parsedAction && (
                            this.clearMenuRebindOverride(hotkey.id),
                            applyMenuRebindOverrides(this.currentHotkeyOverrides, hotkey, parsedKey, parsedAction)
                        );
                    })();
            })()
            : undefined;
    };

    prototype.applyMenuCommandChangeForHotkey = function(item, actionText) {
        return item?.hotkey
            ? (() => {
                const rebind = this.getMenuRebindOverride(item.hotkey.id);
                return rebind
                    ? (() => {
                        const parsed = this.parseAction(actionText);
                        parsed && (this.currentHotkeyOverrides[rebind.id] = {
                            ...rebind.override,
                            dispatcher: parsed.dispatcher,
                            args: parsed.args,
                            action: HotkeyAction.ADD,
                            timestamp: Date.now()
                        });
                    })()
                    : this.handleHotkeyActionChange(item.hotkey.id, actionText, item.hotkey);
            })()
            : undefined;
    };

    prototype.parseAction = function(action) {
        const trimmed = typeof action === 'string' ? action.trim() : '';
        return trimmed
            ? (() => {
                const [dispatcher, ...rest] = trimmed.split(/\s+/);
                return {
                    dispatcher: dispatcher || '',
                    args: rest.join(' ').trim()
                };
            })()
            : null;
    };
}
