import GLib from 'gi://GLib';
import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';

function closeHotkeyDialog(ctx, key, scope) {
    const dialog = ctx[key];
    dialog && (tryRun(scope, () => dialog.destroy()), ctx[key] = null);
}

function findGroupItemByHotkeyId(groups, hotkeyId) {
    return Array.from(groups ?? []).reduce((found, [combo, group]) => found || (() => {
        const item = (group.hotkeys ?? []).find((entry) => entry?.hotkey?.id === hotkeyId);
        return item ? { combo, item } : null;
    })(), null);
}

function isDeleteAction(action) {
    return action === HotkeyAction.DELETE || action === 'delete';
}

export function applyHyprlandOverridePopupHotkeysLoad(targetPrototype) {
    targetPrototype.loadHotkeysForTheme = function() {
        const themePath = this.hotkeyListBox && this.currentTheme && this.getCurrentThemePath();
        themePath && (() => {
            const settings = this.settingsManager?.getAll?.() ?? {};
            const groups = this.hotkeyService.getGroupedHotkeys(themePath, settings);
            const collection = this.hotkeyService.getMergedHotkeys(themePath, settings);
            const globalState = this.settingsManager?.readGlobalHotkeysState?.() ?? {};

            this.currentHotkeyOverrides = this.hotkeyService.getPerRiceOverrides(themePath);
            this.globalHotkeyOverrides = this.hotkeyService.getGlobalOverrides?.(settings) ?? settings.hotkeyOverrides ?? {};
            this.globalHotkeyInitiators = { ...(globalState.initiators ?? {}) };

            this.deduplicateGlobalOverrides();
            this.deduplicatePerRiceOverrides();

            this.allHotkeyGroups = groups;
            this.menuHotkeyCollection = collection;
            this.menuHotkeyItems = this.findMenuHotkeysFromGroups(groups);
            this.updateMenuNotice();

            this.filterHotkeys();
            this.refreshHotkeyWarnings();
        })();
    };

    targetPrototype.refreshHotkeyWarnings = function() {
        this.updateDuplicatesWarning();
        this.showMultiActionWarning();
    };

    targetPrototype.refreshHotkeysDeferred = function(reloadData = false) {
        closeHotkeyDialog(this, '_multiActionDialog', 'refreshHotkeys.multiAction');
        closeHotkeyDialog(this, '_duplicatesDialog', 'refreshHotkeys.duplicates');

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            reloadData
                ? this.loadHotkeysForTheme?.()
                : (
                    this.menuHotkeyItems = this.findMenuHotkeysFromGroups(this.allHotkeyGroups),
                    this.updateMenuNotice(),
                    this.filterHotkeys(),
                    this.refreshHotkeyWarnings()
                );
            return GLib.SOURCE_REMOVE;
        });
    };

    targetPrototype.findMultiActionHotkeys = function() {
        const byNormalizedCombo = new Map();
        const allHotkeyGroups = this.allHotkeyGroups ?? [];

        this._cachedMainModInfo = null;
        const ensureComboEntry = (normalizedCombo, displayCombo) => {
            return normalizedCombo
                ? (byNormalizedCombo.has(normalizedCombo) || byNormalizedCombo.set(normalizedCombo, {
                    normalizedCombo,
                    displayCombo,
                    hotkeys: [],
                    actions: new Set()
                }), byNormalizedCombo.get(normalizedCombo))
                : null;
        };
        const addMultiActionEntry = (keyCombo, displayCombo, action, payload) => {
            const entry = action && ensureComboEntry(
                this.standardizeKeyComboWithMainMod(keyCombo || ''),
                displayCombo || keyCombo
            );
            entry && (entry.hotkeys.push({ action, originalCombo: keyCombo, ...payload }), entry.actions.add(action));
        };

        for (const [combo, group] of allHotkeyGroups) {
            for (const { hotkey, effectiveAction } of (group.hotkeys ?? [])
                .map((item) => {
                    const hotkey = item?.hotkey;
                    const effectiveAction = hotkey
                        ? this.getCurrentActionForHotkey(hotkey, item.override, item.source)
                        : '';
                    return {item, hotkey, effectiveAction};
                })
                .filter(({hotkey, effectiveAction}) => Boolean(hotkey && effectiveAction))) {
                const keyCombo = hotkey.keyCombo || combo || '';
                addMultiActionEntry(keyCombo, hotkey.displayCombo || group.displayKeyCombo || keyCombo, effectiveAction, {
                    id: hotkey.id,
                    hotkey,
                });
            }

            for (const {item, override} of (group.addedHotkeys ?? [])
                .map((item) => ({item, override: item?.override}))
                .filter(({override}) => Boolean(override && !isDeleteAction(override.action)))) {
                const effectiveAction = `${override.dispatcher || ''} ${override.args || ''}`.trim();
                addMultiActionEntry(combo || '', group.displayKeyCombo || combo, effectiveAction, {
                    id: item.id,
                    hotkey: null,
                    override
                });
            }
        }

        return Array.from(byNormalizedCombo.values())
            .filter((group) => group.actions.size > 1)
            .map((group) => {
                const seenActions = new Set();
                const uniqueHotkeys = [];
                for (const hotkeyEntry of group.hotkeys) {
                    seenActions.has(hotkeyEntry.action)
                        || (seenActions.add(hotkeyEntry.action), uniqueHotkeys.push(hotkeyEntry));
                }
                return {
                    normalizedCombo: group.normalizedCombo,
                    displayCombo: group.displayCombo,
                    hotkeys: uniqueHotkeys,
                    actionCount: group.actions.size
                };
            });
    };

    targetPrototype.findHotkeyDataById = function(hotkeyId) {
        const match = findGroupItemByHotkeyId(this.allHotkeyGroups, hotkeyId);
        const perRiceOverride = this.currentHotkeyOverrides?.[hotkeyId];
        return match
            ? {
                hotkey: match.item.hotkey,
                override: perRiceOverride || match.item.override,
                source: match.item.source,
                isOverridden: match.item.isOverridden,
                isDeleted: isDeleteAction(perRiceOverride?.action)
            }
            : null;
    };

    targetPrototype.scrollToAndEditHotkey = function(hotkeyId) {
        const match = findGroupItemByHotkeyId(this.allHotkeyGroups, hotkeyId);
        match && (this.hotkeySearchEntry?.set_text?.(''), this.expandAndScrollToCombo(match.combo));
    };

    targetPrototype.expandAndScrollToCombo = function(targetCombo) {
        const parts = targetCombo.split(':');
        const key = parts[parts.length - 1] || targetCombo;
        this.hotkeySearchEntry?.set_text?.(key);
    };

    targetPrototype.deleteHotkeyById = function(hotkeyId) {
        const themePath = hotkeyId && this.hotkeyService && this.getCurrentThemePath();
        themePath && (
            this.currentHotkeyOverrides ||= {},
            this.currentHotkeyOverrides[hotkeyId] = {
                action: HotkeyAction.DELETE,
                timestamp: Date.now()
            },
            this.savePerRiceHotkeyOverrides?.(),
            this.setApplyPending?.(true)
        );
    };
}
