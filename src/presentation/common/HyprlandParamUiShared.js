import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { applyOptionalSetters } from './ViewUtils.js';

const SLIDER_MAX_RULES = [
    { pattern: 'gaps', max: 50 },
    { pattern: 'border_size', max: 20 },
    { pattern: 'rounding', max: 50 },
    { pattern: 'blur:size', max: 30 },
    { pattern: 'blur:passes', max: 10 }
];

export function inferHyprlandSliderMax(fullPath = '', type = '') {
    const path = String(fullPath || '');
    const match = SLIDER_MAX_RULES.find((rule) => path.includes(rule.pattern));
    return match ? match.max : (type === 'float' ? 2 : 100);
}

export function getHyprlandSliderRange(param = {}) {
    const min = param.min ?? 0;
    const max = param.max ?? inferHyprlandSliderMax(param.fullPath, param.type);
    const step = param.type === 'float' ? 0.01 : 1;
    return { min, max, step };
}

export function parseHyprlandColorValue(colorStr) {
    let raw = typeof colorStr === 'string' ? colorStr.trim().toLowerCase() : '';
    if (!raw.startsWith('0x')) return null;

    let hex = raw.substring(2),
        parsers = {
            8: (value) => ({
                a: parseInt(value.substring(0, 2), 16) / 255,
                r: parseInt(value.substring(2, 4), 16) / 255,
                g: parseInt(value.substring(4, 6), 16) / 255,
                b: parseInt(value.substring(6, 8), 16) / 255
            }),
            6: (value) => ({
                a: 1.0,
                r: parseInt(value.substring(0, 2), 16) / 255,
                g: parseInt(value.substring(2, 4), 16) / 255,
                b: parseInt(value.substring(4, 6), 16) / 255
            })
        },
        parsed = parsers[hex.length]?.(hex);
    if (!parsed) return null;

    let { r, g, b, a } = parsed;
    if ([r, g, b, a].some(Number.isNaN)) return null;

    let rgba = new Gdk.RGBA();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;
    return rgba;
}

