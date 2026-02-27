import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from '../../../common/ViewUtils.js';
import { applyHyprlandEntryWidgetValue, buildHyprlandParameterInput } from '../../../common/HyprlandParamUiShared.js';

export function applyHyprlandOverridePopupRowsBuild(prototype) {
    const addToSizeGroup = (groups, key, widget) => {
        applyOptionalSetters([[groups?.[key], (group) => group.add_widget(widget)]]);
    };

    prototype.buildParameterRow = function(param) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4
        });

        const hasPerRiceOverride = this.currentOverrides[param.fullPath] !== undefined;
        const hasGlobalOverride = this.globalOverrides[param.fullPath] !== undefined;

        applyOptionalSetters([[
            hasPerRiceOverride || hasGlobalOverride,
            () => row.get_style_context().add_class('overridden-row'),
            Boolean
        ]]);

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER
        });
        labelBox.set_size_request(150, -1);

        const nameLabel = new Gtk.Label({
            label: param.name,
            halign: Gtk.Align.START,
            xalign: 0,
            ellipsize: 3
        });
        nameLabel.set_tooltip_text(param.description || param.fullPath);

        this.updateOverrideLabelClass(nameLabel, hasPerRiceOverride, hasGlobalOverride && !hasPerRiceOverride);

        labelBox.pack_start(nameLabel, false, false, 0);

        const sectionLabel = new Gtk.Label({
            label: param.section,
            halign: Gtk.Align.START,
            xalign: 0,
            ellipsize: 3
        });
        sectionLabel.get_style_context().add_class('dim-label');
        labelBox.pack_start(sectionLabel, false, false, 0);

        addToSizeGroup(this.sizeGroups, 'name', labelBox);
        row.pack_start(labelBox, false, false, 0);

        const currentValue = this.stripComment(this.getCurrentValue(param.fullPath));
        const strippedOriginal = this.stripComment(this.getOriginalValue(param.fullPath));
        const isColorParameter = this.isColorParam(param);

        const valueColumnWidth = this.valueColumnWidth || 170;
        const inputUi = buildHyprlandParameterInput({
            param,
            currentValue,
            isColorParameter,
            nameLabel,
            parameterEntries: this.parameterEntries,
            getSliderRange: this.getSliderRange.bind(this),
            isSliderParam: this.isSliderParam.bind(this),
            getPlaceholderText: this.getPlaceholder.bind(this),
            onValueChanged: (value) => this.handleEntryChanged(param.fullPath, value),
            parseHyprlandColor: this.parseHyprlandColor.bind(this),
            rgbaToHyprland: this.rgbaToHyprland.bind(this),
            updateColorButton: this.updateColorButton?.bind(this),
            inputContainerWidth: valueColumnWidth,
            sliderScaleWidth: Math.max(valueColumnWidth - 55, 85),
            sliderEntryWidth: 40,
            sliderEntryChars: { width: 4, max: 4 },
            comboWidth: Math.max(valueColumnWidth - 10, 120),
            entryWidth: Math.max(valueColumnWidth - 10, 120),
            colorEntryWidth: 85,
            colorButtonSize: 24,
            allowSuspendChange: false
        });
        const inputContainer = inputUi.inputContainer;

        addToSizeGroup(this.sizeGroups, 'input', inputContainer);
        row.pack_start(inputContainer, false, false, 0);

        const globalBtnContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 4
        });
        globalBtnContainer.set_size_request(70, -1);

        const globalBtn = new Gtk.Button({
            label: 'G',
            valign: Gtk.Align.CENTER,
            sensitive: (hasGlobalOverride || hasPerRiceOverride) && hasPerRiceOverride
        });
        globalBtn.set_size_request(24, 24);
        globalBtn.get_style_context().add_class('global-btn');
        applyOptionalSetters([[hasGlobalOverride, () => globalBtn.get_style_context().add_class('has-global'), Boolean]]);
        globalBtn.set_tooltip_text(
            hasGlobalOverride
                ? (this.t('USE_GLOBAL_OVERRIDE_TOOLTIP') || 'Use global override value')
                : (this.t('CLEAR_PER_RICE_TOOLTIP') || 'Clear per-rice override')
        );
        addPointerCursor(globalBtn);

        globalBtn.connect('clicked', () => {
            this.handleUseGlobal(param.fullPath);
        });
        globalBtnContainer.pack_start(globalBtn, true, true, 0);

        const initiator = this.globalOverrideInitiators?.[param.fullPath];
        const digActive = hasGlobalOverride && initiator === this.currentTheme?.name;
        const digBtn = new Gtk.Button({
            label: 'DIG',
            valign: Gtk.Align.CENTER,
            sensitive: !digActive
        });
        digBtn.set_size_request(36, 24);
        digBtn.get_style_context().add_class('hotkey-dig-btn');
        digActive && digBtn.get_style_context().add_class('dig-active');
        digBtn.set_tooltip_text(this.t('DIG_TOOLTIP') || 'Duplicate to global settings');
        addPointerCursor(digBtn);
        digBtn.connect('clicked', () => {
            this.handleParameterDig(param.fullPath);
        });
        globalBtnContainer.pack_start(digBtn, true, true, 0);

        const entryData = this.parameterEntries.get(param.fullPath);
        applyOptionalSetters([[entryData, (value) => {
            value.globalBtn = globalBtn;
            value.digBtn = digBtn;
        }]]);

        addToSizeGroup(this.sizeGroups, 'global', globalBtnContainer);
        row.pack_start(globalBtnContainer, false, false, 0);

        const arrowContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER
        });
        arrowContainer.set_size_request(40, -1);

        const arrowBtn = new Gtk.Button({
            label: '\u2190',
            valign: Gtk.Align.CENTER,
            sensitive: this.getOriginalValue(param.fullPath) !== null
        });
        arrowBtn.set_tooltip_text(this.t('RESTORE_ORIGINAL_TOOLTIP') || 'Restore original value');
        addPointerCursor(arrowBtn);
        arrowBtn.connect('clicked', () => {
            const original = this.stripComment(this.getOriginalValue(param.fullPath));
            applyHyprlandEntryWidgetValue(this.parameterEntries.get(param.fullPath), original, {
                sliderMinOnEmpty: true,
                comboActiveOnEmpty: -1
            });
        });
        arrowContainer.pack_start(arrowBtn, true, true, 0);

        addToSizeGroup(this.sizeGroups, 'arrow', arrowContainer);
        row.pack_start(arrowContainer, false, false, 0);

        const originalContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 4
        });
        originalContainer.set_size_request(110, -1);

        const colorPreview = (isColorParameter && strippedOriginal)
            ? this.createColorPreview(strippedOriginal, 14)
            : null;
        applyOptionalSetters([[colorPreview, (widget) => originalContainer.pack_start(widget, false, false, 0)]]);

        const originalLabel = new Gtk.Label({
            label: strippedOriginal !== null && strippedOriginal !== '' ? strippedOriginal : '-',
            halign: Gtk.Align.CENTER,
            ellipsize: 3
        });
        originalLabel.get_style_context().add_class('dim-label');
        originalLabel.set_tooltip_text(this.t('ORIGINAL_VALUE_TOOLTIP') || 'Original value from theme');
        originalContainer.pack_start(originalLabel, true, true, 0);

        addToSizeGroup(this.sizeGroups, 'original', originalContainer);
        row.pack_start(originalContainer, false, false, 0);

        return row;
    };
}
