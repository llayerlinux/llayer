import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import {COMMAND_BIN, TRUTHY_VALUES} from './TweaksViewConstants.js';
import {enableHandCursorOnHover} from '../../common/ViewUtils.js';

export function applyTweaksViewUIControls(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewUIControls.prototype);
}

class TweaksViewUIControls {
    createControlContainer() {
        return this.Box({vertical: true, spacing: 4});
    }

    createControlHeader(title) {
        const headerBox = this.Box({spacing: 8});
        const titleLabel = this.Label({
            label: title,
            hexpand: true,
            halign: Gtk.Align.START,
            margin_start: 0,
            className: 'tweaks-control-title'
        });
        headerBox.pack_start(titleLabel, true, true, 0);
        return {headerBox, titleLabel};
    }

    appendControlDescription(container, description) {
        if (!description) return;
        const descLabel = this.Label({
            label: description,
            wrap: true,
            margin_bottom: 4,
            className: 'tweaks-control-description'
        });
        container.pack_start(descLabel, false, false, 0);
    }

    createScaleEntryControl(config) {
        let {
            labelKey, initValue, min, max, step = 1, pageStep = 10,
            tweakKey, widthChars = 4, scaleWidth = 100, parseFunc = parseInt, formatFunc = String,
            valueTransform = (v) => v, clampFunc = (v, mn, mx) => Math.max(mn, Math.min(mx, v))
        } = config;

        let label = this.Label({label: this.translate(labelKey)});
        let scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: min, upper: max, step_increment: step, page_increment: pageStep, value: initValue
            }),
            draw_value: false,
            value_pos: Gtk.PositionType.RIGHT
        });
        scale.set_size_request(scaleWidth, -1);
        scale.get_style_context().add_class('tweaks-scale');

        let entry = new Gtk.Entry({text: formatFunc(initValue), width_chars: widthChars});
        entry.set_margin_start(4);

        let applyTweak = (val) => {
            if (this.tabState !== 'tweaks' || this.tweaksLocked) return;
            this.currentTweaks[tweakKey] = valueTransform(val);
            this.scheduleApplyCurrentTweaks(0);
        };

        let updateLock = false;
        this.connectTweaksHandler(scale, 'value-changed', (s) => {
            if (updateLock) return;
            let val = parseFunc === parseFloat ? parseFloat(s.get_value().toFixed(1)) : Math.round(s.get_value());
            updateLock = true;
            entry.set_text(formatFunc(val));
            updateLock = false;
            applyTweak(val);
        });

        this.connectTweaksHandler(entry, 'changed', (e) => {
            if (updateLock) return;
            let num = parseFunc(e.get_text());
            if (isNaN(num)) return;
            let clamped = clampFunc(num, min, max);
            updateLock = true;
            scale.set_value(clamped);
            updateLock = false;
            applyTweak(clamped);
        });

        return {label, scale, entry};
    }

    createCategory(title) {
        const categoryLabel = this.Label({
            label: title,
            margin_top: 12,
            margin_bottom: 6,
            margin_start: 0,
            halign: Gtk.Align.START,
            className: 'tweaks-category-title'
        });

        const container = this.Box({vertical: true, spacing: 2});
        container.pack_start(categoryLabel, false, false, 0);
        return container;
    }

    createSwitch(title, param, defaultVal, description = '') {
        const container = this.createControlContainer(),
            {headerBox} = this.createControlHeader(title),
            toggle = new Gtk.Switch({active: TRUTHY_VALUES.includes(defaultVal)});
        toggle.get_style_context().add_class('tweaks-switch');
        enableHandCursorOnHover(toggle);
        toggle.set_halign(Gtk.Align.START);

        this.connectTweaksHandler(toggle, 'notify::active', () => {
            if (this.tabState !== 'tweaks' || this.tweaksLocked) return;
            this.execAsync([COMMAND_BIN.HYPRCTL, 'keyword', param, toggle.get_active() ? '1' : '0']);
        });

        headerBox.pack_end(toggle, false, false, 0);
        container.pack_start(headerBox, false, false, 0);

        this.appendControlDescription(container, description);

        return container;
    }

    createSliderEntry(title, param, min, max, defaultVal, description = '') {
        let container = this.createControlContainer(),
            {headerBox} = this.createControlHeader(title);

        let currentValue = parseInt(defaultVal) || defaultVal;

        let valueEntry = new Gtk.Entry({
            text: String(currentValue),
            width_chars: 6,
            max_width_chars: 6
        });
        headerBox.pack_end(valueEntry, false, false, 0);

        container.pack_start(headerBox, false, false, 0);

        let scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                step_increment: 1,
                page_increment: 5,
                value: currentValue
            }),
            draw_value: false,
            hexpand: true
        });

        scale.get_style_context().add_class('tweaks-scale');

        let applyKeyword = (val) => {
            if (this.tabState !== 'tweaks' || this.tweaksLocked) return;
            this.execAsync([COMMAND_BIN.HYPRCTL, 'keyword', param, String(val)]);
        };

        let updateLock = false;
        this.connectTweaksHandler(scale, 'value-changed', () => {
            if (updateLock) return;
            let val = Math.round(scale.get_value());
            updateLock = true;
            valueEntry.set_text(String(val));
            updateLock = false;
            applyKeyword(val);
        });

        this.connectTweaksHandler(valueEntry, 'changed', () => {
            if (updateLock) return;
            let val = parseInt(valueEntry.get_text()) || defaultVal;
            if (val < min || val > max) return;
            updateLock = true;
            scale.set_value(val);
            updateLock = false;
            applyKeyword(val);
        });

        container.pack_start(scale, false, false, 0);

        this.appendControlDescription(container, description);

        return container;
    }

    createColorEntry(title, param, defaultVal, description = '') {
        const container = this.createControlContainer(),
            {headerBox} = this.createControlHeader(title),
            colorBox = this.Box({spacing: 4, hexpand: false});

        const colorEntry = new Gtk.Entry({
            text: defaultVal,
            width_chars: 12,
            placeholder_text: 'rgba(255,255,255,1.0)'
        }),
            colorButton = new Gtk.ColorButton();
        colorButton.set_title(title);

        const parseHexToColor = (value) => {
            const hex = value?.startsWith?.('0x') && value.length >= 8 && value.slice(2),
                toComponent = hex && ((start) => parseInt(hex.slice(start, start + 2), 16) / 255.0);
            return toComponent
                ? {r: toComponent(2), g: toComponent(4), b: toComponent(6), a: hex.length >= 8 ? toComponent(0) : 1.0}
                : null;
        };

        const applyColorToButton = (components) => {
            components && ((color) => (
                Object.assign(color, {red: components.r, green: components.g, blue: components.b, alpha: components.a}),
                colorButton.set_rgba(color)
            ))(new Gdk.RGBA());
        };

        applyColorToButton(parseHexToColor(defaultVal));

        this.connectTweaksHandler(colorButton, 'color-set', () => {
            const color = colorButton.get_rgba(),
                [r, g, b, a] = [color.red, color.green, color.blue, color.alpha].map(v => Math.round(v * 255)),
                hexColor = `0x${[a, r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
            colorEntry.set_text(hexColor);
            this.tabState === 'tweaks' && !this.tweaksLocked && this.execAsync([COMMAND_BIN.HYPRCTL, 'keyword', param, hexColor]);
        });

        this.connectTweaksHandler(colorEntry, 'changed', () => {
            const trimmed = colorEntry.get_text().trim();
            trimmed && (this.tabState === 'tweaks' && !this.tweaksLocked && this.execAsync([COMMAND_BIN.HYPRCTL, 'keyword', param, trimmed]),
                applyColorToButton(parseHexToColor(trimmed)));
        });

        colorBox.pack_start(colorEntry, false, false, 0);
        colorBox.pack_start(colorButton, false, false, 0);
        headerBox.pack_end(colorBox, false, false, 0);
        container.pack_start(headerBox, false, false, 0);

        this.appendControlDescription(container, description);

        return container;
    }

    sliderPosFromBlur(blur) {
        return Math.round(blur * 10);
    }

    blurFromSliderPos(pos) {
        return (pos / 10);
    }
}
