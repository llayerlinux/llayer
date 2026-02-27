import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyLabelAttributes, applyOptionalSetters } from '../../../common/ViewUtils.js';

export function applyHyprlandTabBuildCore(prototype) {
    prototype.build = function() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        this.buildHeader(box);
        this.buildAutoDetectRow(box);
        this.buildParameterList(box);

        const tabLabel = new Gtk.Label({ label: this.t('OVERRIDE_TAB') || 'Override' });
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        this.subscribeToGlobalOverrideEvents?.();
        this.initAutoDetect && this.initAutoDetect();

        return { box, tabLabel };
    };

    prototype.buildHeader = function(box) {
        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        headerBox.get_style_context().add_class('override-header');
        headerBox.set_margin_bottom(6);

        const title = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_TITLE') || 'Global Parameter Overrides',
            halign: Gtk.Align.START
        });
        title.get_style_context().add_class('title-4');
        headerBox.pack_start(title, false, false, 0);

        const helpBtn = new Gtk.Button();
        const helpIcon = new Gtk.Image({
            icon_name: 'dialog-information-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        });
        helpBtn.set_image(helpIcon);
        helpBtn.get_style_context().add_class('circular');
        helpBtn.get_style_context().add_class('flat');
        helpBtn.set_tooltip_text(this.t('HYPRLAND_OVERRIDE_HELP_TOOLTIP') || 'How overrides work');
        addPointerCursor(helpBtn);
        helpBtn.connect('clicked', () => this.showOverrideHelp?.());
        headerBox.pack_start(helpBtn, false, false, 0);

        this.buildHotkeyOverridesButton && (() => {
            const hotkeyBtn = this.buildHotkeyOverridesButton();
            hotkeyBtn.set_margin_start(12);
            headerBox.pack_end(hotkeyBtn, false, false, 0);
        })();

        this.buildRecommendationsButton && (() => {
            const recBtn = this.buildRecommendationsButton();
            recBtn.set_margin_start(8);
            headerBox.pack_end(recBtn, false, false, 0);
        })();

        box.pack_start(headerBox, false, false, 0);

        const desc = this.createDimLabel(
            this.t('HYPRLAND_OVERRIDE_DESC') || 'Set parameters to override when applying any theme. Leave empty for no override.',
            'override-desc'
        );
        desc.set_margin_top(2);
        desc.set_margin_bottom(4);
        box.pack_start(desc, false, false, 0);

        const hint = this.createDimLabel(
            this.t('HYPRLAND_OVERRIDE_ACTIVE_HINT') || 'Values set here will override theme defaults when switching themes.',
            'override-hint'
        );
        hint.set_margin_bottom(8);
        box.pack_start(hint, false, false, 0);
    };

    prototype.showOverrideHelp = function() {
        return this.overrideHelpDialog
            ? this.overrideHelpDialog.present?.()
            : (() => {

                const dialog = new Gtk.Dialog({
                    title: this.t('HYPRLAND_OVERRIDE_HELP_DIALOG_TITLE') || 'Override System Help',
                    modal: true,
                    resizable: true
                });
                applyOptionalSetters([[this.parentWindow, (window) => dialog.set_transient_for?.(window), Boolean]]);
                dialog.get_style_context().add_class('override-help-dialog');
                dialog.set_default_size(600, 450);

        const content = dialog.get_content_area();
        content.set_margin_top(10);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        const titleLabel = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_HELP_DIALOG_TITLE') || 'Override System Help',
            halign: Gtk.Align.START,
            xalign: 0
        });
        titleLabel.get_style_context().add_class('override-help-title');
        header.pack_start(titleLabel, true, true, 0);

        const closeBtn = new Gtk.Button({ label: '\u00d7' });
        closeBtn.get_style_context().add_class('override-help-close');
        closeBtn.set_tooltip_text(this.t('CLOSE') || 'Close');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => dialog.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });

        const body = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 10,
            margin_bottom: 10
        });

        const priorityTitle = new Gtk.Label({
            label: 'Override Priority System',
            halign: Gtk.Align.START
        });
        applyLabelAttributes(priorityTitle, { bold: true });
        body.pack_start(priorityTitle, false, false, 0);

        const priorityDesc = new Gtk.Label({
            label: 'Parameters are applied in priority order:',
            halign: Gtk.Align.START,
            wrap: true
        });
        body.pack_start(priorityDesc, false, false, 0);

        const bulletsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 });

        const bullet1 = this.buildHelpBullet('1. Per-Rice Overrides (highest priority)', 'Settings specific to a single theme, configured from theme card.');
        const bullet2 = this.buildHelpBullet('2. Global Overrides (this tab)', 'Applied to all themes. Set your preferred keyboard layout, monitor config, etc.');
        const bullet3 = this.buildHelpBullet('3. Theme Defaults (lowest priority)', 'Original values from the theme.');

        bulletsBox.pack_start(bullet1, false, false, 0);
        bulletsBox.pack_start(bullet2, false, false, 0);
        bulletsBox.pack_start(bullet3, false, false, 0);
        body.pack_start(bulletsBox, false, false, 0);

        const autoTitle = new Gtk.Label({
            label: 'Auto-Detect System Parameters',
            halign: Gtk.Align.START,
            margin_top: 12
        });
        applyLabelAttributes(autoTitle, { bold: true });
        body.pack_start(autoTitle, false, false, 0);

        const autoDesc = new Gtk.Label({
            label: 'When enabled, the app detects your monitor configuration and keyboard layout from the system and applies them automatically.',
            halign: Gtk.Align.START,
            wrap: true
        });
        body.pack_start(autoDesc, false, false, 0);

        scrolled.add(body);
        content.pack_start(scrolled, true, true, 0);

        dialog.connect('destroy', () => {
            this.overrideHelpDialog = null;
        });

                this.overrideHelpDialog = dialog;
                dialog.show_all();
                return undefined;
            })();
    };

    prototype.buildHelpBullet = function(title, description) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            margin_start: 12
        });

        const titleLabel = new Gtk.Label({
            label: title,
            halign: Gtk.Align.START
        });
        applyLabelAttributes(titleLabel, { bold: true });
        row.pack_start(titleLabel, false, false, 0);

        const descLabel = new Gtk.Label({
            label: description,
            halign: Gtk.Align.START,
            wrap: true,
            margin_start: 12
        });
        descLabel.get_style_context().add_class('dim-label');
        row.pack_start(descLabel, false, false, 0);

        return row;
    };

    prototype.buildAutoDetectRow = function(box) {
        const autoDetectBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_bottom: 8
        });
        autoDetectBox.get_style_context().add_class('override-autodetect-row');
        autoDetectBox.set_margin_top(2);

        const translatedLabel = this.t('AUTO_DETECT_SYSTEM_PARAMS');
        const checkbox = new Gtk.CheckButton({
            label: translatedLabel === 'AUTO_DETECT_SYSTEM_PARAMS'
                ? 'Auto-detect system parameters (monitor, keyboard layout)'
                : translatedLabel,
            active: this.settings.autoDetectSystemParams !== false
        });

        checkbox.connect('toggled', () => {
            this.handleAutoDetectToggle && this.handleAutoDetectToggle(checkbox.get_active());
        });

        autoDetectBox.pack_start(checkbox, false, false, 0);

        this.scanningSpinner = new Gtk.Spinner({
            visible: false
        });
        this.scanningSpinner.set_size_request(16, 16);
        autoDetectBox.pack_start(this.scanningSpinner, false, false, 0);

        box.pack_start(autoDetectBox, false, false, 0);

        const realtimeBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_bottom: 8
        });
        realtimeBox.get_style_context().add_class('override-autodetect-row');

        const realtimeLabel = this.t('HYPRLAND_OVERRIDE_REALTIME_APPLY');
        const realtimeCheckbox = new Gtk.CheckButton({
            label: realtimeLabel === 'HYPRLAND_OVERRIDE_REALTIME_APPLY'
                ? 'Apply overrides immediately (realtime)'
                : realtimeLabel,
            active: this.settings.applyHyprlandOverridesRealtime === true
        });

        realtimeCheckbox.connect('toggled', () => {
            this.handleRealtimeApplyToggle && this.handleRealtimeApplyToggle(realtimeCheckbox.get_active());
        });

        realtimeBox.pack_start(realtimeCheckbox, false, false, 0);
        box.pack_start(realtimeBox, false, false, 0);
    };
}
