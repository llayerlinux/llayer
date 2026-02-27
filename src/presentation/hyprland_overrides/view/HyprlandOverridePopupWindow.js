import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { addPointerCursor, applyOptionalSetters, wrapTabLabel } from '../../common/ViewUtils.js';
import { runMessageDialog } from '../../common/ViewUtilsDialogs.js';
import { tryOrNull, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import { Events } from '../../../app/eventBus.js';

function resetOverrideState(context) {
    context.originalValues = {};
    context.currentOverrides = {};
    context.globalOverrides = {};
    context.globalOverrideInitiators = {};
    context.globalHotkeyInitiators = {};
    context.themeAltTimeout = null;
}

export function applyHyprlandOverridePopupWindow(prototype) {

    prototype.show = function(theme, parentWindow = null) {
        if (!theme) return;

        this.currentTheme = theme;
        this.parentWindow = parentWindow;
        this._hotkeyOverridesInitialized = false;
        this.digRollbackHotkeysSnapshot = null;
        this.digRollbackParamsSnapshot = null;
        this.digRollbackHotkeyInitiatorsSnapshot = null;
        this.digRollbackParamInitiatorsSnapshot = null;
        this.digParamTargets = {};
        this.loadOverrides();

        this.popup?.destroy?.();

        this.createPopupWindow();
        this.buildContent();

        this.popup.show_all();
        this.popup.present();
        this.popup.grab_focus();

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            const win = this.popup?.get_window?.();
            win?.show?.();
            win?.raise?.();
            win?.focus?.(0);
            return GLib.SOURCE_REMOVE;
        });
    };

    prototype.hide = function() {
        this.popup?.destroy?.();
        this.popup = null;
        this.currentTheme = null;
        this.parameterEntries.clear();
    };

    prototype.handleCancelClose = function() {
        const hasHotkeyChanges = this.digRollbackHotkeysSnapshot != null;
        const hasParamChanges = this.digRollbackParamsSnapshot != null;

        if (!hasHotkeyChanges && !hasParamChanges) {
            this.hide();
            return;
        }

        const response = runMessageDialog({
            parent: this.popup,
            modal: true,
            messageType: Gtk.MessageType.WARNING,
            buttons: Gtk.ButtonsType.YES_NO,
            title: this.t('DIG_ROLLBACK_TITLE') || 'Rollback DIG changes?',
            secondaryText: this.t('DIG_ROLLBACK_TEXT') || 'You used DIG which changes global settings. Roll back these global changes?',
            keepAbove: true,
            urgencyHint: true
        });

        if (response === Gtk.ResponseType.YES) {
            if (hasParamChanges) {
                this.globalOverrides = this.digRollbackParamsSnapshot ?? {};
                this.globalOverrideInitiators = this.digRollbackParamInitiatorsSnapshot ?? {};

                const settingsManager = this.settingsManager;
                if (settingsManager?.set) {
                    settingsManager.writeGlobalHyprland?.(this.globalOverrides ?? {}, this.globalOverrideInitiators ?? {});
                    settingsManager.set('hyprlandOverrides', this.globalOverrides ?? {});
                    settingsManager.write?.(null, { silent: true, force: true });
                }

                this.eventBus?.emit?.(Events.HYPRLAND_GLOBAL_OVERRIDES_CHANGED, {
                    overrides: { ...(this.globalOverrides ?? {}) },
                    initiators: { ...(this.globalOverrideInitiators ?? {}) },
                    emitter: 'HyprlandOverridePopup'
                });
            }

            if (hasHotkeyChanges) {
                this.globalHotkeyOverrides = this.digRollbackHotkeysSnapshot ?? {};
                this.globalHotkeyInitiators = this.digRollbackHotkeyInitiatorsSnapshot ?? {};
                this.saveGlobalHotkeyOverrides?.();
            }
        }

        this.hide();
    };

    prototype.createPopupWindow = function() {
        this.popup = new Gtk.Dialog({
            title: `${this.t('HYPRLAND_PARAMS_TITLE') || 'Hyprland Parameters'} - ${this.currentTheme?.title || this.currentTheme?.name || ''}`,
            modal: true,
            resizable: true,
            default_width: 620,
            default_height: 550
        });

        applyOptionalSetters([[this.parentWindow, (window) => this.popup.set_transient_for(window), Boolean]]);

        this.popup.set_keep_above(true);
        this.popup.set_type_hint(1);
        this.popup.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);
        this.popup.get_style_context().add_class('hyprland-override-popup');

        this.popup.connect('key-press-event', (widget, event) => {
            const [ok, keyval] = event.get_keyval();
            return ok && keyval === 65307 ? (this.handleCancelClose(), true) : false;
        });

        this.popup.connect('delete-event', () => (this.handleCancelClose(), true));

        this.popup.connect('destroy', () => {
            this.popup = null;
        });

        const actionArea = this.popup.get_action_area?.();
        applyOptionalSetters([[actionArea, (area) => {
            area.hide();
            area.set_no_show_all(true);
        }]]);
    };

    prototype.buildContent = function() {
        const contentArea = this.popup.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        this.notebook = new Gtk.Notebook();
        this.notebook.set_show_border(false);

        const addTab = (labelText, buildFn) => {
            const page = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8
            });
            page.set_margin_top(12);
            page.set_margin_start(8);
            page.set_margin_end(8);
            buildFn?.(page);
            const label = new Gtk.Label({ label: labelText });
            this.notebook.append_page(page, wrapTabLabel(label));
            return page;
        };

        addTab(this.t('HYPRLAND_PARAMS_TAB') || 'Hyprland', (page) => {
            this.buildHeader(page);
            this.buildParameterList(page);
        });

        addTab(this.t('HOTKEYS_TAB') || 'HotKeys', (page) => {
            this.buildHotkeysTab?.(page);
        });

        addTab(this.t('RECOMMENDATIONS_TAB') || 'Recommendations', (page) => {
            this.buildRecommendationsTab?.(page);
        });

        addTab(this.t('THEME_SETTINGS_TAB') || 'Settings', (page) => {
            this.buildThemeSettingsTab(page);
        });

        contentArea.pack_start(this.notebook, true, true, 0);

        this.buildActionButtons(contentArea);

        this.notebook.connect('switch-page', (notebook, page, pageNum) => {
            this.updateActionButtonsVisibility(pageNum);
        });
    };

    prototype.updateActionButtonsVisibility = function(pageNum) {
        const showHyprlandButtons = pageNum === 0;
        applyOptionalSetters([
            [this.resetAllBtn, (button) => button.set_visible(showHyprlandButtons)],
            [this.setSystemBtn, (button) => button.set_visible(showHyprlandButtons)]
        ]);
    };

    prototype.buildThemeSettingsTab = function(box) {
        const desc = new Gtk.Label({
            label: this.t('THEME_SETTINGS_DESC') || 'Per-rice settings that affect theme behavior.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        desc.set_margin_bottom(12);
        box.pack_start(desc, false, false, 0);

        const altTimeoutRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });
        altTimeoutRow.set_margin_bottom(8);

        const altTimeoutLabel = new Gtk.Label({
            label: this.t('ALT_BAR_TIMEOUT_LABEL') || 'Alt Bar Detection Timeout',
            halign: Gtk.Align.START,
            xalign: 0
        });
        altTimeoutLabel.set_size_request(200, -1);
        altTimeoutRow.pack_start(altTimeoutLabel, false, false, 0);

        const adjustment = new Gtk.Adjustment({
            lower: 0.1,
            upper: 10,
            step_increment: 0.1,
            page_increment: 0.5,
            value: this.themeAltTimeout ?? 0.5
        });

        this.altTimeoutSpinner = new Gtk.SpinButton({
            adjustment: adjustment,
            digits: 1,
            numeric: true,
            width_chars: 6
        });
        this.altTimeoutSpinner.set_tooltip_text(
            this.t('ALT_BAR_TIMEOUT_TOOLTIP') ||
            'Time to wait for theme bar before launching alt bar (seconds). Default: 0.5s'
        );
        altTimeoutRow.pack_start(this.altTimeoutSpinner, false, false, 0);

        const secondsLabel = new Gtk.Label({ label: 's' });
        secondsLabel.get_style_context().add_class('dim-label');
        altTimeoutRow.pack_start(secondsLabel, false, false, 0);

        const resetBtn = new Gtk.Button({ label: this.t('USE_DEFAULT') || 'Default' });
        resetBtn.set_tooltip_text(this.t('USE_DEFAULT_TOOLTIP') || 'Reset to global default (0.5s)');
        addPointerCursor(resetBtn);
        resetBtn.connect('clicked', () => {
            this.altTimeoutSpinner.set_value(0.5);
            this.themeAltTimeout = null;
        });
        altTimeoutRow.pack_start(resetBtn, false, false, 0);

        box.pack_start(altTimeoutRow, false, false, 0);

        const hint = new Gtk.Label({
            label: this.t('ALT_BAR_TIMEOUT_HINT') ||
                'This setting controls how long to wait for the theme\'s bar to start before launching your alt_bar.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        hint.get_style_context().add_class('dim-label');
        hint.set_margin_top(8);
        box.pack_start(hint, false, false, 0);

        const spacer = new Gtk.Box({ vexpand: true });
        box.pack_start(spacer, true, true, 0);
    };

    prototype.buildHeader = function(box) {
        const desc = new Gtk.Label({
            label: this.t('PER_RICE_OVERRIDE_DESC') || 'Override parameters for this specific theme. These take priority over global settings.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        desc.set_margin_bottom(8);
        box.pack_start(desc, false, false, 0);
    };

    prototype.buildParameterList = function(box) {
        this.sizeGroups = {
            name: new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL }),
            input: new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL }),
            global: new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL }),
            arrow: new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL }),
            original: new Gtk.SizeGroup({ mode: Gtk.SizeGroupMode.HORIZONTAL })
        };

        const valueColumnWidth = 170;
        this.valueColumnWidth = valueColumnWidth;

        const headerRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_bottom: 4
        });

        const nameHeader = new Gtk.Label({
            label: `● ${this.t('OVERRIDDEN_LABEL') || 'Overridden'}`,
            halign: Gtk.Align.START,
            xalign: 0
        });
        nameHeader.set_size_request(150, -1);
        nameHeader.get_style_context().add_class('success');
        this.sizeGroups.name.add_widget(nameHeader);
        headerRow.pack_start(nameHeader, false, false, 0);

        const valueHeader = new Gtk.Label({
            label: this.t('VALUE_HEADER') || 'Value',
            halign: Gtk.Align.CENTER
        });
        valueHeader.set_size_request(valueColumnWidth, -1);
        valueHeader.get_style_context().add_class('dim-label');
        this.sizeGroups.input.add_widget(valueHeader);
        headerRow.pack_start(valueHeader, false, false, 0);

        const globalSpacer = new Gtk.Label({ label: '' });
        globalSpacer.set_size_request(70, -1);
        this.sizeGroups.global.add_widget(globalSpacer);
        headerRow.pack_start(globalSpacer, false, false, 0);

        const arrowSpacer = new Gtk.Label({ label: '' });
        arrowSpacer.set_size_request(40, -1);
        this.sizeGroups.arrow.add_widget(arrowSpacer);
        headerRow.pack_start(arrowSpacer, false, false, 0);

        const originalHeader = new Gtk.Label({
            label: this.t('ORIGINAL_LABEL') || 'Original',
            halign: Gtk.Align.CENTER
        });
        originalHeader.set_size_request(110, -1);
        originalHeader.get_style_context().add_class('dim-label');
        this.sizeGroups.original.add_widget(originalHeader);
        headerRow.pack_start(originalHeader, false, false, 0);

        box.pack_start(headerRow, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            expand: true
        });

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        const parameters = this.getSortedParameters();

        for (const param of parameters) {
            const row = this.buildParameterRow(param);
            listBox.pack_start(row, false, false, 0);
        }

        scrolled.add(listBox);
        box.pack_start(scrolled, true, true, 0);
    };

    prototype.buildActionButtons = function(box) {
        const buttonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 12
        });

        const resetLabel = this.t('RESET_ALL_BTN');
        this.resetAllBtn = new Gtk.Button({
            label: resetLabel === 'RESET_ALL_BTN' ? 'Reset All' : resetLabel
        });
        this.resetAllBtn.get_style_context().add_class('destructive-action');
        addPointerCursor(this.resetAllBtn);
        this.resetAllBtn.connect('clicked', () => this.handleResetAll());
        buttonBox.pack_start(this.resetAllBtn, false, false, 0);

        const setSystemLabel = this.t('SET_SYSTEM_BTN');
        this.setSystemBtn = new Gtk.Button({
            label: setSystemLabel === 'SET_SYSTEM_BTN' ? 'Set System' : setSystemLabel
        });
        const setSystemTooltip = this.t('SET_SYSTEM_TOOLTIP');
        this.setSystemBtn.set_tooltip_text(setSystemTooltip === 'SET_SYSTEM_TOOLTIP'
            ? 'Fill auto-detectable fields with system values'
            : setSystemTooltip);
        this.setSystemBtn.get_style_context().add_class('suggested-action');
        this.setSystemBtn.get_style_context().add_class('green-btn');
        addPointerCursor(this.setSystemBtn);
        this.setSystemBtn.connect('clicked', () => this.handleSetSystem());
        buttonBox.pack_start(this.setSystemBtn, false, false, 0);

        const spacer = new Gtk.Box({ hexpand: true });
        buttonBox.pack_start(spacer, true, true, 0);

        const cancelBtn = new Gtk.Button({
            label: this.t('CANCEL') || 'Cancel'
        });
        addPointerCursor(cancelBtn);
        cancelBtn.connect('clicked', () => this.handleCancelClose());
        buttonBox.pack_start(cancelBtn, false, false, 0);

        const saveBtn = new Gtk.Button({
            label: this.t('SAVE_BTN') || 'Save'
        });
        saveBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(saveBtn);
        saveBtn.connect('clicked', () => this.handleSave());
        buttonBox.pack_start(saveBtn, false, false, 0);

        box.pack_start(buttonBox, false, false, 0);
    };

    prototype.loadOverrides = function() {
        if (!this.currentTheme || !this.parameterService) {
            resetOverrideState(this);
            return;
        }

        const themePath = `${GLib.get_home_dir()}/.config/themes/${this.currentTheme.name}`;

        this.originalValues = this.parameterService.parseThemeOriginals(themePath);

        const settings = this.settingsManager?.getAll?.() ?? {};
        const globalState = this.settingsManager?.readGlobalHyprlandState?.() ?? {};
        this.globalOverrides = this.parameterService?.getGlobalOverrides?.(settings) ?? settings.hyprlandOverrides ?? {};
        this.globalOverrideInitiators = { ...(globalState.initiators ?? {}) };

        this.currentOverrides = this.themeRepository
            ? this.themeRepository.readOverrides(this.currentTheme.name)
            : {};

        this.loadThemeMetadata(themePath);
    };

    prototype.loadThemeMetadata = function(themePath) {
        this.themeAltTimeout = null;
        this.themeMetadata = {};

        const metadataPath = `${themePath}/lastlayer-metadata.json`;
        const file = Gio.File.new_for_path(metadataPath);
        if (!file.query_exists(null)) return;

        const parsed = tryOrNull('loadThemeMetadata', () => {
            const [ok, buffer] = GLib.file_get_contents(metadataPath);
            return ok ? JSON.parse(new TextDecoder('utf-8').decode(buffer)) : null;
        });
        if (!parsed) return;

        this.themeMetadata = parsed;
        if (typeof parsed.alt_timeout === 'number') this.themeAltTimeout = parsed.alt_timeout;
    };

    prototype.saveThemeMetadata = function() {
        if (!this.currentTheme) return;

        const themePath = `${GLib.get_home_dir()}/.config/themes/${this.currentTheme.name}`;
        const metadataPath = `${themePath}/lastlayer-metadata.json`;

        const spinnerValue = this.altTimeoutSpinner?.get_value();
        const newAltTimeout = spinnerValue && spinnerValue !== 0.5 ? spinnerValue : null;

        const metadata = { ...this.themeMetadata };
        if (newAltTimeout !== null) metadata.alt_timeout = newAltTimeout;
        else delete metadata.alt_timeout;

        const saved = tryRun('HyprlandOverridePopupWindow.saveThemeMetadata', () => {
            GLib.file_set_contents(metadataPath, JSON.stringify(metadata, null, 2));
        });
        if (!saved) this.log?.('Failed to save theme metadata');
    };

    prototype.getSortedParameters = function() {
        return this.parameterService
            ? this.parameterService.getAllParameters().sort((a, b) => {
                const aOverridden = this.isParameterOverridden(a.fullPath);
                const bOverridden = this.isParameterOverridden(b.fullPath);
                return aOverridden === bOverridden
                    ? b.popularity - a.popularity
                    : (aOverridden ? -1 : 1);
            })
            : [];
    };

    prototype.isParameterOverridden = function(paramPath) {
        return this.currentOverrides[paramPath] !== undefined ||
               this.globalOverrides[paramPath] !== undefined;
    };
}
