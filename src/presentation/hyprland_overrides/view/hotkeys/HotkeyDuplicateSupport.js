import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { applyLabelAttributes } from '../../../common/ViewUtils.js';
import { tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';

const asArray = (value) => (Array.isArray(value) ? value : []);

function toText(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function standardizeKeyCombo(modifiers, key, { upper = false } = {}) {
    return `${asArray(modifiers).slice().sort().join('+')}:${upper ? toText(key).toUpperCase() : toText(key)}`;
}

function isAliveOverride(override) {
    return !!override && override.action !== HotkeyAction.DELETE;
}

function pushGroupedEntry(grouped, key, entry) {
    const entries = grouped.get(key) ?? [];
    entries.push(entry);
    grouped.set(key, entries);
}

function groupOverridesByKeyCombo(overrides) {
    let grouped = new Map();
    for (let [id, override] of Object.entries(overrides ?? {})) {
        if (!isAliveOverride(override)) continue;
        let metadata = override.metadata ?? {};
        let keyCombo = standardizeKeyCombo(metadata.modifiers, metadata.key, { upper: true });
        if (keyCombo === ':') continue;
        pushGroupedEntry(grouped, keyCombo, {
            id,
            timestamp: Number(override.timestamp) || 0
        });
    }
    return grouped;
}

function dropAllButNewestByCombo(overrides, grouped) {
    let removedCount = 0;
    for (const entries of grouped.values()) {
        if (entries.length <= 1) continue;
        entries.sort((a, b) => b.timestamp - a.timestamp);
        for (let index = 1; index < entries.length; index += 1) {
            delete overrides[entries[index].id];
            removedCount += 1;
        }
    }
    return removedCount;
}

function deduplicateOverrides(overrides) {
    const grouped = groupOverridesByKeyCombo(overrides);
    return dropAllButNewestByCombo(overrides ?? {}, grouped);
}

function translateWithFallback(ctx, key, fallback) {
    return ctx.t(key) || fallback;
}

function destroyDialogFrame(ctx, frameKey, scope) {
    const frame = ctx[frameKey];
    frame && (
        ctx[frameKey] = null,
        tryRun(scope, () => frame.destroy())
    );
}

function moveOverrideToGlobal(ctx, id, override, initiator = null) {
    const metadata = override.metadata ?? {};
    ctx.removeDuplicateGlobalOverrides(
        metadata.modifiers,
        metadata.key,
        override.dispatcher,
        override.args,
        id
    );

    ctx.globalHotkeyOverrides[id] = { ...override };
    ctx.globalHotkeyInitiators ||= {};
    initiator
        ? (ctx.globalHotkeyInitiators[id] = initiator)
        : delete ctx.globalHotkeyInitiators[id];
    delete ctx.currentHotkeyOverrides[id];
}

function pruneHotkeyInitiators(ctx) {
    ctx.globalHotkeyInitiators ||= {};
    Object.keys(ctx.globalHotkeyInitiators).forEach((id) => {
        !Object.prototype.hasOwnProperty.call(ctx.globalHotkeyOverrides ?? {}, id)
            && delete ctx.globalHotkeyInitiators[id];
    });
}

function persistHotkeyOverrides(ctx) {
    pruneHotkeyInitiators(ctx);
    ctx.savePerRiceHotkeyOverrides?.();
    ctx.saveGlobalHotkeyOverrides?.();
}

function createReplaceOverridePayload(hotkey, dispatcher, args) {
    return {
        dispatcher,
        args,
        action: HotkeyAction.REPLACE,
        metadata: {
            modifiers: hotkey.modifiers,
            key: hotkey.key,
            bindType: hotkey.bindType,
            originalDispatcher: hotkey.dispatcher,
            originalArgs: hotkey.args
        },
        timestamp: Date.now()
    };
}

function createUseGlobalPayload(hotkey) {
    const digDispatcher = hotkey?.metadata?.digDispatcher;
    const digArgs = hotkey?.metadata?.digArgs;
    return {
        dispatcher: null,
        args: null,
        action: HotkeyAction.USE_GLOBAL,
        metadata: {
            originalDispatcher: hotkey.dispatcher,
            originalArgs: hotkey.args,
            digDispatcher,
            digArgs
        },
        timestamp: Date.now()
    };
}

export function applyHotkeyDuplicateSupport(prototype) {
    prototype.findDuplicateRiceHotkeys = function() {
        const bySignature = new Map();
        const hotkeyService = this.hotkeyService;
        const themePath = this.getCurrentThemePath?.();
        if (!themePath || !hotkeyService) return [];

        const originals = hotkeyService.parseThemeOriginals(themePath, { includeGenerated: false });
        if (!Array.isArray(originals) || originals.length === 0) return [];

        for (const hotkey of originals) {
            if (!hotkey) continue;
            const action = toText(hotkey.displayAction);
            if (!action) continue;

            const normalizedCombo = hotkeyService.buildKeyCombo?.(
                hotkeyService.standardizeModifiers?.(asArray(hotkey.modifiers), themePath) ?? [],
                toText(hotkey.key)
            );
            if (!normalizedCombo) continue;
            const keyCombo = hotkey.keyCombo || normalizedCombo;

            const signature = `${normalizedCombo}|${action}`;

            const group = bySignature.get(signature) || {
                keyCombo,
                action,
                displayCombo: hotkey.displayKeyCombo || keyCombo,
                ids: [],
                count: 0
            };
            group.ids.push(hotkey.id);
            group.count += 1;
            bySignature.set(signature, group);
        }

        return Array.from(bySignature.values()).filter(g => g.count > 1);
    };

    prototype.fixDuplicateRiceHotkeys = function() {
        const themePath = this.getCurrentThemePath?.();
        if ((this.hotkeyService?.removeDuplicatesFromConfigs?.(themePath) || 0) === 0) return;

        this.setApplyPending?.(true);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
            this.loadHotkeysForTheme?.();
            return GLib.SOURCE_REMOVE;
        });
    };

    prototype.showDuplicatesDialog = function() {
        const duplicates = this.findDuplicateRiceHotkeys();
        if (duplicates.length === 0) return;

        const dialog = new Gtk.Dialog({
            title: translateWithFallback(this, 'DUPLICATE_HOTKEYS_TITLE', 'Duplicate Global Hotkeys'),
            modal: true,
            resizable: true
        });
        this._duplicatesDialog = dialog;
        dialog.connect('destroy', () => { this._duplicatesDialog = null; });
        dialog.set_transient_for?.(this.popup);
        dialog.set_default_size(500, 300);

        const content = dialog.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(16);
        content.set_margin_end(16);

        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });

        for (const group of duplicates) {
            const row = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 4,
                margin_bottom: 4
            });
            row.get_style_context().add_class('duplicate-row');

            const comboLabel = new Gtk.Label({
                label: group.displayCombo || group.keyCombo || '',
                halign: Gtk.Align.START
            });
            applyLabelAttributes(comboLabel, { bold: true });
            comboLabel.set_size_request(180, -1);
            row.pack_start(comboLabel, false, false, 0);

            const actionLabel = new Gtk.Label({
                label: group.action || '(empty)',
                halign: Gtk.Align.START,
                ellipsize: 3
            });
            actionLabel.set_size_request(200, -1);
            row.pack_start(actionLabel, true, true, 0);

            const countLabel = new Gtk.Label({
                label: `×${group.count}`,
                halign: Gtk.Align.END
            });
            countLabel.get_style_context().add_class('duplicate-count-badge');
            row.pack_end(countLabel, false, false, 0);

            listBox.pack_start(row, false, false, 0);
        }

        scrolled.add(listBox);
        content.pack_start(scrolled, true, true, 0);

        const closeBtn = new Gtk.Button({ label: translateWithFallback(this, 'CLOSE', 'Close') });
        closeBtn.set_halign(Gtk.Align.END);
        closeBtn.set_margin_top(8);
        closeBtn.connect('clicked', () => dialog.destroy());
        this.applyPointerCursor?.(closeBtn);
        content.pack_start(closeBtn, false, false, 0);

        dialog.show_all();
    };

    prototype.updateDuplicatesWarning = function() {
        if (!this.hotkeyListBox) return;
        destroyDialogFrame(this, '_duplicatesWarningFrame', 'updateDuplicatesWarning.destroy');

        const duplicates = this.findDuplicateRiceHotkeys();
        if (duplicates.length === 0) return;

        const frame = new Gtk.Frame({
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 4,
            margin_end: 4
        });
        frame.get_style_context().add_class('duplicates-warning-frame');
        frame.connect('destroy', () => {
            this._duplicatesWarningFrame === frame && (this._duplicatesWarningFrame = null);
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const warningIcon = new Gtk.Label({ label: '⚠' });
        warningIcon.get_style_context().add_class('warning-icon');
        box.pack_start(warningIcon, false, false, 0);

        box.pack_start(new Gtk.Label({
            label: translateWithFallback(this, 'DUPLICATE_HOTKEYS_WARNING', 'Found {count} duplicate hotkeys ({groups} groups)')
                .replace('{count}', duplicates.reduce((sum, g) => sum + g.count - 1, 0))
                .replace('{groups}', duplicates.length),
            halign: Gtk.Align.START
        }), true, true, 0);

        const showAllBtn = new Gtk.Button({
            label: translateWithFallback(this, 'SHOW_ALL', 'Show All')
        });
        showAllBtn.connect('clicked', () => this.showDuplicatesDialog());
        this.applyPointerCursor?.(showAllBtn);
        box.pack_start(showAllBtn, false, false, 0);

        const fixAllBtn = new Gtk.Button({
            label: translateWithFallback(this, 'FIX_ALL', 'Fix All')
        });
        fixAllBtn.get_style_context().add_class('suggested-action');
        fixAllBtn.connect('clicked', () => this.fixDuplicateRiceHotkeys());
        this.applyPointerCursor?.(fixAllBtn);
        box.pack_start(fixAllBtn, false, false, 0);

        frame.add(box);
        this._duplicatesWarningFrame = frame;

        this.hotkeyListBox.pack_start(frame, false, false, 0);
        this.hotkeyListBox.reorder_child(frame, 0);
        frame.show_all();
    };

    prototype.handleAddedHotkeyGlobalToggle = function(id, override, makeGlobal) {
        const liveOverride = this.currentHotkeyOverrides?.[id] ?? this.globalHotkeyOverrides?.[id] ?? override;
        if (!liveOverride) return;

        makeGlobal
            ? moveOverrideToGlobal(this, id, liveOverride)
            : (
                this.currentHotkeyOverrides[id] = { ...liveOverride },
                delete this.globalHotkeyOverrides[id],
                delete this.globalHotkeyInitiators?.[id]
            );

        persistHotkeyOverrides(this);
    };

    prototype.handleAddedHotkeyDuplicate = function(id, override) {
        this.globalHotkeyOverrides ||= {};
        this.globalHotkeyInitiators ||= {};
        this.digRollbackHotkeysSnapshot || (this.digRollbackHotkeysSnapshot = JSON.parse(JSON.stringify(this.globalHotkeyOverrides)));
        this.digRollbackHotkeyInitiatorsSnapshot || (this.digRollbackHotkeyInitiatorsSnapshot = JSON.parse(JSON.stringify(this.globalHotkeyInitiators)));

        const liveOverride = this.currentHotkeyOverrides?.[id] ?? override;
        if (!liveOverride) return;

        moveOverrideToGlobal(this, id, liveOverride, this.currentTheme?.name || '');
        this.saveGlobalHotkeyOverrides?.();
        this.savePerRiceHotkeyOverrides?.();
    };

    prototype.removeDuplicateGlobalOverrides = function(modifiers, key, dispatcher, args, exceptId = null) {
        if (!this.globalHotkeyOverrides) return;
        const targetKeyCombo = standardizeKeyCombo(modifiers, key);

        const toRemove = [];
        for (const [id, override] of Object.entries(this.globalHotkeyOverrides)) {
            if (id === exceptId || !isAliveOverride(override)) continue;

            const meta = override.metadata ?? {};
            const isSameOverride = standardizeKeyCombo(meta.modifiers, meta.key) === targetKeyCombo
                && toText(override.dispatcher) === toText(dispatcher)
                && toText(override.args) === toText(args);
            isSameOverride && toRemove.push(id);
        }

        for (const id of toRemove) {
            delete this.globalHotkeyOverrides[id];
            delete this.globalHotkeyInitiators?.[id];
        }
    };

    prototype.deduplicateGlobalOverrides = function() {
        const removedCount = deduplicateOverrides(this.globalHotkeyOverrides);
        pruneHotkeyInitiators(this);
        removedCount > 0 && this.saveGlobalHotkeyOverrides?.();
    };

    prototype.deduplicatePerRiceOverrides = function() {
        const removedCount = deduplicateOverrides(this.currentHotkeyOverrides);
        removedCount > 0 && this.savePerRiceHotkeyOverrides?.();
    };

    prototype.handleGlobalDuplicate = function(hotkeyId, hotkey, currentOverride) {
        this.globalHotkeyOverrides ||= {};
        this.globalHotkeyInitiators ||= {};
        this.digRollbackHotkeysSnapshot || (this.digRollbackHotkeysSnapshot = JSON.parse(JSON.stringify(this.globalHotkeyOverrides)));
        this.digRollbackHotkeyInitiatorsSnapshot || (this.digRollbackHotkeyInitiatorsSnapshot = JSON.parse(JSON.stringify(this.globalHotkeyInitiators)));

        const liveOverride = this.currentHotkeyOverrides?.[hotkeyId] ?? currentOverride;
        const isReplaced = liveOverride?.action === HotkeyAction.REPLACE;
        const isUseGlobal = liveOverride?.action === HotkeyAction.USE_GLOBAL;
        const meta = (isUseGlobal && liveOverride?.metadata && typeof liveOverride.metadata === 'object')
            ? liveOverride.metadata
            : null;
        const digDispatcher = meta?.digDispatcher;
        const digArgs = meta?.digArgs;
        const dispatcher = isReplaced
            ? liveOverride.dispatcher
            : (typeof digDispatcher === 'string' ? digDispatcher : hotkey.dispatcher);
        const args = isReplaced
            ? liveOverride.args
            : (typeof digArgs === 'string' ? digArgs : hotkey.args);

        this.removeDuplicateGlobalOverrides(
            hotkey.modifiers, hotkey.key, dispatcher, args, hotkeyId
        );

        this.globalHotkeyOverrides[hotkeyId] = createReplaceOverridePayload(hotkey, dispatcher, args);
        this.globalHotkeyInitiators[hotkeyId] = this.currentTheme?.name || '';

        this.saveGlobalHotkeyOverrides?.();

        this.currentHotkeyOverrides[hotkeyId] = createUseGlobalPayload({
            ...hotkey,
            metadata: {
                ...(hotkey.metadata ?? {}),
                digDispatcher: dispatcher,
                digArgs: args
            }
        });
    };
}
