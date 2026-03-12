import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { FilterMode, ComparisonAlgorithm } from '../../../infrastructure/ai/PipelineFilterService.js';
import { tryOrDefault } from '../../../infrastructure/utils/ErrorUtils.js';
import {addPointerCursor} from '../../common/ViewUtils.js';

export class PipelineFilterDialog {
    constructor(controller, pipelineFilterService, aiProviderService, translationFn = null) {
        this.controller = controller;
        this.filterService = pipelineFilterService;
        this.aiProviderService = aiProviderService;
        this.t = translationFn || ((key, fallback) => fallback || key);

        this.dialog = null;
        this.widgets = {};
    }

    show(parentWindow = null) {
        if (this.dialog) {
            this.dialog.present();
            return;
        }

        this.createDialog(parentWindow);
        this.dialog.show_all();

        const config = this.filterService.getConfig();
        if (this.widgets.stack) {
            this.widgets.stack.set_visible_child_name(config.mode);
        }
    }

    createDialog(parentWindow) {
        this.dialog = new Gtk.Dialog({
            title: this.t('PIPELINE_FILTER_TITLE', 'Pipeline Filter'),
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true,
            default_width: 550,
            default_height: 500
        });

        this.dialog.get_style_context().add_class('pipeline-filter-dialog');

        const contentArea = this.dialog.get_content_area();
        contentArea.set_spacing(12);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        const config = this.filterService.getConfig();

        const enableRow = this.createEnableRow(config);
        contentArea.pack_start(enableRow, false, false, 0);

        const resolutionRow = this.createResolutionGateRow(config);
        contentArea.pack_start(resolutionRow, false, false, 0);

        const ignoreProcessesRow = this.createIgnoreProcessesRow(config);
        contentArea.pack_start(ignoreProcessesRow, false, false, 0);

        contentArea.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 8);

        const modeRow = this.createModeSelector(config);
        contentArea.pack_start(modeRow, false, false, 0);

