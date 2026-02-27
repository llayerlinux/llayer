import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyLabelAttributes } from '../../../common/ViewUtils.js';
import { applyHyprlandEntryWidgetValue, buildHyprlandParameterInput } from '../../../common/HyprlandParamUiShared.js';

export function applyHyprlandTabBuildParameters(prototype) {
    prototype.buildParameterList = function(box) {
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 350,
            max_content_height: 500
        });

        const grid = new Gtk.Grid({
            column_spacing: 6,
            row_spacing: 8,
            column_homogeneous: false,
            margin_end: 8
        });

        const autoDetectParams = [];
        const overriddenParams = [];
        const otherParams = [];

        for (const param of this.getParametersSortedByPopularity()) {
            const isAutoDetected = this.isAutoDetectParam && this.isAutoDetectParam(param.fullPath);
            const isOverridden = Object.prototype.hasOwnProperty.call(this.currentOverrides ?? {}, param.fullPath);
            (isAutoDetected ? autoDetectParams : (isOverridden ? overriddenParams : otherParams)).push(param);
        }

        const col1Params = [...autoDetectParams, ...overriddenParams.filter((_, i) => i % 2 === 0)];
        const col2Params = [...overriddenParams.filter((_, i) => i % 2 === 1)];
        const remainingParams = [...otherParams];

        while (remainingParams.length > 0) {
            (col1Params.length <= col2Params.length ? col1Params : col2Params).push(remainingParams.shift());
        }

        const maxRows = Math.max(col1Params.length, col2Params.length);

        maxRows > 0 && col2Params.length > 0 && (() => {
            const separator = new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL
            });
            separator.set_margin_start(8);
            separator.set_margin_end(8);
            grid.attach(separator, 3, 0, 1, maxRows);
        })();

        for (let row = 0; row < maxRows; row++) {
            col1Params[row] && this.buildParameterGridRow(grid, col1Params[row], row, 0, 2);
            col2Params[row] && this.buildParameterGridRow(grid, col2Params[row], row, 1, 2);
        }

        scrolled.add(grid);
        box.pack_start(scrolled, true, true, 0);

        this.widgets.parameterListBox = grid;
    };

    prototype.buildParameterGridRow = function(grid, param, rowIndex, colSet = 0, numColumns = 2) {
        const colOffset = colSet * 4;

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START
        });
        labelBox.set_size_request(140, -1);

        const label = new Gtk.Label({
            label: param.name,
            halign: Gtk.Align.START,
            ellipsize: 3
        });
        label.set_tooltip_text(param.description || param.fullPath);
        const hasOverride = this.currentOverrides[param.fullPath] !== undefined;
        hasOverride && label.get_style_context().add_class('global-override-label');
        labelBox.pack_start(label, false, false, 0);

        const sectionLabel = new Gtk.Label({
            label: param.section,
            halign: Gtk.Align.START
        });
        sectionLabel.get_style_context().add_class('dim-label');
        sectionLabel.set_margin_top(2);
        const sectionRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER
        });
        sectionRow.pack_start(sectionLabel, false, false, 0);

        const resetBtn = new Gtk.Button({
            label: '\u00d7',
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

        grid.attach(labelBox, colOffset + 0, rowIndex, 1, 1);

        const isColorParameter = this.isColorParam(param);
        const currentValue = this.currentOverrides[param.fullPath];

        const inputUi = buildHyprlandParameterInput({
            param,
            currentValue,
            isColorParameter,
            nameLabel: label,
            parameterEntries: this.parameterEntries,
            getSliderRange: this.getSliderRange.bind(this),
            isSliderParam: this.isSliderParam.bind(this),
            getPlaceholderText: this.getPlaceholderForParam.bind(this),
            onValueChanged: (value) => this.handleParameterChange(param.fullPath, value),
            parseHyprlandColor: this.parseHyprlandColor.bind(this),
            rgbaToHyprland: this.rgbaToHyprland.bind(this),
            updateColorButton: this.updateColorButton?.bind(this),
            inputContainerWidth: 200,
            inputContainerValign: Gtk.Align.CENTER,
            sliderScaleWidth: 110,
            sliderEntryWidth: 50,
            sliderEntryChars: { width: 4, max: 5 },
            comboWidth: 190,
            entryWidth: 190,
            colorEntryWidth: 140,
            colorButtonSize: 28,
            entryChars: {
                width: isColorParameter ? 14 : 18,
                max: isColorParameter ? 16 : 20
            },
            allowSuspendChange: true
        });
        const inputBox = inputUi.inputContainer;

        grid.attach(inputBox, colOffset + 1, rowIndex, 1, 1);

        resetBtn.connect('clicked', () => {
            const entryData = this.parameterEntries.get(param.fullPath);
            entryData && (
                entryData.suspendChange = true,
                applyHyprlandEntryWidgetValue(entryData, '', {
                    sliderMinOnEmpty: true,
                    comboActiveOnEmpty: -1
                }),
                entryData.suspendChange = false,
                this.handleParameterChange(param.fullPath, '')
            );
        });

        const entryData = this.parameterEntries.get(param.fullPath);
        entryData && (entryData.resetButton = resetBtn);

        const isAutoDetected = this.isAutoDetectParam?.(param.fullPath) === true;
        isAutoDetected && (() => {
            const translatedSystemDetected = this.t('SYSTEM_DETECTED');
            const autoDetectLabel = new Gtk.Label({
                label: translatedSystemDetected === 'SYSTEM_DETECTED' ? 'System detected' : translatedSystemDetected,
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                visible: false,
                use_markup: false
            });
            applyLabelAttributes(autoDetectLabel, { color: '#33d17a' });
            autoDetectLabel.get_style_context().add_class('override-system-detected');
            autoDetectLabel.set_margin_start(4);
            autoDetectLabel.set_no_show_all(true);
            grid.attach(autoDetectLabel, colOffset + 2, rowIndex, 1, 1);
            this.autoDetectLabels.set(param.fullPath, autoDetectLabel);
        })();
    };
}
