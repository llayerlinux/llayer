import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { HotkeyService } from '../../../../infrastructure/hyprland/HotkeyService.js';
import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import {addPointerCursor} from '../../../common/ViewUtils.js';
import {GlobalRecommendationsPopup} from '../../dialogs/GlobalRecommendationsPopup.js';

const HOTKEY_ROW_CSS = `
    .hk-row {
        background-color: rgba(42, 42, 42, 0.5);
        border-radius: 8px;
        padding: 12px 14px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .hk-row:hover {
        background-color: rgba(50, 50, 50, 0.7);
    }
    .hk-key-combo {
        font-weight: 600;
        font-size: 12px;
        color: #e0e0e0;
    }
    .hk-action {
        font-size: 12px;
        color: #999;
    }
    .hk-action-deleted {
        font-style: italic;
        color: #666;
    }
    .hk-btn {
        min-height: 26px;
        padding: 2px 12px;
        font-size: 11px;
        border-radius: 4px;
    }
    .hk-delete-btn {
        background-color: #e53935;
        color: white;
        min-width: 24px;
        min-height: 24px;
        padding: 0;
        border-radius: 12px;
        font-size: 14px;
        font-weight: bold;
    }
    .hk-delete-btn:hover {
        background-color: #c62828;
    }
`;

const HOTKEY_CAPTURE_CSS = `
    .capture-frame {
        background-color: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 6px 10px;
        min-height: 32px;
    }
    .captured-key-0 { background-color: #3584e4; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .captured-key-1 { background-color: #33d17a; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .captured-key-2 { background-color: #f6d32d; color: #333; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .captured-key-3 { background-color: #ff7800; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .captured-key-4 { background-color: #e01b24; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
`;

function ensurePrototypeCssLoaded(prototype, stateKey, cssText) {
    if (prototype[stateKey]) {
        return;
    }

    const css = new Gtk.CssProvider();
    css.load_from_data(cssText);
    Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    prototype[stateKey] = true;
}