        const stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.CROSSFADE,
            transition_duration: 200,
            vexpand: true
        });

        const mlPage = this.createMLSettingsPage(config);
        stack.add_titled(mlPage, 'ml', 'ML');

        const progPage = this.createProgrammaticSettingsPage(config);
        stack.add_titled(progPage, 'programmatic', 'Programmatic');

        stack.set_visible_child_name(config.mode);
        this.widgets.stack = stack;

        contentArea.pack_start(stack, true, true, 0);

        const statsRow = this.createStatsRow();
        contentArea.pack_start(statsRow, false, false, 8);

        const closeBtn = this.dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn);

        this.dialog.connect('response', () => {
            this.dialog.destroy();
            this.dialog = null;
        });

        this.dialog.connect('destroy', () => {
            this.dialog = null;
        });

        this.dialog.connect('key-press-event', (widget, event) => {
            const [, keyval] = event.get_keyval();
            const state = event.get_state()[1];
            const ctrlPressed = (state & Gdk.ModifierType.CONTROL_MASK) !== 0;

            if (ctrlPressed && (keyval === Gdk.KEY_v || keyval === Gdk.KEY_V)) {
                this.onPasteFromClipboard();
                return true;
            }
            return false;
        });
    }

    createEnableRow(config) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const label = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_ENABLE', 'Enable Pipeline Filter'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        label.get_style_context().add_class('ai-setting-label');

        const switchWidget = new Gtk.Switch({
            active: config.enabled,
            valign: Gtk.Align.CENTER
        });

        switchWidget.connect('state-set', (sw, state) => {
            this.filterService.setEnabled(state);
            return false;
        });

        row.pack_start(label, true, true, 0);
        row.pack_end(switchWidget, false, false, 0);

        return row;
    }

    createResolutionGateRow(config) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 6
        });

        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const label = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_RESOLUTION_BLOCK', 'Block by resolution'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        label.get_style_context().add_class('ai-setting-label');

        const switchWidget = new Gtk.Switch({
            active: config.resolutionGate?.enabled === true,
            valign: Gtk.Align.CENTER
        });

        const updateGate = (updates) => {
            const current = this.filterService.getConfig();
            const nextGate = { ...(current.resolutionGate || {}), ...updates };
            this.filterService.updateConfig({ resolutionGate: nextGate });
        };

        switchWidget.connect('state-set', (_sw, state) => {
            const current = this.filterService.getConfig();
            const gate = current.resolutionGate || {};
            if (state === true && !(Number(gate.maxWidth) > 0) && !(Number(gate.maxHeight) > 0)) {
                updateGate({ enabled: true, maxWidth: 1920, maxHeight: 1080 });
            } else {
                updateGate({ enabled: state });
            }
            this.toggleResolutionInputs(state);
            return false;
        });

        row.pack_start(label, true, true, 0);
        row.pack_end(switchWidget, false, false, 0);
        box.pack_start(row, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_RESOLUTION_BLOCK_DESC', 'When enabled, filters out screenshots larger than the limits.'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        box.pack_start(desc, false, false, 0);

        const grid = new Gtk.Grid({
            column_spacing: 12,
            row_spacing: 8,
            margin_start: 18
        });

        const maxWidthLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_RESOLUTION_MAX_WIDTH', 'Max width'),
            halign: Gtk.Align.START
        });
        const maxHeightLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_RESOLUTION_MAX_HEIGHT', 'Max height'),
            halign: Gtk.Align.START
        });

        const maxWidthSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 16384,
                step_increment: 1,
                page_increment: 10,
                value: Number(config.resolutionGate?.maxWidth) || 0
            }),
            numeric: true
        });

        const maxHeightSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 16384,
                step_increment: 1,
                page_increment: 10,
                value: Number(config.resolutionGate?.maxHeight) || 0
            }),
            numeric: true
        });

        maxWidthSpin.connect('value-changed', () => updateGate({ maxWidth: maxWidthSpin.get_value_as_int() }));
        maxHeightSpin.connect('value-changed', () => updateGate({ maxHeight: maxHeightSpin.get_value_as_int() }));

        this._resolutionGateInputs = { maxWidthSpin, maxHeightSpin };
        this.toggleResolutionInputs(config.resolutionGate?.enabled === true);

        grid.attach(maxWidthLabel, 0, 0, 1, 1);
        grid.attach(maxWidthSpin, 1, 0, 1, 1);
        grid.attach(maxHeightLabel, 0, 1, 1, 1);
        grid.attach(maxHeightSpin, 1, 1, 1, 1);
        box.pack_start(grid, false, false, 0);

        return box;
    }

    toggleResolutionInputs(enabled) {
        const inputs = this._resolutionGateInputs;
        if (!inputs) return;
        inputs.maxWidthSpin.set_sensitive(enabled === true);
        inputs.maxHeightSpin.set_sensitive(enabled === true);
    }

    createIgnoreProcessesRow(config) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 6
        });

        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const label = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_IGNORE_PROCESSES', 'Ignore focused processes'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        label.get_style_context().add_class('ai-setting-label');

        const switchWidget = new Gtk.Switch({
            active: config.ignoreProcesses?.enabled === true,
            valign: Gtk.Align.CENTER
        });

        const updateIgnore = (updates) => {
            const current = this.filterService.getConfig();
            const next = { ...(current.ignoreProcesses || {}), ...updates };
            if (!Array.isArray(next.names)) next.names = [];
            this.filterService.updateConfig({ ignoreProcesses: next });
        };

        switchWidget.connect('state-set', (_sw, state) => {
            updateIgnore({ enabled: state });
            this.toggleIgnoreProcessInputs(state);
            return false;
        });

        row.pack_start(label, true, true, 0);
        row.pack_end(switchWidget, false, false, 0);
        box.pack_start(row, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_IGNORE_PROCESSES_DESC', 'When enabled, the filter is bypassed if the currently focused window belongs to an ignored process.'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        box.pack_start(desc, false, false, 0);

        const controlsRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 18
        });

        const addBtn = new Gtk.Button({ label: this.t('PIPELINE_FILTER_IGNORE_ADD', 'Add from running…') });
        addBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(addBtn);
        addBtn.connect('clicked', () => this.showProcessPickerDialog(updateIgnore));

        const clearBtn = new Gtk.Button({ label: this.t('CLEAR', 'Clear') });
        addPointerCursor(clearBtn);
        clearBtn.connect('clicked', () => updateIgnore({ names: [] }));

        controlsRow.pack_start(addBtn, false, false, 0);
        controlsRow.pack_start(clearBtn, false, false, 0);
        box.pack_start(controlsRow, false, false, 0);

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_start: 18
        });
        box.pack_start(listBox, false, false, 0);

        const refreshList = () => {
            (listBox.get_children?.() || []).forEach(child => listBox.remove(child));
            const current = this.filterService.getConfig();
            const names = Array.isArray(current.ignoreProcesses?.names) ? current.ignoreProcesses.names : [];
            if (names.length === 0) {
                const empty = new Gtk.Label({
                    label: this.t('PIPELINE_FILTER_IGNORE_EMPTY', 'No ignored processes added'),
                    halign: Gtk.Align.START
                });
                empty.get_style_context().add_class('dim-label');
                listBox.pack_start(empty, false, false, 0);
                listBox.show_all();
                return;
            }

            for (const name of names) {
                const line = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
                const lbl = new Gtk.Label({ label: String(name), halign: Gtk.Align.START, hexpand: true, xalign: 0 });
                line.pack_start(lbl, true, true, 0);
                const rm = new Gtk.Button({ image: new Gtk.Image({ icon_name: 'window-close-symbolic', icon_size: Gtk.IconSize.MENU }), relief: Gtk.ReliefStyle.NONE });
                rm.get_style_context().add_class('flat');
                addPointerCursor(rm);
                rm.connect('clicked', () => {
                    const next = names.filter(n => String(n) !== String(name));
                    updateIgnore({ names: next });
                    refreshList();
                });
                line.pack_end(rm, false, false, 0);
                listBox.pack_start(line, false, false, 0);
            }
            listBox.show_all();
        };

        clearBtn.connect('clicked', () => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => { refreshList(); return GLib.SOURCE_REMOVE; }));

        this._ignoreProcessesListRefresh = refreshList;
        this._ignoreProcessesControls = { addBtn, clearBtn };
        this.toggleIgnoreProcessInputs(config.ignoreProcesses?.enabled === true);
        refreshList();

        return box;
    }

    toggleIgnoreProcessInputs(enabled) {
        const controls = this._ignoreProcessesControls;
        if (!controls) return;
        controls.addBtn.set_sensitive(enabled === true);
        controls.clearBtn.set_sensitive(enabled === true);
    }

    showProcessPickerDialog(updateIgnore) {
        const dialog = new Gtk.Dialog({
            title: this.t('PIPELINE_FILTER_IGNORE_PICK_TITLE', 'Select a process'),
            transient_for: this.dialog,
            modal: true,
            destroy_with_parent: true
        });
        dialog.set_default_size(520, 420);
        const closeBtn = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(10);
        contentArea.set_margin_bottom(10);
        contentArea.set_margin_start(10);
        contentArea.set_margin_end(10);

        const scrolled = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const listBox = new Gtk.ListBox();
        listBox.set_selection_mode(Gtk.SelectionMode.NONE);

        const windows = this.controller?.getAllWindows?.() || [];
        const items = this.collectIgnoreProcessItems(windows);

        items.sort((a, b) => a.name.localeCompare(b.name));

        if (items.length === 0) {
            const empty = new Gtk.Label({
                label: this.t('PIPELINE_FILTER_IGNORE_PICK_EMPTY', 'No running windows detected'),
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            empty.get_style_context().add_class('dim-label');
            contentArea.pack_start(empty, true, true, 0);
        } else {
            for (const item of items) {
                const row = new Gtk.ListBoxRow();
                const btn = new Gtk.Button({ relief: Gtk.ReliefStyle.NONE });
                btn.get_style_context().add_class('flat');
                addPointerCursor(btn);

                const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, margin_top: 6, margin_bottom: 6, margin_start: 8, margin_end: 8 });
                const title = new Gtk.Label({ label: item.name, halign: Gtk.Align.START, xalign: 0 });
                title.get_style_context().add_class('ai-setting-label');
                const sub = new Gtk.Label({
                    label: `${item.cls}${item.pid ? `  (pid ${item.pid})` : ''}${item.title ? ` — ${item.title.substring(0, 60)}` : ''}`,
                    halign: Gtk.Align.START,
                    wrap: true,
                    xalign: 0
                });
                sub.get_style_context().add_class('dim-label');
                box.pack_start(title, false, false, 0);
                box.pack_start(sub, false, false, 0);
                btn.add(box);

                btn.connect('clicked', () => {
                    const current = this.filterService.getConfig();
                    const names = Array.isArray(current.ignoreProcesses?.names) ? current.ignoreProcesses.names : [];
                    const norm = names.map(n => String(n || '').trim()).filter(Boolean);
                    if (!norm.some(n => n.toLowerCase() === item.name.toLowerCase())) {
                        updateIgnore({ names: [...norm, item.name] });
                        this._ignoreProcessesListRefresh?.();
                    }
                    dialog.destroy();
                });

                row.add(btn);
                listBox.add(row);
            }

            scrolled.add(listBox);
            contentArea.pack_start(scrolled, true, true, 0);
        }

        dialog.show_all();
        dialog.connect('response', () => dialog.destroy());
    }

    createModeSelector(config) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const label = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_MODE', 'Filter Mode'),
            halign: Gtk.Align.START
        });

        const combo = new Gtk.ComboBoxText({
            valign: Gtk.Align.CENTER
        });
        combo.append(FilterMode.ML, this.t('PIPELINE_FILTER_MODE_ML', 'ML (AI Provider)'));
        combo.append(FilterMode.PROGRAMMATIC, this.t('PIPELINE_FILTER_MODE_PROG', 'Programmatic (Image Comparison)'));
        combo.set_active_id(config.mode);

        combo.connect('changed', () => {
            const mode = combo.get_active_id();
            this.filterService.updateConfig({ mode });
            this.widgets.stack?.set_visible_child_name(mode);
        });

        row.pack_start(label, false, false, 0);
        row.pack_end(combo, false, false, 0);

        return row;
    }

    createMLSettingsPage(config) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12
        });

        const providerRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const providerLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_ML_PROVIDER', 'AI Provider'),
            halign: Gtk.Align.START
        });

        const providerCombo = new Gtk.ComboBoxText({
            valign: Gtk.Align.CENTER,
            hexpand: true
        });
        providerCombo.append('', this.t('PIPELINE_FILTER_ML_SELECT_PROVIDER', '-- Select Provider --'));

        const providers = this.aiProviderService?.getProviders?.() || [];
        for (const p of providers) {
            providerCombo.append(p.id, p.name);
        }

        providerCombo.set_active_id(config.ml.providerId || '');

        providerCombo.connect('changed', () => {
            const providerId = providerCombo.get_active_id() || null;
            const currentConfig = this.filterService.getConfig();
            this.filterService.updateConfig({
                ml: { ...currentConfig.ml, providerId }
            });
        });

        providerRow.pack_start(providerLabel, false, false, 0);
        providerRow.pack_end(providerCombo, true, true, 0);
        box.pack_start(providerRow, false, false, 0);

        const promptLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_ML_NEGATIVE_PROMPT', 'Negative Prompt (what to exclude)'),
            halign: Gtk.Align.START,
            margin_top: 8
        });
        box.pack_start(promptLabel, false, false, 0);

        const promptScroll = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 80
        });

        const promptText = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            hexpand: true
        });
        promptText.get_buffer().set_text(config.ml.negativePrompt || '', -1);

        promptText.get_buffer().connect('changed', (buffer) => {
            const [start, end] = buffer.get_bounds();
            const text = buffer.get_text(start, end, false);
            const currentConfig = this.filterService.getConfig();
            this.filterService.updateConfig({
                ml: { ...currentConfig.ml, negativePrompt: text }
            });
        });

        promptScroll.add(promptText);
        box.pack_start(promptScroll, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_ML_DESC', 'The AI will check if the screenshot matches the negative prompt. If yes, the frame will be filtered out.'),
            wrap: true,
            xalign: 0,
            margin_top: 8
        });
        desc.get_style_context().add_class('dim-label');
        box.pack_start(desc, false, false, 0);

        return box;
    }

    createProgrammaticSettingsPage(config) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12
        });

        const algoRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const algoLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_PROG_ALGORITHM', 'Comparison Algorithm'),
            halign: Gtk.Align.START
        });

        const algoCombo = new Gtk.ComboBoxText({
            valign: Gtk.Align.CENTER
        });
        algoCombo.append(ComparisonAlgorithm.DIFFERENCE_HASH, this.t('PIPELINE_FILTER_ALGO_DHASH', 'Difference Hash (Recommended)'));
        algoCombo.append(ComparisonAlgorithm.AVERAGE_HASH, this.t('PIPELINE_FILTER_ALGO_HASH', 'Average Hash (Perceptual)'));
        algoCombo.append(ComparisonAlgorithm.HISTOGRAM, this.t('PIPELINE_FILTER_ALGO_HISTOGRAM', 'Color Histogram'));
        algoCombo.append(ComparisonAlgorithm.COLOR_MOMENTS, this.t('PIPELINE_FILTER_ALGO_MOMENTS', 'Color Moments'));
        algoCombo.append(ComparisonAlgorithm.BLOCK_HASH, this.t('PIPELINE_FILTER_ALGO_BLOCK', 'Block Hash (Layout)'));
        algoCombo.append(ComparisonAlgorithm.GRADIENT_HISTOGRAM, this.t('PIPELINE_FILTER_ALGO_GRADIENT', 'Gradient Histogram (Edges)'));
        algoCombo.append(ComparisonAlgorithm.ZONE_HASH, this.t('PIPELINE_FILTER_ALGO_ZONE', 'Zone Hash (Composition)'));
        algoCombo.append(ComparisonAlgorithm.RADIAL_VARIANCE, this.t('PIPELINE_FILTER_ALGO_RADIAL', 'Radial Variance (Center-Out)'));
        algoCombo.set_active_id(config.programmatic.algorithm);

        algoCombo.connect('changed', () => {
            const algorithm = algoCombo.get_active_id();
            const currentConfig = this.filterService.getConfig();
            this.filterService.updateConfig({
                programmatic: { ...currentConfig.programmatic, algorithm }
            });
            this.filterService.recalculateFeatures();
        });

        algoRow.pack_start(algoLabel, false, false, 0);
        algoRow.pack_end(algoCombo, false, false, 0);
        box.pack_start(algoRow, false, false, 0);

        const thresholdRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const thresholdLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_PROG_THRESHOLD', 'Match Threshold'),
            halign: Gtk.Align.START
        });

        const thresholdValue = new Gtk.Label({
            label: `${config.programmatic.threshold}%`,
            width_chars: 5
        });

        const thresholdAdj = new Gtk.Adjustment({
            value: config.programmatic.threshold,
            lower: 10,
            upper: 100,
            step_increment: 5,
            page_increment: 10
        });

        const thresholdScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: thresholdAdj,
            draw_value: false,
            hexpand: true,
            has_origin: true
        });
        thresholdScale.get_style_context().add_class('pipeline-filter-scale');

        thresholdScale.connect('value-changed', () => {
            const threshold = Math.round(thresholdScale.get_value());
            thresholdValue.set_label(`${threshold}%`);
            const currentConfig = this.filterService.getConfig();
            this.filterService.updateConfig({
                programmatic: { ...currentConfig.programmatic, threshold }
            });
        });

        thresholdRow.pack_start(thresholdLabel, false, false, 0);
        thresholdRow.pack_start(thresholdScale, true, true, 0);
        thresholdRow.pack_end(thresholdValue, false, false, 0);
        box.pack_start(thresholdRow, false, false, 0);

        const refLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_PROG_REFERENCES', 'Reference Images (screenshots to exclude)'),
            halign: Gtk.Align.START,
            margin_top: 12
        });
        refLabel.get_style_context().add_class('ai-setting-label');
        box.pack_start(refLabel, false, false, 0);

        const refScroll = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 120,
            vexpand: true
        });

        const refListBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE
        });
        refListBox.get_style_context().add_class('boxed-list');
        this.widgets.refListBox = refListBox;

        this.populateReferenceList(refListBox);

        refScroll.add(refListBox);
        box.pack_start(refScroll, true, true, 0);

        const buttonRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8
        });

        const addFileBtn = new Gtk.Button({
            label: this.t('PIPELINE_FILTER_ADD_FILE', 'Add from File...')
        });
        addPointerCursor(addFileBtn);
        addFileBtn.connect('clicked', () => this.onAddFromFile());

        const captureBtn = new Gtk.Button({
            label: this.t('PIPELINE_FILTER_CAPTURE', 'Capture Current Screen')
        });
        addPointerCursor(captureBtn);
        captureBtn.connect('clicked', () => this.onCaptureScreen());

        buttonRow.pack_start(addFileBtn, false, false, 0);
        buttonRow.pack_start(captureBtn, false, false, 0);
        box.pack_start(buttonRow, false, false, 0);

        box.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 12 }), false, false, 0);

        const patternsLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_KNOWN_PATTERNS', 'Ignore known patterns'),
            halign: Gtk.Align.START,
            margin_top: 8
        });
        patternsLabel.get_style_context().add_class('ai-setting-label');
        box.pack_start(patternsLabel, false, false, 0);

        const dimmingCheck = new Gtk.CheckButton({
            label: this.t('PIPELINE_FILTER_PATTERN_DIMMING', 'Dimming / Fade overlay')
        });
        dimmingCheck.set_active(config.programmatic.ignoreDimming === true);

        dimmingCheck.connect('toggled', () => {
            const currentConfig = this.filterService.getConfig();
            this.filterService.updateConfig({
                programmatic: { ...currentConfig.programmatic, ignoreDimming: dimmingCheck.get_active() }
            });
        });

        box.pack_start(dimmingCheck, false, false, 0);

        const dimmingDesc = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_PATTERN_DIMMING_DESC', 'Skip frames with screen dimming (common between levels, loading screens)'),
            wrap: true,
            xalign: 0,
            margin_start: 24
        });
        dimmingDesc.get_style_context().add_class('dim-label');
        box.pack_start(dimmingDesc, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_PROG_DESC', 'Add screenshots that should be filtered out (e.g., loading screens, menus). When a new frame matches any reference above the threshold, it will be skipped.'),
            wrap: true,
            xalign: 0,
            margin_top: 12
        });
        desc.get_style_context().add_class('dim-label');
        box.pack_start(desc, false, false, 0);

        return box;
    }

    populateReferenceList(listBox) {
        listBox.foreach(child => listBox.remove(child));

        const references = this.filterService.getReferenceImages();

        if (references.length === 0) {
            const emptyRow = new Gtk.ListBoxRow({
                selectable: false
            });
            const emptyLabel = new Gtk.Label({
                label: this.t('PIPELINE_FILTER_NO_REFERENCES', 'No reference images added'),
                margin_top: 12,
                margin_bottom: 12
            });
            emptyLabel.get_style_context().add_class('dim-label');
            emptyRow.add(emptyLabel);
            listBox.add(emptyRow);
        } else {
            for (const ref of references) {
                const row = this.createReferenceRow(ref);
                listBox.add(row);
            }
        }

        listBox.show_all();
    }

    createReferenceRow(ref) {
        const row = new Gtk.ListBoxRow({
            selectable: false
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 8,
            margin_end: 8
        });

        const thumbnailSize = 40;
        const thumbnail = this.createReferenceThumbnail(ref.path, thumbnailSize);

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const nameLabel = new Gtk.Label({
            label: ref.name || 'Unnamed',
            halign: Gtk.Align.START,
            ellipsize: 3
        });

        const dateLabel = new Gtk.Label({
            label: ref.addedAt ? new Date(ref.addedAt).toLocaleDateString() : '',
            halign: Gtk.Align.START
        });
        dateLabel.get_style_context().add_class('dim-label');

        infoBox.pack_start(nameLabel, false, false, 0);
        infoBox.pack_start(dateLabel, false, false, 0);

        const deleteBtn = new Gtk.Button({
            image: new Gtk.Image({ icon_name: 'edit-delete-symbolic', pixel_size: 16 }),
            relief: Gtk.ReliefStyle.NONE,
            valign: Gtk.Align.CENTER
        });
        deleteBtn.get_style_context().add_class('flat');
        addPointerCursor(deleteBtn);
        deleteBtn.connect('clicked', () => {
            this.filterService.removeReferenceImage(ref.id);
            this.populateReferenceList(this.widgets.refListBox);
        });

        box.pack_start(thumbnail, false, false, 0);
        box.pack_start(infoBox, true, true, 0);
        box.pack_end(deleteBtn, false, false, 0);

        row.add(box);
        return row;
    }

    onAddFromFile() {
        const dialog = new Gtk.FileChooserDialog({
            title: this.t('PIPELINE_FILTER_SELECT_IMAGE', 'Select Image'),
            action: Gtk.FileChooserAction.OPEN,
            transient_for: this.dialog,
            modal: true
        });

        const cancelBtn1 = dialog.add_button(this.t('CANCEL', 'Cancel'), Gtk.ResponseType.CANCEL);
        const openBtn = dialog.add_button(this.t('OPEN', 'Open'), Gtk.ResponseType.ACCEPT);
        addPointerCursor(cancelBtn1);
        addPointerCursor(openBtn);

        const filter = new Gtk.FileFilter();
        filter.set_name('Images');
        filter.add_mime_type('image/png');
        filter.add_mime_type('image/jpeg');
        filter.add_mime_type('image/webp');
        filter.add_pattern('*.png');
        filter.add_pattern('*.jpg');
        filter.add_pattern('*.jpeg');
        filter.add_pattern('*.webp');
        dialog.add_filter(filter);

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = dlg.get_file();
                if (file) {
                    const path = file.get_path();
                    const result = this.filterService.addReferenceImage(path);
                    if (result.success) {
                        this.populateReferenceList(this.widgets.refListBox);
                    } else {
                        this.showError(result.error);
                    }
                }
            }
            dlg.destroy();
        });

        dialog.show();
    }

    onCaptureScreen() {
        const screenshotService = this.controller?.screenshotService;
        if (!screenshotService) {
            this.showError('Screenshot service not available');
            return;
        }

        const captureMode = this.controller?.getCaptureMode?.() || 'active_window';
        const mode = this.resolveCaptureMode(screenshotService, captureMode);
        print(`[PipelineFilter] Capturing reference with mode: ${captureMode}`);

        const result = tryOrDefault('PipelineFilterDialog.captureReference', () => screenshotService.capture(mode), null);
        if (!result?.success || !result?.pixbuf) {
            this.showError('Failed to capture screenshot');
            return;
        }

        this.openReferenceNameDialog({
            defaultName: `Screenshot ${new Date().toLocaleTimeString()}`,
            fallbackName: 'Screenshot',
            pixbuf: result.pixbuf
        });
    }

    onPasteFromClipboard() {
        const clipboard = this.getClipboard();
        if (!clipboard) {
            const message = this.t('PIPELINE_FILTER_CLIPBOARD_ERROR', 'Failed to access clipboard');
            print(`[PIPELINE_FILTER] Clipboard paste error: ${message}`);
            this.showError(message);
            return;
        }

        if (!clipboard.wait_is_image_available()) {
            print('[PIPELINE_FILTER] No image in clipboard');
            return;
        }

        const pixbuf = tryOrDefault('PipelineFilterDialog.waitForClipboardImage', () => clipboard.wait_for_image(), null);
        if (!pixbuf) {
            this.showError(this.t('PIPELINE_FILTER_CLIPBOARD_NO_IMAGE', 'No image found in clipboard'));
            return;
        }

        this.openReferenceNameDialog({
            defaultName: `Clipboard ${new Date().toLocaleTimeString()}`,
            fallbackName: 'Clipboard',
            pixbuf
        });
    }

    createStatsRow() {
        const stats = this.filterService.getStats();

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16
        });

        const label = new Gtk.Label({
            label: `${this.t('PIPELINE_FILTER_STATS', 'Stats')}: ${stats.totalChecks} ${this.t('CHECKS', 'checks')}, ${stats.filtered} ${this.t('FILTERED', 'filtered')}, ${stats.passed} ${this.t('PASSED', 'passed')}`,
            halign: Gtk.Align.START
        });
        label.get_style_context().add_class('dim-label');

        box.pack_start(label, false, false, 0);

        return box;
    }

    showError(message) {
        const errorDialog = new Gtk.MessageDialog({
            transient_for: this.dialog,
            modal: true,
            message_type: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.OK,
            text: this.t('ERROR', 'Error'),
            secondary_text: message
        });

        errorDialog.connect('response', () => errorDialog.destroy());
        errorDialog.show();
    }

    collectIgnoreProcessItems(windows) {
        const seen = new Set();
        const items = [];

        for (const windowInfo of windows) {
            const pid = Number(windowInfo?.pid) || 0;
            const processName = pid > 0 ? this.readProcessName(pid) : '';
            const name = (processName || windowInfo?.class || '').trim();
            if (!name) {
                continue;
            }

            const normalizedName = name.toLowerCase();
            if (seen.has(normalizedName)) {
                continue;
            }

            seen.add(normalizedName);
            items.push({
                name,
                cls: windowInfo?.class || '',
                title: windowInfo?.title || '',
                pid
            });
        }

        return items;
    }

    readProcessName(pid) {
        return tryOrDefault('PipelineFilterDialog.readProcessName', () => {
            const [ok, contents] = GLib.file_get_contents(`/proc/${pid}/comm`);
            return ok && contents ? new TextDecoder('utf-8').decode(contents).trim() : '';
        }, '');
    }

    createReferenceThumbnail(path, thumbnailSize) {
        return tryOrDefault('PipelineFilterDialog.createReferenceThumbnail', () => {
            const GdkPixbuf = imports.gi.GdkPixbuf;
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, thumbnailSize, thumbnailSize, true);
            return Gtk.Image.new_from_pixbuf(pixbuf);
        }, new Gtk.Image({
            icon_name: 'image-x-generic-symbolic',
            pixel_size: thumbnailSize
        }));
    }

    resolveCaptureMode(screenshotService, captureMode) {
        const captureModeEnum = screenshotService.constructor?.CaptureMode || {
            FULL_SCREEN: 'full_screen',
            ACTIVE_WINDOW: 'active_window'
        };

        return captureMode === 'full_screen'
            ? captureModeEnum.FULL_SCREEN
            : captureModeEnum.ACTIVE_WINDOW;
    }

    getClipboard() {
        return tryOrDefault('PipelineFilterDialog.getClipboard', () => {
            const clipboardAtom = Gdk.Atom.intern('CLIPBOARD', false);
            return Gtk.Clipboard.get(clipboardAtom);
        }, null);
    }

    openReferenceNameDialog({ defaultName, fallbackName, pixbuf }) {
        const nameDialog = new Gtk.Dialog({
            title: this.t('PIPELINE_FILTER_NAME_REFERENCE', 'Name this reference'),
            transient_for: this.dialog,
            modal: true
        });

        const cancelButton = nameDialog.add_button(this.t('CANCEL', 'Cancel'), Gtk.ResponseType.CANCEL);
        const addButton = nameDialog.add_button(this.t('ADD', 'Add'), Gtk.ResponseType.ACCEPT);
        addPointerCursor(cancelButton);
        addPointerCursor(addButton);

        const content = nameDialog.get_content_area();
        content.set_spacing(12);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const entry = new Gtk.Entry({
            text: defaultName,
            hexpand: true
        });
        content.pack_start(entry, false, false, 0);

        nameDialog.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                this.addReferenceFromPixbuf(pixbuf, entry.get_text() || fallbackName);
            }
            dialog.destroy();
        });

        nameDialog.show_all();
    }

    addReferenceFromPixbuf(pixbuf, name) {
        const result = this.filterService.addReferenceFromPixbuf(pixbuf, name);
        if (result.success) {
            this.populateReferenceList(this.widgets.refListBox);
            return;
        }

        this.showError(result.error);
    }

    destroy() {
        if (this.dialog) {
            this.dialog.destroy();
            this.dialog = null;
        }
    }
}
