import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor} from '../../common/ViewUtils.js';

const TIMEOUT_DEFAULTS = {
    flyDebounceDelay: 150,
    regularDebounceDelay: 500,
    stabilityCheckInterval: 250,
    stabilityMaxWait: 30000,
    retryDelayBase: 2000,
    flyApplyDelay: 500,
    regularApplyDelay: 1500,
    flyRetryDelay: 300,
    regularRetryDelay: 1000,
    commandListenerInterval: 100,
    rescanAfterImportDelay: 1000,
    startupScanDelay: 200
};

const TIMEOUT_CONFIG = {
    inbox: [
        {key: 'flyDebounceDelay', labelKey: 'TIMEOUT_FLY_DEBOUNCE', tipKey: 'TIMEOUT_FLY_DEBOUNCE_TIP', min: 0, max: 10000, step: 10},
        {key: 'regularDebounceDelay', labelKey: 'TIMEOUT_REGULAR_DEBOUNCE', tipKey: 'TIMEOUT_REGULAR_DEBOUNCE_TIP', min: 0, max: 10000, step: 10},
        {key: 'stabilityCheckInterval', labelKey: 'TIMEOUT_STABILITY_INTERVAL', tipKey: 'TIMEOUT_STABILITY_INTERVAL_TIP', min: 0, max: 10000, step: 10},
        {key: 'stabilityMaxWait', labelKey: 'TIMEOUT_STABILITY_MAX', tipKey: 'TIMEOUT_STABILITY_MAX_TIP', min: 0, max: 300000, step: 100},
        {key: 'retryDelayBase', labelKey: 'TIMEOUT_RETRY_BASE', tipKey: 'TIMEOUT_RETRY_BASE_TIP', min: 0, max: 30000, step: 100}
    ],
    apply: [
        {key: 'flyApplyDelay', labelKey: 'TIMEOUT_FLY_APPLY', tipKey: 'TIMEOUT_FLY_APPLY_TIP', min: 0, max: 10000, step: 10},
        {key: 'regularApplyDelay', labelKey: 'TIMEOUT_REGULAR_APPLY', tipKey: 'TIMEOUT_REGULAR_APPLY_TIP', min: 0, max: 30000, step: 10},
        {key: 'flyRetryDelay', labelKey: 'TIMEOUT_FLY_RETRY', tipKey: 'TIMEOUT_FLY_RETRY_TIP', min: 0, max: 10000, step: 10},
        {key: 'regularRetryDelay', labelKey: 'TIMEOUT_REGULAR_RETRY', tipKey: 'TIMEOUT_REGULAR_RETRY_TIP', min: 0, max: 10000, step: 10}
    ],
    ui: [
        {key: 'commandListenerInterval', labelKey: 'TIMEOUT_COMMAND_LISTENER', tipKey: 'TIMEOUT_COMMAND_LISTENER_TIP', min: 0, max: 5000, step: 10, requiresRestart: true},
        {key: 'rescanAfterImportDelay', labelKey: 'TIMEOUT_RESCAN_IMPORT', tipKey: 'TIMEOUT_RESCAN_IMPORT_TIP', min: 0, max: 10000, step: 10},
        {key: 'startupScanDelay', labelKey: 'TIMEOUT_STARTUP_SCAN', tipKey: 'TIMEOUT_STARTUP_SCAN_TIP', min: 0, max: 10000, step: 10, requiresRestart: true}
    ]
};

export class TimeoutSettingsPopup {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.parentWindow = deps.parentWindow || null;
        this.settingsManager = deps.settingsManager || null;
        this.settings = deps.settings || null;
        this.writeSettingsFile = deps.writeSettingsFile || (() => {});
        this.dialog = null;
        this.spinButtons = {};
        this.isBuilding = false;

