import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { sanitizeHotkeyOverrideMap } from '../../../../infrastructure/hyprland/HotkeyOverrideSanitizer.js';
import { addPointerCursor } from '../../../common/ViewUtils.js';

const hasHotkeyOverrides = (overrides = {}) => Object.keys(overrides).length > 0;

export function applyHyprlandTabHotkeysList(prototype) {
    prototype.withHotkeyListBox = function(action) {
        const listBox = this.hotkeyListBox;
        return listBox ? action(listBox) : null;
    };

    prototype.getCurrentHotkeyOverridesMap = function() {
        return this.currentHotkeyOverrides ?? {};
    };

    prototype.renderHotkeyOverrideRows = function(listBox, overrides) {
        for (const [id, override] of Object.entries(overrides)) {
            const row = this.buildHotkeyOverrideRow(id, override);
            listBox.pack_start(row, false, false, 0);
        }
        listBox.show_all();
    };

    prototype.showEmptyHotkeyMessageInList = function(listBox) {
        const emptyLabel = this.createDimLabel(
            this.t('NO_HOTKEY_OVERRIDES') || 'No global hotkey overrides set.',
            {halign: Gtk.Align.CENTER, xalign: 0.5, marginTop: 20}
        );
        listBox.pack_start(emptyLabel, false, false, 0);
        listBox.show_all();
    };

    prototype.loadGlobalHotkeyOverrides = function() {
        this.withHotkeyListBox((listBox) => {
            listBox.get_children().forEach(child => child.destroy());

            const freshSettings = this.settingsManager?.getAll?.() || this.settings;
            const overrides = freshSettings.hotkeyOverrides ?? {};
            this.currentHotkeyOverrides = {...overrides};
            this.settings.hotkeyOverrides = overrides;

            hasHotkeyOverrides(overrides)
                ? this.renderHotkeyOverrideRows(listBox, overrides)
                : this.showEmptyHotkeyMessageInList(listBox);
        });
    };

    prototype.refreshHotkeyListUI = function() {
        this.withHotkeyListBox((listBox) => {
            listBox.get_children().forEach(child => child.destroy());

            const overrides = this.getCurrentHotkeyOverridesMap();
            hasHotkeyOverrides(overrides)
                ? this.renderHotkeyOverrideRows(listBox, overrides)
                : this.showEmptyHotkeyMessage();
        });
    };

    prototype.buildHotkeyOverrideRow = function(id, override) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });
        row.get_style_context().add_class('hk-row');

        const keyComboLabel = new Gtk.Label({
            label: this.formatKeyComboFromOverride(override),
            halign: Gtk.Align.START,
            width_chars: 18
        });
        keyComboLabel.get_style_context().add_class('hk-key-combo');
        row.pack_start(keyComboLabel, false, false, 0);

        const isDeleted = override.action === HotkeyAction.DELETE;
        const actionText = isDeleted
            ? '(deleted)'
            : `${override.dispatcher || ''} ${override.args || ''}`.trim();

        const actionLabel = new Gtk.Label({
            label: actionText,
            halign: Gtk.Align.START,
            ellipsize: 3
        });
        actionLabel.get_style_context().add_class('hk-action');
        isDeleted && actionLabel.get_style_context().add_class('hk-action-deleted');
        row.pack_start(actionLabel, true, true, 0);

        const editBtn = new Gtk.Button({
            label: this.t('EDIT') || 'Edit'
        });
        editBtn.get_style_context().add_class('hk-btn');
        addPointerCursor(editBtn);
        editBtn.connect('clicked', () => this.showEditHotkeyDialog(id, override));
        row.pack_start(editBtn, false, false, 0);

        const deleteBtn = new Gtk.Button({
            label: '\u00d7'
        });
        deleteBtn.get_style_context().add_class('hk-delete-btn');
        deleteBtn.set_tooltip_text(this.t('DELETE_HOTKEY') || 'Remove override');
        addPointerCursor(deleteBtn);
        deleteBtn.connect('clicked', () => {
            delete this.currentHotkeyOverrides[id];
            row.destroy();
            !hasHotkeyOverrides(this.currentHotkeyOverrides) && this.showEmptyHotkeyMessage();
        });
        row.pack_start(deleteBtn, false, false, 0);

        return row;
    };

    prototype.showEmptyHotkeyMessage = function() {
        this.withHotkeyListBox((listBox) => {
            listBox.get_children().forEach(child => child.destroy());
            this.showEmptyHotkeyMessageInList(listBox);
        });
    };

    prototype.formatKeyComboFromOverride = function(override) {
        const mods = override.metadata?.modifiers ?? [];
        const key = override.metadata?.key || '';
        const hasComboData = key || mods.length > 0;

        const modNames = mods.map(m => {
            const map = { 'SUPER': 'Super', 'SHIFT': 'Shift', 'CTRL': 'Ctrl', 'ALT': 'Alt' };
            return map[m.toUpperCase()] || m;
        });

        const keyName = key.length === 1 ? key.toUpperCase() : key;
        return hasComboData ? [...modNames, keyName].join(' + ') : (override.hotkeyId || 'Unknown');
    };

    prototype.saveGlobalHotkeyOverrides = function() {
        const manager = this.settingsManager;
        const nextOverrides = sanitizeHotkeyOverrideMap(this.currentHotkeyOverrides).overrides;
        this.currentHotkeyOverrides = { ...nextOverrides };
        return manager
            ? (
                manager.writeGlobalHotkeys?.(nextOverrides),
                manager.set('hotkeyOverrides', nextOverrides),
                manager.write(null, {silent: true, force: true}),
                this.settings.hotkeyOverrides = { ...nextOverrides },
                this.hotkeyService && (() => {
                    const freshSettings = manager.getAll();
                    const result = this.hotkeyService.regenerateAllEffectiveOverrides(freshSettings);
                    this.logger?.info?.(`[HyprlandTab] Regenerated effective overrides for ${result.regenerated} themes`);
                    const themeName = typeof freshSettings.theme === 'string' ? freshSettings.theme.trim() : '';
                    const themePath = themeName ? `${GLib.get_home_dir()}/.config/themes/${themeName}` : null;
                    themePath && this.hotkeyService.applyOverridesNow?.(themePath, freshSettings);
                })(),
                this.onOverridesChanged?.()
            )
            : undefined;
    };
}