export function applyOverrideTabHotkeys(prototype) {

    prototype.initHotkeyService = function() {
        if (!this.hotkeyService) {
            this.hotkeyService = new HotkeyService({
                logger: this.logger,
                themeRepository: this.themeRepository,
                settingsManager: this.settingsManager
            });
        }
    };

    prototype.buildHotkeyOverridesButton = function() {
        const btn = new Gtk.Button({
            label: this.t('HOTKEY_OVERRIDES_BTN') || 'Hotkey Overrides'
        });
        btn.get_style_context().add_class('hotkey-overrides-btn');
        btn.set_tooltip_text(this.t('HOTKEY_OVERRIDES_TOOLTIP') || 'Configure global hotkey overrides');
        addPointerCursor(btn);
        btn.connect('clicked', () => this.showHotkeyOverridesDialog());
        return btn;
    };

    prototype.buildRecommendationsButton = function() {
        const btn = new Gtk.Button({
            label: this.t('RECOMMENDATIONS_BTN') || 'Recommendations'
        });
        btn.get_style_context().add_class('recommendations-btn');
        btn.set_tooltip_text(this.t('RECOMMENDATIONS_TOOLTIP') || 'Apply recommended global settings');
        addPointerCursor(btn);
        btn.connect('clicked', () => this.showRecommendationsPopup());
        return btn;
    };

    prototype.showRecommendationsPopup = function() {
        const popup = new GlobalRecommendationsPopup({
            t: this.t,
            parentWindow: this.parentWindow,
            settingsManager: this.settingsManager,
            eventBus: this.eventBus,
            parameterService: this.parameterService,
            themeRepository: this.themeRepository
        });
        popup.show();
    };

    prototype.clearHotkeyList = function() {
        if (!this.hotkeyListBox) {
            return false;
        }

        this.hotkeyListBox.get_children().forEach(child => child.destroy());
        return true;
    };

    prototype.renderHotkeyOverrides = function(overrides) {
        if (!this.clearHotkeyList()) {
            return;
        }

        const entries = Object.entries(overrides || {});
        if (!entries.length) {
            this.showEmptyHotkeyMessage();
            return;
        }

        for (const [id, override] of entries) {
            this.hotkeyListBox.pack_start(this.buildHotkeyOverrideRow(id, override), false, false, 0);
        }

        this.hotkeyListBox.show_all();
    };

    prototype.showHotkeyOverridesDialog = function() {
        if (this.hotkeyOverridesDialog) {
            this.hotkeyOverridesDialog.present?.();
            return;
        }

        this.initHotkeyService();

        ensurePrototypeCssLoaded(prototype, 'hotkeyRowCssLoaded', HOTKEY_ROW_CSS);

        const dialog = new Gtk.Dialog({
            title: '',
            modal: true,
            resizable: true,
            decorated: false
        });

        if (this.parentWindow) {
            dialog.set_transient_for?.(this.parentWindow);
        }

        dialog.get_style_context().add_class('hotkey-overrides-dialog');
        dialog.set_default_size(580, 480);

        const content = dialog.get_content_area();
        content.set_margin_top(16);
        content.set_margin_bottom(16);
        content.set_margin_start(20);
        content.set_margin_end(20);
        content.set_spacing(10);

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });

        const title = new Gtk.Label({
            label: this.t('HOTKEY_OVERRIDES_TITLE') || 'Global Hotkey Overrides',
            halign: Gtk.Align.START
        });
        title.get_style_context().add_class('title-4');
        headerBox.pack_start(title, false, false, 0);

        const addBtn = new Gtk.Button();
        addBtn.set_image(Gtk.Image.new_from_icon_name('list-add-symbolic', Gtk.IconSize.BUTTON));
        addBtn.get_style_context().add_class('suggested-action');
        addBtn.set_tooltip_text(this.t('ADD_HOTKEY') || 'Add Hotkey');
        addPointerCursor(addBtn);
        addBtn.connect('clicked', () => this.showAddHotkeyDialog(dialog));
        headerBox.pack_start(addBtn, false, false, 0);

        headerBox.pack_start(new Gtk.Box(), true, true, 0);

        const helpBtn = new Gtk.Button();
        helpBtn.set_image(Gtk.Image.new_from_icon_name('help-about-symbolic', Gtk.IconSize.BUTTON));
        helpBtn.get_style_context().add_class('flat');
        helpBtn.set_tooltip_text(this.t('HOTKEYS_HELP') || 'Help');
        addPointerCursor(helpBtn);
        helpBtn.connect('clicked', () => this.showGlobalHotkeysHelpPopup(helpBtn));
        headerBox.pack_end(helpBtn, false, false, 0);

        content.pack_start(headerBox, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('HOTKEY_OVERRIDES_DESC') || 'Hotkeys applied after any theme\'s keybindings.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        content.pack_start(desc, false, false, 0);

        content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 280
        });

        this.hotkeyListBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6
        });

        scrolled.add(this.hotkeyListBox);
        content.pack_start(scrolled, true, true, 0);

        this.loadGlobalHotkeyOverrides();

        const actionBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
            margin_top: 12
        });

        const cancelBtn = new Gtk.Button({
            label: this.t('CANCEL') || 'Cancel'
        });
        addPointerCursor(cancelBtn);
        cancelBtn.connect('clicked', () => dialog.destroy());
        actionBox.pack_start(cancelBtn, false, false, 0);

        const saveBtn = new Gtk.Button({
            label: this.t('SAVE') || 'Save'
        });
        saveBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(saveBtn);
        saveBtn.connect('clicked', () => {
            this.saveGlobalHotkeyOverrides();
            dialog.destroy();
        });
        actionBox.pack_start(saveBtn, false, false, 0);

        content.pack_start(actionBox, false, false, 0);

        dialog.connect('destroy', () => {
            this.hotkeyOverridesDialog = null;
            this.hotkeyListBox = null;
        });

        this.hotkeyOverridesDialog = dialog;
        dialog.show_all();
    };

    prototype.loadGlobalHotkeyOverrides = function() {
        if (!this.hotkeyListBox) return;

        const freshSettings = this.settingsManager?.getAll?.() || this.settings;
        const overrides = freshSettings.hotkeyOverrides || {};
        this.currentHotkeyOverrides = { ...overrides };
        this.settings.hotkeyOverrides = overrides;
        this.renderHotkeyOverrides(overrides);
    };

    prototype.refreshHotkeyListUI = function() {
        if (!this.hotkeyListBox) return;
        this.renderHotkeyOverrides(this.currentHotkeyOverrides || {});
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
        if (isDeleted) {
            actionLabel.get_style_context().add_class('hk-action-deleted');
        }
        row.pack_start(actionLabel, true, true, 0);

        const editBtn = new Gtk.Button({
            label: this.t('EDIT') || 'Edit'
        });
        editBtn.get_style_context().add_class('hk-btn');
        addPointerCursor(editBtn);
        editBtn.connect('clicked', () => this.showEditHotkeyDialog(id, override));
        row.pack_start(editBtn, false, false, 0);

        const deleteBtn = new Gtk.Button({
            label: '×'
        });
        deleteBtn.get_style_context().add_class('hk-delete-btn');
        deleteBtn.set_tooltip_text(this.t('DELETE_HOTKEY') || 'Remove override');
        addPointerCursor(deleteBtn);
        deleteBtn.connect('clicked', () => {
            delete this.currentHotkeyOverrides[id];
            row.destroy();
            if (Object.keys(this.currentHotkeyOverrides).length === 0) {
                this.showEmptyHotkeyMessage();
            }
        });
        row.pack_start(deleteBtn, false, false, 0);

        return row;
    };

    prototype.showEmptyHotkeyMessage = function() {
        if (!this.clearHotkeyList()) return;

        const emptyLabel = new Gtk.Label({
            label: this.t('NO_HOTKEY_OVERRIDES') || 'No global hotkey overrides set.',
            halign: Gtk.Align.CENTER,
            margin_top: 20
        });
        emptyLabel.get_style_context().add_class('dim-label');
        this.hotkeyListBox.pack_start(emptyLabel, false, false, 0);
        this.hotkeyListBox.show_all();
    };

    prototype.formatKeyComboFromOverride = function(override) {
        const mods = override.metadata?.modifiers || [];
        const key = override.metadata?.key || '';

        if (!key && !mods.length) {
            return override.hotkeyId || 'Unknown';
        }

        const modNames = mods.map(m => {
            const map = { 'SUPER': 'Super', 'SHIFT': 'Shift', 'CTRL': 'Ctrl', 'ALT': 'Alt' };
            return map[m.toUpperCase()] || m;
        });

        const keyName = key.length === 1 ? key.toUpperCase() : key;
        return [...modNames, keyName].join(' + ');
    };

    prototype.showAddHotkeyDialog = function(parentDialog) {
        ensurePrototypeCssLoaded(prototype, 'hotkeyRowCssLoaded', HOTKEY_ROW_CSS);
        ensurePrototypeCssLoaded(prototype, 'captureCssLoaded', HOTKEY_CAPTURE_CSS);

        const dialog = new Gtk.Dialog({
            title: this.t('ADD_HOTKEY_TITLE') || 'Add Hotkey Override',
            modal: true,
            resizable: false,
            decorated: false
        });
        dialog.set_transient_for?.(parentDialog);
        dialog.set_default_size(420, -1);
        dialog.get_style_context().add_class('hotkey-add-dialog');

        const content = dialog.get_content_area();
        content.set_margin_top(16);
        content.set_margin_bottom(16);
        content.set_margin_start(20);
        content.set_margin_end(20);
        content.set_spacing(14);

        const bindingLabel = new Gtk.Label({
            label: 'Key Binding',
            halign: Gtk.Align.START,
            xalign: 0
        });
        bindingLabel.get_style_context().add_class('dim-label');
        content.pack_start(bindingLabel, false, false, 0);

        const bindingRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });

        let keyMode = false;
        const capturedKeys = [];

        const modeBtn = new Gtk.Button();
        modeBtn.set_image(Gtk.Image.new_from_icon_name('font-x-generic-symbolic', Gtk.IconSize.BUTTON));
        modeBtn.get_style_context().add_class('flat');
        modeBtn.set_tooltip_text('Text mode: type key combo. Click for key capture mode.');
        addPointerCursor(modeBtn);

        bindingRow.pack_start(modeBtn, false, false, 0);

        const keyEntry = new Gtk.Entry({
            placeholder_text: 'e.g., SUPER + T, CTRL + SHIFT + Q',
            hexpand: true
        });
        bindingRow.pack_start(keyEntry, true, true, 0);

        const keysFrame = new Gtk.Frame();
        keysFrame.set_no_show_all(true);
        keysFrame.get_style_context().add_class('capture-frame');

        const keysDisplayBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6, hexpand: true });
        const captureHint = new Gtk.Label({ label: 'Press keys...', hexpand: true, halign: Gtk.Align.START });
        captureHint.get_style_context().add_class('dim-label');
        keysDisplayBox.pack_start(captureHint, true, true, 0);
        keysFrame.add(keysDisplayBox);
        bindingRow.pack_start(keysFrame, true, true, 0);

        const clearKeysBtn = new Gtk.Button({ label: '×' });
        clearKeysBtn.get_style_context().add_class('flat');
        clearKeysBtn.set_tooltip_text('Clear captured keys');
        clearKeysBtn.set_no_show_all(true);
        clearKeysBtn.set_visible(false);
        addPointerCursor(clearKeysBtn);
        clearKeysBtn.connect('clicked', () => {
            capturedKeys.length = 0;
            this.updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint);
            clearKeysBtn.set_visible(false);
        });
        bindingRow.pack_start(clearKeysBtn, false, false, 0);

        content.pack_start(bindingRow, false, false, 0);

        modeBtn.connect('clicked', () => {
            keyMode = !keyMode;
            if (keyMode) {
                modeBtn.set_image(Gtk.Image.new_from_icon_name('input-keyboard-symbolic', Gtk.IconSize.BUTTON));
                modeBtn.set_tooltip_text('Key capture mode: press keys. Click for text mode.');
                keyEntry.hide();
                keysFrame.show();
                keysFrame.show_all();
                clearKeysBtn.set_visible(capturedKeys.length > 0);
                modeBtn.grab_focus();
            } else {
                modeBtn.set_image(Gtk.Image.new_from_icon_name('font-x-generic-symbolic', Gtk.IconSize.BUTTON));
                modeBtn.set_tooltip_text('Text mode: type key combo. Click for key capture mode.');
                keysFrame.hide();
                keyEntry.show();
                clearKeysBtn.set_visible(false);
                if (capturedKeys.length > 0) {
                    keyEntry.set_text(capturedKeys.join(' + '));
                }
            }
        });

        dialog.connect('key-press-event', (w, event) => {
            if (!keyMode) return false;

            const focused = dialog.get_focus();
            if (focused === keyEntry || focused === argsEntry || focused instanceof Gtk.Entry || focused instanceof Gtk.ComboBoxText) {
                return false;
            }

            const keyval = event.get_keyval()[1];
            const keyname = Gdk.keyval_name(keyval);

            if (keyname === 'Escape') {
                dialog.destroy();
                return true;
            }

            if (keyname === 'BackSpace') {
                const now = Date.now();
                const timeSince = now - (this._addDialogLastBackspace || 0);
                this._addDialogLastBackspace = now;
                if (timeSince < 500 && capturedKeys.length > 0) {
                    capturedKeys.pop();
                    this.updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint);
                    clearKeysBtn.set_visible(capturedKeys.length > 0);
                    this._addDialogLastBackspace = 0;
                }
                return true;
            }
            this._addDialogLastBackspace = 0;

            const specialKeys = {
                'Super_L': 'SUPER', 'Super_R': 'SUPER',
                'Shift_L': 'SHIFT', 'Shift_R': 'SHIFT',
                'Control_L': 'CTRL', 'Control_R': 'CTRL',
                'Alt_L': 'ALT', 'Alt_R': 'ALT',
                'Return': 'Return', 'space': 'Space',
                'Tab': 'Tab', 'Delete': 'Delete'
            };

            let normalizedKey = specialKeys[keyname] || null;
            if (!normalizedKey) {
                switch (true) {
                    case Boolean(keyname && keyname.length === 1):
                        normalizedKey = keyname.toUpperCase();
                        break;
                    case Boolean(keyname && keyname.match(/^F\d+$/)):
                    case Boolean(keyname):
                        normalizedKey = keyname;
                        break;
                }
            }

            if (normalizedKey && !capturedKeys.includes(normalizedKey)) {
                capturedKeys.push(normalizedKey);
                this.updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint);
                clearKeysBtn.set_visible(true);
            }
            return true;
        });

        const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 2, margin_bottom: 2 });
        content.pack_start(sep, false, false, 0);

        const actionLabel = new Gtk.Label({
            label: 'Action',
            halign: Gtk.Align.START,
            xalign: 0
        });
        actionLabel.get_style_context().add_class('dim-label');
        content.pack_start(actionLabel, false, false, 0);

        const dispatcherBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const dispatcherLbl = new Gtk.Label({
            label: 'Dispatcher:',
            halign: Gtk.Align.START,
            width_chars: 10
        });
        dispatcherLbl.get_style_context().add_class('dim-label');
        dispatcherBox.pack_start(dispatcherLbl, false, false, 0);

        const dispatcherCombo = new Gtk.ComboBoxText();
        const dispatchers = ['exec', 'killactive', 'workspace', 'movetoworkspace', 'togglefloating',
            'fullscreen', 'movefocus', 'movewindow', 'resizeactive', 'exit', 'togglespecialworkspace',
            'pseudo', 'togglesplit', 'focusmonitor', 'movecurrentworkspacetomonitor'];
        dispatchers.forEach(d => dispatcherCombo.append_text(d));
        dispatcherCombo.set_active(0);
        dispatcherBox.pack_start(dispatcherCombo, true, true, 0);

        content.pack_start(dispatcherBox, false, false, 0);

        const argsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const argsLbl = new Gtk.Label({
            label: 'Arguments:',
            halign: Gtk.Align.START,
            width_chars: 10
        });
        argsLbl.get_style_context().add_class('dim-label');
        argsBox.pack_start(argsLbl, false, false, 0);

        const argsEntry = new Gtk.Entry({
            placeholder_text: 'e.g., alacritty, 1, l'
        });
        argsBox.pack_start(argsEntry, true, true, 0);

        content.pack_start(argsBox, false, false, 0);

        const actionBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
            margin_top: 8
        });

        const cancelBtn = new Gtk.Button({ label: this.t('CANCEL') || 'Cancel' });
        addPointerCursor(cancelBtn);
        cancelBtn.connect('clicked', () => dialog.destroy());
        actionBox.pack_start(cancelBtn, false, false, 0);

        const addBtn = new Gtk.Button({ label: this.t('ADD') || 'Add' });
        addBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(addBtn);
        addBtn.connect('clicked', () => {
            let modifiers = [];
            let key = '';

            if (keyMode && capturedKeys.length > 0) {
                const modMap = { 'SUPER': true, 'SHIFT': true, 'CTRL': true, 'ALT': true };
                for (const k of capturedKeys) {
                    if (modMap[k]) modifiers.push(k);
                    else key = k;
                }
            } else {
                const text = keyEntry.get_text().trim();
                if (!text) {
                    keyEntry.get_style_context().add_class('error');
                    return;
                }
                const parts = text.split(/\s*\+\s*/).map(p => p.trim().toUpperCase());
                const modMap = { 'SUPER': true, 'SHIFT': true, 'CTRL': true, 'ALT': true, 'CONTROL': 'CTRL' };
                for (const p of parts) {
                    switch (true) {
                        case modMap[p] === true:
                            modifiers.push(p);
                            break;
                        case Boolean(modMap[p]):
                            modifiers.push(modMap[p]);
                            break;
                        default:
                            key = p.length === 1 ? p : p.charAt(0) + p.slice(1).toLowerCase();
                            break;
                    }
                }
            }

            if (!key) {
                if (!keyMode) keyEntry.get_style_context().add_class('error');
                return;
            }

            const dispatcher = dispatcherCombo.get_active_text();
            const args = argsEntry.get_text().trim();
            const id = `add_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            this.currentHotkeyOverrides[id] = {
                dispatcher,
                args,
                action: HotkeyAction.ADD,
                metadata: { modifiers, key, bindType: 'bind' },
                timestamp: Date.now()
            };

            dialog.destroy();
            this.refreshHotkeyListUI();
        });
        actionBox.pack_start(addBtn, false, false, 0);

        content.pack_start(actionBox, false, false, 0);

        dialog.show_all();
        keysFrame.hide();
    };


    prototype.updateCapturedKeysDisplay = function(box, keys, hintLabel) {
        box.get_children().forEach(c => c.destroy());

        if (keys.length === 0) {
            if (hintLabel) {
                box.pack_start(hintLabel, true, true, 0);
                hintLabel.show();
            }
            box.show_all();
            return;
        }

        keys.forEach((key, idx) => {
            if (idx > 0) {
                const plus = new Gtk.Label({ label: '+' });
                plus.get_style_context().add_class('dim-label');
                box.pack_start(plus, false, false, 0);
            }
            const label = new Gtk.Label({ label: key });
            label.get_style_context().add_class(`captured-key-${idx % 5}`);
            box.pack_start(label, false, false, 0);
        });
        box.show_all();
    };

    prototype.showEditHotkeyDialog = function(id, override) {
        const dialog = new Gtk.Dialog({
            title: this.t('EDIT_HOTKEY_TITLE') || 'Edit Hotkey Override',
            modal: true,
            resizable: false
        });

        if (this.hotkeyOverridesDialog) {
            dialog.set_transient_for?.(this.hotkeyOverridesDialog);
        }

        dialog.set_default_size(450, -1);

        const content = dialog.get_content_area();
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(16);
        content.set_margin_end(16);
        content.set_spacing(12);

        const keyComboBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const keyLabel = new Gtk.Label({
            label: this.t('HOTKEY') || 'Hotkey:',
            halign: Gtk.Align.START,
            width_chars: 12
        });
        keyComboBox.pack_start(keyLabel, false, false, 0);

        const keyComboDisplay = new Gtk.Label({
            label: this.formatKeyComboFromOverride(override),
            halign: Gtk.Align.START
        });
        keyComboDisplay.get_style_context().add_class('hotkey-key-combo');
        keyComboBox.pack_start(keyComboDisplay, true, true, 0);

        content.pack_start(keyComboBox, false, false, 0);

        const dispatcherBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const dispatcherLabel = new Gtk.Label({
            label: this.t('DISPATCHER') || 'Dispatcher:',
            halign: Gtk.Align.START,
            width_chars: 12
        });
        dispatcherBox.pack_start(dispatcherLabel, false, false, 0);

        const dispatcherCombo = new Gtk.ComboBoxText();
        const dispatchers = ['exec', 'killactive', 'workspace', 'movetoworkspace', 'togglefloating',
            'fullscreen', 'movefocus', 'movewindow', 'resizeactive', 'exit', 'togglespecialworkspace',
            'pseudo', 'togglesplit', 'focusmonitor', 'movecurrentworkspacetomonitor'];
        dispatchers.forEach((d, i) => {
            dispatcherCombo.append_text(d);
            if (d === override.dispatcher) dispatcherCombo.set_active(i);
        });
        if (dispatcherCombo.get_active() === -1) dispatcherCombo.set_active(0);
        dispatcherBox.pack_start(dispatcherCombo, true, true, 0);

        content.pack_start(dispatcherBox, false, false, 0);

        const argsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const argsLabel = new Gtk.Label({
            label: this.t('ARGUMENTS') || 'Arguments:',
            halign: Gtk.Align.START,
            width_chars: 12
        });
        argsBox.pack_start(argsLabel, false, false, 0);

        const argsEntry = new Gtk.Entry({
            text: override.args || ''
        });
        argsBox.pack_start(argsEntry, true, true, 0);

        content.pack_start(argsBox, false, false, 0);

        const actionBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
            margin_top: 12
        });

        const cancelBtn = new Gtk.Button({ label: this.t('CANCEL') || 'Cancel' });
        addPointerCursor(cancelBtn);
        cancelBtn.connect('clicked', () => dialog.destroy());
        actionBox.pack_start(cancelBtn, false, false, 0);

        const saveBtn = new Gtk.Button({ label: this.t('SAVE') || 'Save' });
        saveBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(saveBtn);
        saveBtn.connect('clicked', () => {
            this.currentHotkeyOverrides[id] = {
                ...override,
                dispatcher: dispatcherCombo.get_active_text(),
                args: argsEntry.get_text().trim(),
                timestamp: Date.now()
            };
            dialog.destroy();
            this.loadGlobalHotkeyOverrides();
        });
        actionBox.pack_start(saveBtn, false, false, 0);

        content.pack_start(actionBox, false, false, 0);

        dialog.show_all();
    };

    prototype.saveGlobalHotkeyOverrides = function() {
        if (!this.settingsManager) return;

        this.settingsManager.set('hotkeyOverrides', this.currentHotkeyOverrides);
        this.settingsManager.write(null, { silent: true });

        this.settings.hotkeyOverrides = { ...this.currentHotkeyOverrides };

        this.initHotkeyService();
        const freshSettings = this.settingsManager.getAll();
        const result = this.hotkeyService.regenerateAllEffectiveOverrides(freshSettings);
        if (this.logger) {
            this.logger.info(`[OverrideTabHotkeys] Regenerated effective overrides for ${result.regenerated} themes`);
            if (result.errors.length > 0) {
                this.logger.warn(`[OverrideTabHotkeys] Errors: ${result.errors.join(', ')}`);
            }
        }

        if (this.onOverridesChanged) {
            this.onOverridesChanged();
        }
    };

    prototype.showGlobalHotkeysHelpPopup = function(relativeTo) {
        const Gdk = imports.gi.Gdk;

        const popover = new Gtk.Popover();
        popover.set_relative_to(relativeTo);
        popover.set_position(Gtk.PositionType.BOTTOM);

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12
        });

        const title = new Gtk.Label({
            label: `<b>${this.t('GLOBAL_HOTKEYS_HELP_TITLE') || 'Global Hotkey Overrides Help'}</b>`,
            use_markup: true,
            halign: Gtk.Align.START
        });
        contentBox.pack_start(title, false, false, 0);

        const helpItems = [
            {
                title: this.t('HELP_GLOBAL_HOTKEYS_WHAT') || 'What are global hotkey overrides?',
                desc: this.t('HELP_GLOBAL_HOTKEYS_WHAT_DESC') || 'Hotkeys defined here will be applied to ALL themes when switching. They override theme-specific keybindings.'
            },
            {
                title: this.t('HELP_GLOBAL_HOTKEYS_ADD') || 'Add Hotkey button',
                desc: this.t('HELP_GLOBAL_HOTKEYS_ADD_DESC') || 'Create a new global hotkey override. Choose modifiers, key, dispatcher and arguments.'
            },
            {
                title: this.t('HELP_GLOBAL_HOTKEYS_EDIT') || 'Edit button',
                desc: this.t('HELP_GLOBAL_HOTKEYS_EDIT_DESC') || 'Modify the dispatcher and arguments of an existing override.'
            },
            {
                title: this.t('HELP_GLOBAL_HOTKEYS_DELETE') || 'Delete button (×)',
                desc: this.t('HELP_GLOBAL_HOTKEYS_DELETE_DESC') || 'Remove a global override. Theme\'s original keybinding will be used.'
            },
            {
                title: this.t('HELP_GLOBAL_HOTKEYS_DIG') || 'DIG button (in theme popup)',
                desc: this.t('HELP_GLOBAL_HOTKEYS_DIG_DESC') || 'Quickly copy a theme hotkey to global overrides. The button appears in per-rice hotkey settings.'
            }
        ];

        for (const item of helpItems) {
            const textBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 2
            });
            const titleLabel = new Gtk.Label({
                label: `<b>${item.title}</b>`,
                use_markup: true,
                halign: Gtk.Align.START
            });
            const descLabel = new Gtk.Label({
                label: item.desc,
                halign: Gtk.Align.START,
                wrap: true,
                max_width_chars: 45
            });
            descLabel.get_style_context().add_class('dim-label');
            textBox.pack_start(titleLabel, false, false, 0);
            textBox.pack_start(descLabel, false, false, 0);

            contentBox.pack_start(textBox, false, false, 0);
        }

        popover.add(contentBox);
        contentBox.show_all();
        popover.popup();
    };
}