export function rgbaToHyprlandValue(rgba) {
    const toHex = (value) => Math.round(value * 255).toString(16).padStart(2, '0');
    return `0x${toHex(rgba.alpha)}${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
}

export function syncColorButtonValue(colorBtn, colorStr, parseColor = parseHyprlandColorValue) {
    const rgba = parseColor(colorStr);
    applyOptionalSetters([[rgba, (value) => colorBtn.set_rgba(value)]]);
}

export function hasHyprlandValue(value) {
    return value !== null && value !== undefined && value !== '';
}

export function isEnabledBooleanValue(value) {
    return value === 'true' || value === '1' || value === 'yes';
}

export function applyHyprlandEntryWidgetValue(entryData, value, options = {}) {
    if (!entryData) {
        return;
    }

    const {
        emptyText = '',
        sliderMinOnEmpty = false,
        comboActiveOnEmpty = null
    } = options;

    const hasValue = hasHyprlandValue(value);
    const textValue = hasValue ? String(value) : emptyText;
    const normalizedEntry = entryData?.widget
        ? entryData
        : { type: entryData?.type ?? 'entry', widget: entryData };
    const widget = normalizedEntry.widget || normalizedEntry;

    switch (normalizedEntry.type) {
        case 'checkbox':
            widget.set_active(isEnabledBooleanValue(value));
            return;
        case 'slider': {
            widget.set_text(textValue);
            const numericValue = parseFloat(value);
            const hasNumericScale = !isNaN(numericValue) && normalizedEntry.scale;
            if (hasNumericScale) {
                normalizedEntry.scale.set_value(numericValue);
            } else if (!hasValue && sliderMinOnEmpty && normalizedEntry.scale) {
                const adjustment = normalizedEntry.scale.get_adjustment?.();
                if (adjustment) normalizedEntry.scale.set_value(adjustment.get_lower());
            }
            return;
        }
        case 'combo':
            hasValue
                ? widget.set_active_id(String(value))
                : Number.isInteger(comboActiveOnEmpty) && widget.set_active(comboActiveOnEmpty);
            return;
        default:
            widget.set_text(textValue);
    }
}

export function buildHyprlandParameterInput(options = {}) {
    const {
        param = {},
        currentValue = '',
        isColorParameter = false,
        nameLabel = null,
        parameterEntries = null,
        getSliderRange = () => ({ min: 0, max: 100, step: 1 }),
        isSliderParam = () => false,
        getPlaceholderText = () => '',
        onValueChanged = () => {},
        parseHyprlandColor = () => null,
        rgbaToHyprland = () => '',
        updateColorButton = null,
        inputContainerWidth = 200,
        inputContainerValign = null,
        sliderScaleWidth = 110,
        sliderEntryWidth = 50,
        sliderEntryChars = { width: 4, max: 5 },
        comboWidth = 190,
        entryWidth = 190,
        colorEntryWidth = 140,
        colorButtonSize = 28,
        entryChars = null,
        allowSuspendChange = false
    } = options;

    const inputContainer = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        halign: Gtk.Align.START,
        spacing: 4
    });
    inputContainer.set_size_request(inputContainerWidth, -1);
    inputContainerValign !== null && inputContainer.set_valign(inputContainerValign);

    let inputWidget = null;
    let entryData = null;

    const registerEntryData = (data) => {
        entryData = data;
        parameterEntries?.set?.(param.fullPath, data);
        return data;
    };

    const isSuspended = () => allowSuspendChange && !!entryData?.suspendChange;
    const emitValueChange = (value) => {
        if (!isSuspended()) onValueChanged(value);
    };

    const buildBoolInput = () => {
        const checkbox = new Gtk.CheckButton({ valign: Gtk.Align.CENTER });
        checkbox.set_active(isEnabledBooleanValue(currentValue));
        registerEntryData({ type: 'checkbox', widget: checkbox, nameLabel });
        checkbox.connect('toggled', () => {
            emitValueChange(checkbox.get_active() ? 'true' : 'false');
        });
        inputWidget = checkbox;
        inputContainer.pack_start(checkbox, false, false, 0);
    };

    const buildSliderInput = () => {
        let { min, max, step } = getSliderRange(param),
            digits = param.type === 'float' ? 2 : 0;

        let scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                step_increment: step,
                page_increment: step * 10
            }),
            digits,
            draw_value: false,
            valign: Gtk.Align.CENTER
        });
        scale.set_size_request(sliderScaleWidth, -1);
        scale.get_style_context().add_class('override-scale');

        let entry = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            width_chars: sliderEntryChars.width,
            max_width_chars: sliderEntryChars.max
        });
        entry.set_size_request(sliderEntryWidth, -1);

        let parsedValue = parseFloat(currentValue),
            numValue = !isNaN(parsedValue) ? parsedValue : (param.defaultValue ?? min);
        scale.set_value(numValue);
        entry.set_text(hasHyprlandValue(currentValue) ? String(currentValue) : String(numValue));

        registerEntryData({ type: 'slider', widget: entry, scale, nameLabel });

        let updatingFromScale = false;
        scale.connect('value-changed', () => {
            if (isSuspended() || updatingFromScale) return;
            let value = param.type === 'float'
                ? scale.get_value().toFixed(digits)
                : Math.round(scale.get_value()).toString();
            entry.set_text(value);
            emitValueChange(value);
        });

        entry.connect('changed', () => {
            if (isSuspended()) return;
            let text = entry.get_text().trim(),
                numericValue = parseFloat(text);
            if (isNaN(numericValue)) return;
            updatingFromScale = true;
            scale.set_value(Math.min(Math.max(numericValue, min), max));
            updatingFromScale = false;
            emitValueChange(text);
        });

        inputWidget = entry;
        inputContainer.pack_start(scale, false, false, 0);
        inputContainer.pack_start(entry, false, false, 0);
    };

    const buildOptionsInput = () => {
        const combo = new Gtk.ComboBoxText({ valign: Gtk.Align.CENTER });
        combo.set_size_request(comboWidth, -1);
        combo.get_style_context().add_class('override-combo');

        for (const option of param.options || []) {
            combo.append(String(option), String(option));
        }

        applyOptionalSetters([[
            [currentValue, param.defaultValue].find((value) => value !== null && value !== undefined && value !== ''),
            (value) => combo.set_active_id(String(value)), (value) => value !== undefined
        ]]);

        registerEntryData({ type: 'combo', widget: combo, nameLabel });
        combo.connect('changed', () => {
            if (isSuspended()) return;
            const selectedValue = combo.get_active_id();
            if (selectedValue) emitValueChange(selectedValue);
        });

        inputWidget = combo;
        inputContainer.pack_start(combo, false, false, 0);
    };

    const buildEntryInput = () => {
        const entryOptions = {
            placeholder_text: getPlaceholderText(param),
            ...(entryChars ? {width_chars: entryChars.width, max_width_chars: entryChars.max} : {})
        };
        const entry = new Gtk.Entry(entryOptions);
        entry.set_size_request(isColorParameter ? colorEntryWidth : entryWidth, -1);

        applyOptionalSetters([[currentValue, (value) => entry.set_text(String(value)), hasHyprlandValue]]);

        registerEntryData({ type: 'entry', widget: entry, nameLabel });
        entry.connect('changed', () => {
            if (isSuspended()) return;
            emitValueChange(entry.get_text().trim());
            isColorParameter && entry._colorBtn && typeof updateColorButton === 'function'
                && updateColorButton(entry._colorBtn, entry.get_text().trim());
        });

        inputWidget = entry;
        inputContainer.pack_start(entry, false, false, 0);

        if (isColorParameter) {
            const colorBtn = new Gtk.ColorButton({
                valign: Gtk.Align.CENTER,
                use_alpha: true
            });
            colorBtn.set_size_request(colorButtonSize, colorButtonSize);
            applyOptionalSetters([[parseHyprlandColor(currentValue), (value) => colorBtn.set_rgba(value)]]);
            colorBtn.connect('color-set', () => {
                entry.set_text(rgbaToHyprland(colorBtn.get_rgba()));
            });
            entry._colorBtn = colorBtn;
            inputContainer.pack_start(colorBtn, false, false, 0);
        }
    };

    const selectedBuilder = [
        [param.type === 'bool', buildBoolInput],
        [isSliderParam(param), buildSliderInput],
        [Array.isArray(param.options) && param.options.length > 0, buildOptionsInput]
    ].find(([matches]) => matches)?.[1] || buildEntryInput;
    selectedBuilder();

    return { inputContainer, inputWidget, entryData };
}
