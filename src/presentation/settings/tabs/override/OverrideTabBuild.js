import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import {addPointerCursor, wrapTabLabel} from '../../../common/ViewUtils.js';

export function applyOverrideTabBuild(prototype) {

    prototype.isColorParam = function(param) {
        return param.name.startsWith('col.') ||
               param.name.includes('color') ||
               param.fullPath.startsWith('general:col.') ||
               param.fullPath.startsWith('decoration:col.') ||
               param.fullPath.startsWith('group:col.');
    };

    prototype.isSliderParam = function(param) {
        return (param.type === 'int' || param.type === 'float') &&
               param.min != null;
    };

    prototype.getSliderRange = function(param) {
        let min = param.min ?? 0;
        let max = param.max;
        let step = param.type === 'float' ? 0.01 : 1;

        if (max == null) {
            const path = param.fullPath;
            switch (true) {
                case path.includes('gaps'):
                case path.includes('rounding'):
                    max = 50;
                    break;
                case path.includes('border_size'):
                    max = 20;
                    break;
                case path.includes('blur:size'):
                    max = 30;
                    break;
                case path.includes('blur:passes'):
                    max = 10;
                    break;
                default:
                    max = param.type === 'float' ? 2 : 100;
                    break;
            }
        }

        return { min, max, step };
    };

    prototype.parseHyprlandColor = function(colorStr) {
        if (!colorStr || typeof colorStr !== 'string') return null;

        let hex = colorStr.trim().toLowerCase();
        if (!hex.startsWith('0x')) return null;

        hex = hex.substring(2);

        let r, g, b, a = 1.0;

        switch (hex.length) {
            case 8:
                a = parseInt(hex.substring(0, 2), 16) / 255;
                r = parseInt(hex.substring(2, 4), 16) / 255;
                g = parseInt(hex.substring(4, 6), 16) / 255;
                b = parseInt(hex.substring(6, 8), 16) / 255;
                break;
            case 6:
                r = parseInt(hex.substring(0, 2), 16) / 255;
                g = parseInt(hex.substring(2, 4), 16) / 255;
                b = parseInt(hex.substring(4, 6), 16) / 255;
                break;
            default:
                return null;
        }

        if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;

        const rgba = new Gdk.RGBA();
        rgba.red = r;
        rgba.green = g;
        rgba.blue = b;
        rgba.alpha = a;
        return rgba;
    };

    prototype.rgbaToHyprland = function(rgba) {
        const toHex = (val) => Math.round(val * 255).toString(16).padStart(2, '0');
        return `0x${toHex(rgba.alpha)}${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
    };

    prototype.updateColorButton = function(colorBtn, colorStr) {
        const rgba = this.parseHyprlandColor(colorStr);
        if (rgba) {
            colorBtn.set_rgba(rgba);
        }
    };

    prototype.build = function() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 0,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        const leftColumn = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: false,
            vexpand: true
        });
        leftColumn.set_size_request(620, -1);
        this.buildHeader(leftColumn);
        this.buildAutoDetectRow(leftColumn);
        this.buildParameterList(leftColumn);
        box.pack_start(leftColumn, false, false, 0);

        if (this.buildDottedSeparator) {
            const separator = this.buildDottedSeparator();
            separator.set_margin_start(12);
            separator.set_margin_end(12);
            box.pack_start(separator, false, false, 0);
        }

        if (this.buildWidgetsSection) {
            const rightColumn = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.START,
                hexpand: true
            });
            const widgetsSection = this.buildWidgetsSection();
            rightColumn.pack_start(widgetsSection, false, false, 0);
            box.pack_start(rightColumn, true, true, 0);
        }

        const tabLabel = new Gtk.Label({ label: this.t('HYPRLAND_OVERRIDE_TAB') || 'Hyprland' });
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        if (this.initAutoDetect) {
            this.initAutoDetect();
        }

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
        helpBtn.set_tooltip_text(this.t('HYPRLAND_OVERRIDE_HELP_TOOLTIP'));
        addPointerCursor(helpBtn);
        helpBtn.connect('clicked', () => this.showOverrideHelp?.());
        headerBox.pack_start(helpBtn, false, false, 0);

        if (this.buildHotkeyOverridesButton) {
            const hotkeyBtn = this.buildHotkeyOverridesButton();
            hotkeyBtn.set_margin_start(12);
            headerBox.pack_end(hotkeyBtn, false, false, 0);
        }

        if (this.buildRecommendationsButton) {
            const recBtn = this.buildRecommendationsButton();
            recBtn.set_margin_start(8);
            headerBox.pack_end(recBtn, false, false, 0);
        }

        box.pack_start(headerBox, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_DESC') || 'Set parameters to override when applying any theme. Leave empty for no override.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        desc.get_style_context().add_class('override-desc');
        desc.set_margin_top(2);
        desc.set_margin_bottom(4);
        box.pack_start(desc, false, false, 0);

        const hint = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_ACTIVE_HINT'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        hint.get_style_context().add_class('dim-label');
        hint.get_style_context().add_class('override-hint');
        hint.set_margin_bottom(8);
        box.pack_start(hint, false, false, 0);
    };

    prototype.showOverrideHelp = function() {
        if (this.overrideHelpDialog) {
            this.overrideHelpDialog.present?.();
            return;
        }

        const dialog = new Gtk.Dialog({
            title: this.t('HYPRLAND_OVERRIDE_HELP_DIALOG_TITLE'),
            modal: true,
            resizable: true
        });
        if (this.parentWindow) {
            dialog.set_transient_for?.(this.parentWindow);
        }
        dialog.get_style_context().add_class('override-help-dialog');
        dialog.set_default_size(640, 520);

        const content = dialog.get_content_area();
        content.set_margin_top(10);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        const title = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_HELP_DIALOG_TITLE'),
            halign: Gtk.Align.START,
            xalign: 0
        });
        title.get_style_context().add_class('override-help-title');
        header.pack_start(title, true, true, 0);

        const closeBtn = new Gtk.Button({ label: '×' });
        closeBtn.get_style_context().add_class('override-help-close');
        closeBtn.set_tooltip_text(this.t('CLOSE'));
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => dialog.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const notebook = new Gtk.Notebook();
        notebook.set_tab_pos(Gtk.PositionType.TOP);
        content.pack_start(notebook, true, true, 0);

        const systemTab = this.buildOverrideHelpSystemTab();
        const systemLabel = new Gtk.Label({ label: this.t('HYPRLAND_OVERRIDE_HELP_TAB_SYSTEM') });
        notebook.append_page(systemTab, wrapTabLabel(systemLabel));

        const migrationTab = this.buildOverrideHelpMigrationTab();
        const migrationLabel = new Gtk.Label({ label: this.t('HYPRLAND_OVERRIDE_HELP_TAB_MIGRATION') });
        notebook.append_page(migrationTab, wrapTabLabel(migrationLabel));

        const applyTab = this.buildOverrideHelpApplyTab();
        const applyLabel = new Gtk.Label({ label: this.t('HYPRLAND_OVERRIDE_HELP_TAB_APPLY') });
        notebook.append_page(applyTab, wrapTabLabel(applyLabel));

        dialog.connect('destroy', () => {
            this.overrideHelpDialog = null;
        });

        this.overrideHelpDialog = dialog;
        dialog.show_all();
    };

    prototype.buildOverrideHelpSystemTab = function() {
        const body = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10
        });

        const title = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_HELP_SECTION_SYSTEM_TITLE'),
            halign: Gtk.Align.START,
            xalign: 0
        });
        title.get_style_context().add_class('override-help-section-title');
        body.pack_start(title, false, false, 0);

        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_SYSTEM_P1'), false, false, 0);

        const bulletsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 });
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-green', 'HYPRLAND_OVERRIDE_HELP_PRIORITY_THEME'), false, false, 0);
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-blue', 'HYPRLAND_OVERRIDE_HELP_PRIORITY_GLOBAL'), false, false, 0);
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-gray', 'HYPRLAND_OVERRIDE_HELP_PRIORITY_IMPORTED'), false, false, 0);
        body.pack_start(bulletsBox, false, false, 0);

        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_SYSTEM_P2'), false, false, 0);
        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_SYSTEM_P3'), false, false, 0);
        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_SYSTEM_P4'), false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        scrolled.add(body);
        return scrolled;
    };

    prototype.buildOverrideHelpMigrationTab = function() {
        const body = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10
        });

        const title = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_HELP_SECTION_MIGRATION_TITLE'),
            halign: Gtk.Align.START,
            xalign: 0
        });
        title.get_style_context().add_class('override-help-section-title');
        body.pack_start(title, false, false, 0);

        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_MIGRATION_P1'), false, false, 0);
        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_MIGRATION_P2'), false, false, 0);

        const bulletsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 });
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-purple', 'HYPRLAND_OVERRIDE_HELP_MIGRATION_FUTURE'), false, false, 0);
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-red', 'HYPRLAND_OVERRIDE_HELP_MIGRATION_LEGACY'), false, false, 0);
        body.pack_start(bulletsBox, false, false, 0);

        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_MIGRATION_P3'), false, false, 0);
        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_MIGRATION_P4'), false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        scrolled.add(body);
        return scrolled;
    };

    prototype.buildOverrideHelpApplyTab = function() {
        const body = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10
        });

        const title = new Gtk.Label({
            label: this.t('HYPRLAND_OVERRIDE_HELP_SECTION_APPLY_TITLE'),
            halign: Gtk.Align.START,
            xalign: 0
        });
        title.get_style_context().add_class('override-help-section-title');
        body.pack_start(title, false, false, 0);

        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_APPLY_P1'), false, false, 0);
        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_APPLY_P2'), false, false, 0);
        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_APPLY_P3'), false, false, 0);

        const bulletsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 });
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-blue', 'HYPRLAND_OVERRIDE_HELP_APPLY_GLOBAL'), false, false, 0);
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-green', 'HYPRLAND_OVERRIDE_HELP_APPLY_THEME'), false, false, 0);
        bulletsBox.pack_start(this.buildHelpBullet('help-dot-gray', 'HYPRLAND_OVERRIDE_HELP_APPLY_IMPORTED'), false, false, 0);
        body.pack_start(bulletsBox, false, false, 0);

        body.pack_start(this.buildHelpParagraph('HYPRLAND_OVERRIDE_HELP_APPLY_P4'), false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        scrolled.add(body);
        return scrolled;
    };

    prototype.buildHelpParagraph = function(key) {
        const label = new Gtk.Label({
            label: this.t(key),
            halign: Gtk.Align.START,
            xalign: 0
        });
        label.set_line_wrap(true);
        label.get_style_context().add_class('override-help-text');
        return label;
    };

    prototype.buildHelpBullet = function(dotClass, textKey) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.START,
            valign: Gtk.Align.START
        });

        const dot = new Gtk.Label({ label: '●' });
        dot.get_style_context().add_class('help-dot');
        dot.get_style_context().add_class(dotClass);
        row.pack_start(dot, false, false, 0);

        const text = new Gtk.Label({
            label: this.t(textKey),
            halign: Gtk.Align.START,
            xalign: 0
        });
        text.set_line_wrap(true);
        text.get_style_context().add_class('override-help-text');
        row.pack_start(text, true, true, 0);

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
            if (this.handleAutoDetectToggle) {
                this.handleAutoDetectToggle(checkbox.get_active());
            }
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
            if (this.handleRealtimeApplyToggle) {
                this.handleRealtimeApplyToggle(realtimeCheckbox.get_active());
            }
        });

        realtimeBox.pack_start(realtimeCheckbox, false, false, 0);
        box.pack_start(realtimeBox, false, false, 0);
    };

    prototype.buildParameterList = function(box) {
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 300,
            max_content_height: 400
        });

        const grid = new Gtk.Grid({
            column_spacing: 8,
            row_spacing: 6,
            column_homogeneous: false,
            margin_end: 12
        });

        const parameters = this.getParametersSortedByPopularity();
        const hasOverride = (param) => Object.prototype.hasOwnProperty.call(this.currentOverrides || {}, param.fullPath);
        const prioritized = [];
        const remaining = [];
        for (const param of parameters) {
            (hasOverride(param) ? prioritized : remaining).push(param);
        }
        const orderedParameters = [...prioritized, ...remaining];

        let rowIndex = 0;
        for (const param of orderedParameters) {
            this.buildParameterGridRow(grid, param, rowIndex);
            rowIndex++;
        }

        scrolled.add(grid);
        box.pack_start(scrolled, true, true, 0);

        this.widgets.parameterListBox = grid;

        if (this.buildMigrationSection) {
            this.buildMigrationSection(box);
        }
    };

    prototype.buildParameterGridRow = function(grid, param, rowIndex) {
        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START
        });
        labelBox.set_size_request(180, -1);

        const label = new Gtk.Label({
            label: param.name,
            halign: Gtk.Align.START,
            ellipsize: 3
        });
        label.set_tooltip_text(param.description || param.fullPath);
        if (this.currentOverrides[param.fullPath] !== undefined) {
            label.get_style_context().add_class('global-override-label');
        }
        labelBox.pack_start(label, false, false, 0);

        const sectionLabel = new Gtk.Label({
            label: param.section,
            halign: Gtk.Align.START
        });
        sectionLabel.get_style_context().add_class('dim-label');
        sectionLabel.set_margin_top(2);
        const sectionRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER
        });
        sectionRow.pack_start(sectionLabel, false, false, 0);

        const resetBtn = new Gtk.Button({
            label: '×',
            valign: Gtk.Align.CENTER
        });
        resetBtn.set_size_request(16, 16);
        resetBtn.set_tooltip_text(this.t('CLEAR_OVERRIDE_TOOLTIP') || 'Clear override');
        resetBtn.get_style_context().add_class('override-reset-btn');
        resetBtn.set_no_show_all(true);
        resetBtn.set_visible(this.currentOverrides[param.fullPath] !== undefined);
        addPointerCursor(resetBtn);
        sectionRow.pack_start(resetBtn, false, false, 0);

        labelBox.pack_start(sectionRow, false, false, 0);

        grid.attach(labelBox, 0, rowIndex, 1, 1);

        const isBoolParam = param.type === 'bool';
        const isColorParameter = this.isColorParam(param);
        const isSliderParameter = this.isSliderParam(param);
        const isOptionsParam = Array.isArray(param.options) && param.options.length > 0;
        const currentValue = this.currentOverrides[param.fullPath];

        const inputBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
            spacing: 4
        });
        inputBox.set_size_request(170, -1);

        const inputType = isBoolParam
            ? 'checkbox'
            : (isSliderParameter ? 'slider' : (isOptionsParam ? 'combo' : 'entry'));

        switch (inputType) {
            case 'checkbox': {
                const checkbox = new Gtk.CheckButton({
                    valign: Gtk.Align.CENTER
                });
                const isChecked = currentValue === 'true' || currentValue === '1' || currentValue === 'yes';
                checkbox.set_active(isChecked);
                const entryData = { type: 'checkbox', widget: checkbox, nameLabel: label };
                checkbox.connect('toggled', () => {
                    if (entryData.suspendChange) return;
                    this.handleParameterChange(param.fullPath, checkbox.get_active() ? 'true' : 'false');
                });
                this.parameterEntries.set(param.fullPath, entryData);
                inputBox.pack_start(checkbox, false, false, 0);
                break;
            }
            case 'slider': {
                const { min, max, step } = this.getSliderRange(param);
                const digits = param.type === 'float' ? 2 : 0;

                const scale = new Gtk.Scale({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    adjustment: new Gtk.Adjustment({
                        lower: min, upper: max,
                        step_increment: step, page_increment: step * 10
                    }),
                    digits: digits,
                    draw_value: false,
                    valign: Gtk.Align.CENTER
                });
                scale.set_size_request(110, -1);
                scale.get_style_context().add_class('override-scale');

                const entry = new Gtk.Entry({
                    valign: Gtk.Align.CENTER,
                    width_chars: 4,
                    max_width_chars: 4
                });
                entry.set_size_request(50, -1);

                const parsedValue = parseFloat(currentValue);
                const numValue = !isNaN(parsedValue) ? parsedValue : (param.defaultValue ?? min);
                scale.set_value(numValue);
                entry.set_text(currentValue !== undefined && currentValue !== null && currentValue !== ''
                    ? String(currentValue) : String(numValue));

                const entryData = { type: 'slider', widget: entry, scale: scale, nameLabel: label };
                let updatingFromScale = false;
                scale.connect('value-changed', () => {
                    if (entryData.suspendChange || updatingFromScale) return;
                    const val = param.type === 'float'
                        ? scale.get_value().toFixed(digits)
                        : Math.round(scale.get_value()).toString();
                    entry.set_text(val);
                    this.handleParameterChange(param.fullPath, val);
                });

                entry.connect('changed', () => {
                    if (entryData.suspendChange) return;
                    const text = entry.get_text().trim();
                    const val = parseFloat(text);
                    if (!isNaN(val)) {
                        updatingFromScale = true;
                        scale.set_value(Math.min(Math.max(val, min), max));
                        updatingFromScale = false;
                        this.handleParameterChange(param.fullPath, text);
                    }
                });

                this.parameterEntries.set(param.fullPath, entryData);
                inputBox.pack_start(scale, false, false, 0);
                inputBox.pack_start(entry, false, false, 0);
                break;
            }
            case 'combo': {
                const combo = new Gtk.ComboBoxText({
                    valign: Gtk.Align.CENTER
                });
                combo.set_size_request(165, -1);
                combo.get_style_context().add_class('override-combo');

                for (const opt of param.options) {
                    combo.append(String(opt), String(opt));
                }

                const activeId = currentValue !== null && currentValue !== undefined && currentValue !== ''
                    ? String(currentValue)
                    : (param.defaultValue ? String(param.defaultValue) : null);
                activeId && combo.set_active_id(activeId);

                const entryData = { type: 'combo', widget: combo, nameLabel: label };
                combo.connect('changed', () => {
                    if (entryData.suspendChange) return;
                    const selected = combo.get_active_id();
                    selected && this.handleParameterChange(param.fullPath, selected);
                });

                this.parameterEntries.set(param.fullPath, entryData);
                inputBox.pack_start(combo, false, false, 0);
                break;
            }
            default: {
                const entryWidth = isColorParameter ? 135 : 165;
                const entry = new Gtk.Entry({
                    placeholder_text: this.getPlaceholderForParam(param),
                    width_chars: isColorParameter ? 14 : 18,
                    max_width_chars: isColorParameter ? 14 : 18
                });
                entry.set_size_request(entryWidth, -1);

                if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
                    entry.set_text(String(currentValue));
                }

                const entryData = { type: 'entry', widget: entry, nameLabel: label };
                entry.connect('changed', () => {
                    if (entryData.suspendChange) return;
                    const value = entry.get_text().trim();
                    this.handleParameterChange(param.fullPath, value);
                    isColorParameter && entry._colorBtn && this.updateColorButton(entry._colorBtn, value);
                });

                this.parameterEntries.set(param.fullPath, entryData);
                inputBox.pack_start(entry, false, false, 0);

                if (isColorParameter) {
                    const colorBtn = new Gtk.ColorButton({
                        valign: Gtk.Align.CENTER,
                        use_alpha: true
                    });
                    colorBtn.set_size_request(24, 24);
                    const rgba = this.parseHyprlandColor(currentValue);
                    rgba && colorBtn.set_rgba(rgba);
                    colorBtn.connect('color-set', () => {
                        entry.set_text(this.rgbaToHyprland(colorBtn.get_rgba()));
                    });
                    entry._colorBtn = colorBtn;
                    inputBox.pack_start(colorBtn, false, false, 0);
                }
                break;
            }
        }

        grid.attach(inputBox, 1, rowIndex, 1, 1);

        resetBtn.connect('clicked', () => {
            const entryData = this.parameterEntries.get(param.fullPath);
            if (!entryData) return;

            entryData.suspendChange = true;
            switch (entryData.type) {
                case 'checkbox':
                    entryData.widget.set_active(false);
                    break;
                case 'slider':
                    entryData.widget.set_text('');
                    if (entryData.scale) {
                        const adj = entryData.scale.get_adjustment();
                        entryData.scale.set_value(adj.get_lower());
                    }
                    break;
                case 'combo':
                    entryData.widget.set_active(-1);
                    break;
                default:
                    entryData.widget.set_text('');
                    break;
            }
            entryData.suspendChange = false;

            this.handleParameterChange(param.fullPath, '');
        });

        const entryData = this.parameterEntries.get(param.fullPath);
        if (entryData) {
            entryData.resetButton = resetBtn;
        }

        const exceptionsBtn = new Gtk.Button({
            label: this.t('EXCEPTIONS_BTN') || 'Exceptions',
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START
        });
        exceptionsBtn.set_size_request(100, -1);
        exceptionsBtn.get_style_context().add_class('override-exceptions-btn');
        addPointerCursor(exceptionsBtn);
        exceptionsBtn.connect('clicked', () => this.showExceptionsPopup(param));
        this.exceptionButtons.set(param.fullPath, exceptionsBtn);
        this.updateExceptionButtonCount(exceptionsBtn, param.fullPath);

        grid.attach(exceptionsBtn, 2, rowIndex, 1, 1);

        const isAutoDetectable = this.isAutoDetectParam && this.isAutoDetectParam(param.fullPath);
        if (isAutoDetectable) {
            const translatedSystemDetected = this.t('SYSTEM_DETECTED');
            const labelText = translatedSystemDetected === 'SYSTEM_DETECTED'
                ? 'System detected' : translatedSystemDetected;
            const autoDetectLabel = new Gtk.Label({
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                visible: false,
                use_markup: true
            });
            autoDetectLabel.set_markup(`<span foreground="#33d17a">${labelText}</span>`);
            autoDetectLabel.get_style_context().add_class('override-system-detected');
            autoDetectLabel.set_margin_start(8);
            autoDetectLabel.set_no_show_all(true);
            grid.attach(autoDetectLabel, 3, rowIndex, 1, 1);
            this.autoDetectLabels.set(param.fullPath, autoDetectLabel);
        }
    };

    prototype.buildParameterRow = function(param) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        return row;
    };

    prototype.getPlaceholderForParam = function(param) {
        const type = param.type || 'str';
        const def = param.defaultValue;

        if (def !== null && def !== undefined) {
            return `${type}: ${def}`;
        }
        return type;
    };

    prototype.updateExceptionButtonCount = function(btn, paramPath) {
        if (!this.themeRepository) return;

        const exceptions = this.themeRepository.getThemesWithParameterOverride(paramPath);
        const count = exceptions.length;
        btn.get_style_context().remove_class('suggested-action');

        if (count > 0) {
            btn.set_label(`${this.t('EXCEPTIONS_BTN') || 'Exceptions'} (${count})`);
            btn.get_style_context().add_class('override-exceptions-btn--active');
        } else {
            btn.set_label(this.t('EXCEPTIONS_BTN') || 'Exceptions');
            btn.get_style_context().remove_class('override-exceptions-btn--active');
        }
    };
}