        this.currentTimeouts = this.loadTimeouts();
    }

    loadTimeouts() {
        const result = {...TIMEOUT_DEFAULTS};

        if (this.settingsManager?.get) {
            const timeouts = this.settingsManager.get('timeouts');
            if (timeouts && typeof timeouts === 'object') {
                for (const key of Object.keys(TIMEOUT_DEFAULTS)) {
                    if (typeof timeouts[key] === 'number' && timeouts[key] >= 0) {
                        result[key] = timeouts[key];
                    }
                }
            }
        }

        return result;
    }

    saveTimeouts() {
        const timeoutsCopy = {...this.currentTimeouts};

        if (this.settingsManager) {
            this.settingsManager.set('timeouts', timeoutsCopy);
        }

        if (this.settings) {
            this.settings.timeouts = timeoutsCopy;
        }

        this.writeSettingsFile();
    }

    open() {
        this.dialog = new Gtk.Dialog({
            title: this.t('TIMEOUT_SETTINGS_TITLE'),
            transient_for: this.parentWindow,
            modal: true,
            resizable: true,
            default_width: 500,
            default_height: 600
        });

        this.dialog.get_style_context().add_class('lastlayer-settings-dialog');

        const contentArea = this.dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_hexpand(true);
        scrolled.set_vexpand(true);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16
        });

        const descLabel = new Gtk.Label({
            label: this.t('TIMEOUT_SETTINGS_DESC'),
            wrap: true,
            xalign: 0,
            margin_bottom: 8
        });
        descLabel.get_style_context().add_class('dim-label');
        mainBox.pack_start(descLabel, false, false, 0);

        this.isBuilding = true;
        mainBox.pack_start(this.buildSection('TIMEOUT_SECTION_INBOX', TIMEOUT_CONFIG.inbox), false, false, 0);
        mainBox.pack_start(this.buildSection('TIMEOUT_SECTION_APPLY', TIMEOUT_CONFIG.apply), false, false, 0);
        mainBox.pack_start(this.buildSection('TIMEOUT_SECTION_UI', TIMEOUT_CONFIG.ui), false, false, 0);
        this.isBuilding = false;

        scrolled.add(mainBox);
        contentArea.pack_start(scrolled, true, true, 0);

        const resetBtn = this.dialog.add_button(this.t('TIMEOUT_RESET_DEFAULTS'), Gtk.ResponseType.REJECT);
        resetBtn.get_style_context().add_class('destructive-action');
        addPointerCursor(resetBtn);

        const closeBtn = this.dialog.add_button(this.t('CLOSE'), Gtk.ResponseType.CLOSE);
        closeBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(closeBtn);

        this.dialog.connect('response', (dlg, responseId) => {
            if (responseId === Gtk.ResponseType.REJECT) {
                this.resetToDefaults();
            } else {
                dlg.destroy();
            }
        });

        this.dialog.show_all();
    }

    buildSection(titleKey, items) {
        const frame = new Gtk.Frame({label: this.t(titleKey)});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        for (const item of items) {
            contentBox.pack_start(this.buildTimeoutRow(item), false, false, 0);
        }

        frame.add(contentBox);
        return frame;
    }

    buildTimeoutRow(item) {
        const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});

        const labelBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2});
        labelBox.set_hexpand(true);

        const labelText = item.requiresRestart
            ? `${this.t(item.labelKey)} ⟳`
            : this.t(item.labelKey);
        const label = new Gtk.Label({
            label: labelText,
            halign: Gtk.Align.START,
            xalign: 0
        });
        labelBox.pack_start(label, false, false, 0);

        const tipText = item.requiresRestart
            ? `${this.t(item.tipKey)} (${this.t('REQUIRES_RESTART')})`
            : this.t(item.tipKey);
        const tipLabel = new Gtk.Label({
            label: tipText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        tipLabel.get_style_context().add_class('dim-label');
        labelBox.pack_start(tipLabel, false, false, 0);

        row.pack_start(labelBox, true, true, 0);

        const currentValue = this.currentTimeouts[item.key] ?? TIMEOUT_DEFAULTS[item.key];
        const safeValue = Math.max(item.min, Math.min(item.max, currentValue));

        const spinBtn = Gtk.SpinButton.new_with_range(item.min, item.max, item.step);
        spinBtn.set_digits(0);
        spinBtn.set_width_chars(7);
        spinBtn.set_value(safeValue);

        this.spinButtons[item.key] = spinBtn;

        const unitLabel = new Gtk.Label({label: this.t('TIMEOUT_MS')});
        unitLabel.get_style_context().add_class('dim-label');

        const key = item.key;
        spinBtn.connect('value-changed', () => {
            if (this.isBuilding) return;
            this.currentTimeouts[key] = Math.round(spinBtn.get_value());
            this.saveTimeouts();
        });

        row.pack_start(spinBtn, false, false, 0);
        row.pack_start(unitLabel, false, false, 0);

        return row;
    }

    resetToDefaults() {
        this.isBuilding = true;

        for (const [key, defaultValue] of Object.entries(TIMEOUT_DEFAULTS)) {
            const spinBtn = this.spinButtons[key];
            if (spinBtn) {
                spinBtn.set_value(defaultValue);
            }
            this.currentTimeouts[key] = defaultValue;
        }

        this.isBuilding = false;

        this.saveTimeouts();
    }

    destroy() {
        this.dialog?.destroy();
        this.dialog = null;
    }
}
