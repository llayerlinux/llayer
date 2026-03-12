import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { tryOrDefault, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import {addPointerCursor} from '../../common/ViewUtils.js';
import {TimeoutSettingsPopup} from '../dialogs/TimeoutSettingsPopup.js';

export class ImportTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings || {};
        this.widgets = deps.widgets || {};
        this.view = deps.view;
        this.dialog = deps.dialog;
        this.writeSettingsFile = deps.writeSettingsFile || (() => {});
        this.notify = deps.notify || (() => {});
        this.container = deps.container;
        this.eventBus = deps.eventBus;
        this.settingsManager = deps.settingsManager || this.container?.get?.('settingsManager') || null;
    }

    build() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 16,
            margin_end: 16
        });

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_hexpand(true);
        scrolled.set_vexpand(true);

        const innerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12
        });

        this.buildPreviewSourceSection(innerBox);
        this.buildUnificationSection(innerBox);
        this.buildImportLogSection(innerBox);
        this.buildAutoApplySection(innerBox);
        this.buildBarPrivacySection(innerBox);
        this.buildFlyModeSection(innerBox);
        this.buildImportHistorySection(innerBox);

        scrolled.add(innerBox);
        box.pack_start(scrolled, true, true, 0);

        const tabLabel = new Gtk.Label({label: this.t('IMPORT_TAB')});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return {box, tabLabel};
    }

    buildPreviewSourceSection(box) {
        const frame = new Gtk.Frame({label: this.t('IMPORT_SETTINGS_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const previewRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const previewLabel = new Gtk.Label({
            label: this.t('PREVIEW_SOURCE_LABEL'),
            halign: Gtk.Align.START
        });
        previewRow.pack_start(previewLabel, false, false, 0);

        const previewCombo = new Gtk.ComboBoxText();
        previewCombo.append('auto', this.t('PREVIEW_SOURCE_AUTO'));
        previewCombo.append('browser', this.t('PREVIEW_SOURCE_BROWSER'));
        previewCombo.append('algorithm', this.t('PREVIEW_SOURCE_ALGORITHM'));
        previewCombo.set_active_id(this.settings.previewSource || 'auto');
        this.widgets.previewSourceCombo = previewCombo;
        previewRow.pack_start(previewCombo, false, false, 0);

        previewCombo.connect('changed', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.previewSource = previewCombo.get_active_id();
            this.writeSettingsFile();
        });

        contentBox.pack_start(previewRow, false, false, 0);

        const previewNote = new Gtk.Label({
            label: this.t('PREVIEW_SOURCE_NOTE'),
            wrap: true,
            xalign: 0,
            margin_top: 4
        });
        previewNote.get_style_context().add_class('dim-label');
        contentBox.pack_start(previewNote, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    buildUnificationSection(box) {
        const frame = new Gtk.Frame({label: this.t('UNIFICATION_SECTION_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const phase2Label = new Gtk.Label({
            label: `<b>${this.t('UNIFICATION_PHASE2_LABEL')}</b>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_bottom: 4
        });
        contentBox.pack_start(phase2Label, false, false, 0);

        const swayConvertRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});

        const swayConvertCheck = new Gtk.CheckButton({label: this.t('UNIFICATION_SWAY_CONVERT')});
        swayConvertCheck.set_active(this.settings.swayToHyprlandConvert !== false);
        this.widgets.swayToHyprlandConvertCheck = swayConvertCheck;

        swayConvertCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.swayToHyprlandConvert = swayConvertCheck.get_active();
            this.writeSettingsFile();
        });

        swayConvertRow.pack_start(swayConvertCheck, false, false, 0);

        const gearButton = new Gtk.Button();
        gearButton.set_image(new Gtk.Image({icon_name: 'emblem-system-symbolic', icon_size: Gtk.IconSize.BUTTON}));
        gearButton.set_tooltip_text(this.t('SWAY_CONVERT_SETTINGS_TOOLTIP') || 'Sway conversion settings');
        gearButton.get_style_context().add_class('flat');
        addPointerCursor(gearButton);

        const popover = new Gtk.Popover();
        popover.set_relative_to(gearButton);

        const popoverBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12
        });

        const currentFixFonts = this.settingsManager?.get?.('swayConvertFixFonts') ?? this.settings?.swayConvertFixFonts;
        const fixFontsCheck = new Gtk.CheckButton({label: this.t('SWAY_CONVERT_FIX_FONTS') || 'Fix waybar font fallbacks'});
        fixFontsCheck.set_tooltip_text(this.t('SWAY_CONVERT_FIX_FONTS_TIP') || 'Add fallback fonts (e.g. iosevka → Iosevka Nerd Font)');
        fixFontsCheck.set_active(currentFixFonts !== false);
        this.widgets.swayConvertFixFontsCheck = fixFontsCheck;
        fixFontsCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            const enabled = fixFontsCheck.get_active();
            if (this.settingsManager?.set) {
                this.settingsManager.set('swayConvertFixFonts', enabled);
            }
            this.settings.swayConvertFixFonts = enabled;
            this.writeSettingsFile();
        });
        popoverBox.pack_start(fixFontsCheck, false, false, 0);

        const currentFixActive = this.settingsManager?.get?.('swayConvertFixActive') ?? this.settings?.swayConvertFixActive;
        const fixActiveCheck = new Gtk.CheckButton({label: this.t('SWAY_CONVERT_FIX_ACTIVE') || 'Fix waybar active workspace'});
        fixActiveCheck.set_tooltip_text(this.t('SWAY_CONVERT_FIX_ACTIVE_TIP') || 'Add button.active selector for Hyprland (Sway uses button.focused)');
        fixActiveCheck.set_active(currentFixActive !== false);
        this.widgets.swayConvertFixActiveCheck = fixActiveCheck;
        fixActiveCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            const enabled = fixActiveCheck.get_active();
            if (this.settingsManager?.set) {
                this.settingsManager.set('swayConvertFixActive', enabled);
            }
            this.settings.swayConvertFixActive = enabled;
            this.writeSettingsFile();
        });
        popoverBox.pack_start(fixActiveCheck, false, false, 0);

        popover.add(popoverBox);
        popoverBox.show_all();

        gearButton.connect('clicked', () => {
            popover.popup();
        });

        swayConvertRow.pack_start(gearButton, false, false, 0);
        contentBox.pack_start(swayConvertRow, false, false, 0);

        const swayNote = new Gtk.Label({
            label: this.t('UNIFICATION_SWAY_CONVERT_NOTE'),
            wrap: true,
            xalign: 0,
            margin_top: 4,
            margin_start: 24
        });
        swayNote.get_style_context().add_class('dim-label');
        contentBox.pack_start(swayNote, false, false, 0);

        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL, margin_top: 8, margin_bottom: 8});
        contentBox.pack_start(separator, false, false, 0);

        const wallpaperExecCheck = new Gtk.CheckButton({label: this.t('COMMENT_OUT_WALLPAPER_EXECS')});
        wallpaperExecCheck.set_tooltip_text(this.t('COMMENT_OUT_WALLPAPER_EXECS_TIP'));
        const savedValue = this.settingsManager?.get?.('commentOutWallpaperExecs');
        wallpaperExecCheck.set_active(savedValue ?? this.settings.commentOutWallpaperExecs ?? false);
        this.widgets.commentOutWallpaperExecsCheck = wallpaperExecCheck;

        wallpaperExecCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            const value = wallpaperExecCheck.get_active();
            this.settings.commentOutWallpaperExecs = value;
            this.settingsManager?.set?.('commentOutWallpaperExecs', value);
            this.writeSettingsFile();
        });

        contentBox.pack_start(wallpaperExecCheck, false, false, 0);

        const wallpaperNote = new Gtk.Label({
            label: this.t('COMMENT_OUT_WALLPAPER_EXECS_NOTE'),
            wrap: true,
            xalign: 0,
            margin_top: 4,
            margin_start: 24
        });
        wallpaperNote.get_style_context().add_class('dim-label');
        contentBox.pack_start(wallpaperNote, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    buildImportLogSection(box) {
        const frame = new Gtk.Frame({label: this.t('IMPORT_LOG_SECTION_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const disableCheck = new Gtk.CheckButton({label: this.t('IMPORT_LOG_DISABLE')});
        disableCheck.set_active(this.settings.importLogDisabled || false);
        this.widgets.importLogDisabledCheck = disableCheck;

        const autoHideCheck = new Gtk.CheckButton({label: this.t('IMPORT_LOG_AUTO_HIDE')});
        autoHideCheck.set_active(this.settings.importLogAutoHide !== false);
        this.widgets.importLogAutoHideCheck = autoHideCheck;

        disableCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            const isDisabled = disableCheck.get_active();
            this.settings.importLogDisabled = isDisabled;
            if (isDisabled) {
                autoHideCheck.set_active(false);
                autoHideCheck.set_sensitive(false);
                this.settings.importLogAutoHide = false;
            } else {
                autoHideCheck.set_sensitive(true);
            }
            this.writeSettingsFile();
        });

        autoHideCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            const isAutoHide = autoHideCheck.get_active();
            this.settings.importLogAutoHide = isAutoHide;
            if (isAutoHide) {
                disableCheck.set_active(false);
                disableCheck.set_sensitive(true);
                this.settings.importLogDisabled = false;
            }
            this.writeSettingsFile();
        });

        if (this.settings.importLogDisabled) {
            autoHideCheck.set_sensitive(false);
        }

        contentBox.pack_start(disableCheck, false, false, 0);
        contentBox.pack_start(autoHideCheck, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    buildAutoApplySection(box) {
        const frame = new Gtk.Frame({label: this.t('AUTO_APPLY_SECTION_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const autoApplyCheck = new Gtk.CheckButton({label: this.t('AUTO_APPLY_AFTER_IMPORT')});
        autoApplyCheck.set_active(this.settings.autoApplyAfterImport || false);
        this.widgets.autoApplyAfterImportCheck = autoApplyCheck;

        autoApplyCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.autoApplyAfterImport = autoApplyCheck.get_active();
            this.writeSettingsFile();
        });

        contentBox.pack_start(autoApplyCheck, false, false, 0);

        const warningNote = new Gtk.Label({
            label: this.t('AUTO_APPLY_WARNING'),
            wrap: true,
            xalign: 0,
            margin_top: 4
        });
        warningNote.get_style_context().add_class('dim-label');
        contentBox.pack_start(warningNote, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    buildBarPrivacySection(box) {
        const frame = new Gtk.Frame({label: this.t('BAR_PRIVACY_SECTION_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const timeoutRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        const timeoutLabel = new Gtk.Label({
            label: this.t('BAR_DETECTION_TIMEOUT_LABEL'),
            halign: Gtk.Align.START
        });
        timeoutRow.pack_start(timeoutLabel, false, false, 0);

        const timeoutAdjustment = new Gtk.Adjustment({
            value: this.settings.alt_timeout ?? 0.5,
            lower: 0.1,
            upper: 10.0,
            step_increment: 0.1,
            page_increment: 1.0
        });
        const timeoutSpin = new Gtk.SpinButton({
            adjustment: timeoutAdjustment,
            digits: 1,
            width_chars: 5
        });
        this.widgets.barDetectionTimeoutSpin = timeoutSpin;

        timeoutSpin.connect('value-changed', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.alt_timeout = timeoutSpin.get_value();
            this.writeSettingsFile();
        });

        timeoutRow.pack_start(timeoutSpin, false, false, 0);
        contentBox.pack_start(timeoutRow, false, false, 0);

        const timeoutNote = new Gtk.Label({
            label: this.t('BAR_DETECTION_TIMEOUT_NOTE'),
            wrap: true,
            xalign: 0,
            margin_top: 4
        });
        timeoutNote.get_style_context().add_class('dim-label');
        contentBox.pack_start(timeoutNote, false, false, 0);

        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL, margin_top: 8, margin_bottom: 8});
        contentBox.pack_start(separator, false, false, 0);

        const wifiCheck = new Gtk.CheckButton({label: this.t('HIDE_WIFI_NAME_LABEL')});
        wifiCheck.set_active(this.settings.hideWifiNameOnImport || false);
        this.widgets.hideWifiNameCheck = wifiCheck;

        wifiCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.hideWifiNameOnImport = wifiCheck.get_active();
            this.writeSettingsFile();
        });

        contentBox.pack_start(wifiCheck, false, false, 0);

        const wifiNote = new Gtk.Label({
            label: this.t('HIDE_WIFI_NAME_NOTE'),
            wrap: true,
            xalign: 0,
            margin_top: 4
        });
        wifiNote.get_style_context().add_class('dim-label');
        contentBox.pack_start(wifiNote, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    buildFlyModeSection(box) {
        const frame = new Gtk.Frame({label: this.t('FLY_MODE_SECTION_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const descLabel = new Gtk.Label({
            label: this.t('FLY_MODE_DESCRIPTION'),
            wrap: true,
            xalign: 0,
            margin_bottom: 8
        });
        descLabel.get_style_context().add_class('dim-label');
        contentBox.pack_start(descLabel, false, false, 0);

        const parallelCheck = new Gtk.CheckButton({label: this.t('FLY_PARALLEL_APPLY')});
        parallelCheck.set_tooltip_text(this.t('FLY_PARALLEL_APPLY_TIP'));
        parallelCheck.set_active(this.settings.flyParallelApply !== false);
        this.widgets.flyParallelApplyCheck = parallelCheck;
        parallelCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flyParallelApply = parallelCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(parallelCheck, false, false, 0);

        const skipHeavyCheck = new Gtk.CheckButton({label: this.t('FLY_SKIP_HEAVY_PHASES')});
        skipHeavyCheck.set_tooltip_text(this.t('FLY_SKIP_HEAVY_PHASES_TIP'));
        skipHeavyCheck.set_active(this.settings.flySkipHeavyPhases || false);
        this.widgets.flySkipHeavyPhasesCheck = skipHeavyCheck;
        skipHeavyCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flySkipHeavyPhases = skipHeavyCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(skipHeavyCheck, false, false, 0);

        const preloadWallpaperCheck = new Gtk.CheckButton({label: this.t('FLY_PRELOAD_WALLPAPER')});
        preloadWallpaperCheck.set_tooltip_text(this.t('FLY_PRELOAD_WALLPAPER_TIP'));
        preloadWallpaperCheck.set_active(this.settings.flyPreloadWallpaper !== false);
        this.widgets.flyPreloadWallpaperCheck = preloadWallpaperCheck;
        preloadWallpaperCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flyPreloadWallpaper = preloadWallpaperCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(preloadWallpaperCheck, false, false, 0);

        const warmBarCheck = new Gtk.CheckButton({label: this.t('FLY_WARM_BAR_PROCESS')});
        warmBarCheck.set_tooltip_text(this.t('FLY_WARM_BAR_PROCESS_TIP'));
        warmBarCheck.set_active(this.settings.flyWarmBarProcess || false);
        this.widgets.flyWarmBarProcessCheck = warmBarCheck;
        warmBarCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flyWarmBarProcess = warmBarCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(warmBarCheck, false, false, 0);

        const pregenScriptCheck = new Gtk.CheckButton({label: this.t('FLY_PREGEN_SCRIPT')});
        pregenScriptCheck.set_tooltip_text(this.t('FLY_PREGEN_SCRIPT_TIP'));
        pregenScriptCheck.set_active(this.settings.flyPregenScript || false);
        this.widgets.flyPregenScriptCheck = pregenScriptCheck;
        pregenScriptCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flyPregenScript = pregenScriptCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(pregenScriptCheck, false, false, 0);

        const skipInstallCheck = new Gtk.CheckButton({label: this.t('FLY_SKIP_INSTALL_SCRIPT')});
        skipInstallCheck.set_tooltip_text(this.t('FLY_SKIP_INSTALL_SCRIPT_TIP'));
        skipInstallCheck.set_active(this.settings.flySkipInstallScript || false);
        this.widgets.flySkipInstallScriptCheck = skipInstallCheck;
        skipInstallCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flySkipInstallScript = skipInstallCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(skipInstallCheck, false, false, 0);

        const earlyOverridesCheck = new Gtk.CheckButton({label: this.t('FLY_EARLY_OVERRIDES')});
        earlyOverridesCheck.set_tooltip_text(this.t('FLY_EARLY_OVERRIDES_TIP'));
        earlyOverridesCheck.set_active(this.settings.flyEarlyOverrides !== false);
        this.widgets.flyEarlyOverridesCheck = earlyOverridesCheck;
        earlyOverridesCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flyEarlyOverrides = earlyOverridesCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(earlyOverridesCheck, false, false, 0);

        const seamlessCheck = new Gtk.CheckButton({label: this.t('FLY_SEAMLESS_MODE')});
        seamlessCheck.set_tooltip_text(this.t('FLY_SEAMLESS_MODE_TIP'));
        seamlessCheck.set_active(this.settings.flySeamlessMode || false);
        this.widgets.flySeamlessModeCheck = seamlessCheck;
        seamlessCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flySeamlessMode = seamlessCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(seamlessCheck, false, false, 0);

        const disableNotifyCheck = new Gtk.CheckButton({label: this.t('FLY_DISABLE_EXTERNAL_NOTIFICATIONS')});
        disableNotifyCheck.set_tooltip_text(this.t('FLY_DISABLE_EXTERNAL_NOTIFICATIONS_TIP'));
        disableNotifyCheck.set_active(this.settings.flyDisableExternalNotifications || false);
        this.widgets.flyDisableExternalNotificationsCheck = disableNotifyCheck;
        disableNotifyCheck.connect('toggled', () => {
            if (this.view?.updatingFromStore) return;
            this.settings.flyDisableExternalNotifications = disableNotifyCheck.get_active();
            this.writeSettingsFile();
        });
        contentBox.pack_start(disableNotifyCheck, false, false, 0);

        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL, margin_top: 8, margin_bottom: 8});
        contentBox.pack_start(separator, false, false, 0);

        const timeoutBtn = new Gtk.Button({label: this.t('TIMEOUT_SETTINGS_BUTTON')});
        timeoutBtn.set_tooltip_text(this.t('TIMEOUT_SETTINGS_DESC'));
        addPointerCursor(timeoutBtn);
        timeoutBtn.connect('clicked', () => this.showTimeoutSettingsPopup());
        contentBox.pack_start(timeoutBtn, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    showTimeoutSettingsPopup() {
        const popup = new TimeoutSettingsPopup({
            t: this.t,
            parentWindow: this.dialog,
            settingsManager: this.settingsManager,
            settings: this.settings,
            writeSettingsFile: () => this.writeSettingsFile()
        });
        popup.open();
    }

    buildImportHistorySection(box) {
        const frame = new Gtk.Frame({label: this.t('IMPORT_HISTORY_SECTION_LABEL')});

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const historyBtn = new Gtk.Button({label: this.t('SHOW_IMPORT_HISTORY')});
        addPointerCursor(historyBtn);
        historyBtn.connect('clicked', () => this.showImportHistoryDialog());
        contentBox.pack_start(historyBtn, false, false, 0);

        frame.add(contentBox);
        box.pack_start(frame, false, false, 0);
    }

    showImportHistoryDialog() {
        const dialog = new Gtk.Dialog({
            title: this.t('IMPORT_HISTORY_TITLE'),
            modal: true,
            resizable: true,
            default_width: 600,
            default_height: 500
        });

        if (this.dialog) {
            dialog.set_transient_for(this.dialog);
        }

        dialog.get_style_context().add_class('lastlayer-settings-dialog');

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_hexpand(true);
        scrolled.set_vexpand(true);

        const textView = new Gtk.TextView();
        textView.set_editable(false);
        textView.set_cursor_visible(false);
        textView.set_wrap_mode(Gtk.WrapMode.WORD);
        textView.set_left_margin(8);
        textView.set_right_margin(8);
        textView.set_top_margin(8);
        textView.set_bottom_margin(8);

        const buffer = textView.get_buffer();
        const historyText = this.loadImportHistory();
        buffer.set_text(historyText, -1);

        scrolled.add(textView);
        contentArea.pack_start(scrolled, true, true, 0);

        const clearBtn = dialog.add_button(this.t('CLEAR_IMPORT_HISTORY'), Gtk.ResponseType.REJECT);
        clearBtn.get_style_context().add_class('destructive-action');
        addPointerCursor(clearBtn);

        const closeBtn = dialog.add_button(this.t('CLOSE'), Gtk.ResponseType.CLOSE);
        closeBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(closeBtn);

        dialog.connect('response', (dlg, responseId) => {
            if (responseId === Gtk.ResponseType.REJECT) {
                this.clearImportHistory();
                buffer.set_text(this.t('IMPORT_HISTORY_CLEARED'), -1);
            } else {
                dlg.destroy();
            }
        });

        dialog.show_all();
    }

    loadImportHistory() {
        const emptyHistoryMessage = this.t('IMPORT_HISTORY_EMPTY');
        return tryOrDefault('ImportTab.loadImportHistory', () => {
            const [ok, content] = GLib.file_get_contents(this.getImportHistoryPath());
            if (ok) {
                return new TextDecoder('utf-8').decode(content) || emptyHistoryMessage;
            }
            return emptyHistoryMessage;
        }, emptyHistoryMessage);
    }

    clearImportHistory() {
        tryRun('ImportTab.clearImportHistory', () => {
            GLib.file_set_contents(this.getImportHistoryPath(), '');
        });
    }

    getImportHistoryPath() {
        return `${GLib.get_user_cache_dir()}/llayer-import-history.log`;
    }
}
