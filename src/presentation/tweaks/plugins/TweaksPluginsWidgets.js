import Gtk from 'gi://Gtk?version=3.0';
import {COMMAND_BIN} from './TweaksPluginsConstants.js';
import {enableHandCursorOnHover} from '../../common/ViewUtils.js';

export const TweaksPluginsWidgets = {

    applyParamDefault(pluginName, paramName, defaultValue) {
        const isEmpty = defaultValue === undefined || defaultValue === null || defaultValue === '';
        this.setPluginParam(pluginName, paramName, isEmpty ? null : defaultValue);
        !isEmpty && this.setPluginOption(pluginName, paramName, defaultValue);
        this.writePluginParametersFile();
    },

    removeParamCompletely(pluginName, paramName) {
        const hadValue = this.deletePluginParam(pluginName, paramName);
        this.execSyncCommand(`${COMMAND_BIN.HYPRCTL} keyword plugin:${pluginName}:${paramName} unset`);
        this.removeCustomParameterInfo(pluginName, paramName);
        hadValue && this.writePluginParametersFile();
        this.refreshPluginParametersUI(pluginName);
    },

    getParamCurrentValue(pluginName, param, defaultValue) {
        const cached = this.getPluginParam(pluginName, param.name);
        if (cached !== undefined) {
            return cached;
        }
        const value = this.getPluginOption(pluginName, param.name, defaultValue ?? param.default);
        this.setPluginParam(pluginName, param.name, value);
        return value;
    },

    createIntWidget(pluginName, param) {
        const intValue = this.getParamCurrentValue(pluginName, param, param.default);
        const spin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                value: parseInt(intValue) || param.default,
                lower: param.min || 0,
                upper: param.max || 100,
                step_increment: 1,
                page_increment: 10
            }), digits: 0
        });
        spin.connect('value-changed', () => {
            const value = spin.get_value_as_int();
            this.setPluginOption(pluginName, param.name, value);
        });
        return spin;
    },

    createBoolWidget(pluginName, param) {
        const boolValue = this.getParamCurrentValue(pluginName, param, param.default);
        const toggle = new Gtk.Switch({
            active: boolValue === 1 || boolValue === true || boolValue === 'true',
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false
        });
        toggle.get_style_context().add_class('plugins-param-switch');
        enableHandCursorOnHover(toggle);
        toggle.connect('notify::active', () => {
            const value = toggle.get_active() ? 1 : 0;
            this.setPluginOption(pluginName, param.name, value);
        });
        return toggle;
    },

    createColorWidget(pluginName, param) {
        let colorContainer = this.Box({vertical: false, spacing: 4});
        let colorValue = this.getParamCurrentValue(pluginName, param, param.default || '0xffffffff') || param.default || '0xffffffff';
        colorValue = typeof colorValue === 'number' ? this.convertNumberToHex(colorValue) : colorValue;
        colorValue = String(colorValue);

        let colorEntry = new Gtk.Entry({
            text: colorValue, placeholder_text: '0xffffffff', width_chars: 12
        }),
            colorButton = new Gtk.ColorButton();
        colorButton.set_rgba(this.pluginHexToRgba(colorValue));

        colorContainer._colorEntry = colorEntry;
        colorContainer._colorButton = colorButton;

        colorEntry.connect('changed', () => {
            const value = colorEntry.get_text();
            value.trim() && (this.setPluginOption(pluginName, param.name, value), colorButton.set_rgba(this.pluginHexToRgba(value)));
        });

        colorButton.connect('color-set', () => {
            const rgba = colorButton.get_rgba();
            const hexColor = this.pluginRgbaToHex(rgba);
            colorEntry.set_text(hexColor);
            hexColor.trim() && this.setPluginOption(pluginName, param.name, hexColor);
        });

        colorContainer.pack_start(colorEntry, true, true, 0);
        colorContainer.pack_start(colorButton, false, false, 0);
        return colorContainer;
    },

    createStringWidget(pluginName, param) {
        const entry = new Gtk.Entry({
            text: String(this.getParamCurrentValue(pluginName, param, param.default || '') ?? param.default ?? ''),
            placeholder_text: this.translate('PLUGINS_PARAM_VALUE_PLACEHOLDER')
        });
        entry.connect('changed', () => this.setPluginOption(pluginName, param.name, entry.get_text()));
        return entry;
    },

    createParamWidget(pluginName, param) {
        switch (param.type) {
            case 'int':
                return this.createIntWidget(pluginName, param);
            case 'bool':
                return this.createBoolWidget(pluginName, param);
            case 'color':
                return this.createColorWidget(pluginName, param);
            case 'string':
                return this.createStringWidget(pluginName, param);
            default:
                const unsupportedLabel = new Gtk.Label({
                    label: this.translate('PLUGINS_PARAM_UNSUPPORTED_TYPE', {type: param.type})
                });
                unsupportedLabel.get_style_context().add_class('italic-text');
                return unsupportedLabel;
        }
    },

    getPluginParameters(pluginName) {
        let standardParams = this.PLUGIN_PARAMETERS?.[pluginName] ?? [],
            params = [...standardParams];

        let customParams = this.customPluginParameters?.[pluginName];
        customParams && typeof customParams === 'object' && (() => {
            for (const [paramName, paramInfo] of Object.entries(customParams)) {
                const exists = params.some(p => p.name === paramName);
                !exists && params.push({
                    name: paramName,
                    type: paramInfo.type || 'string',
                    default: paramInfo.default,
                    label: paramInfo.label || paramName,
                    description: paramInfo.description || '',
                    isCustom: true
                });
            }
        })();

        return params;
    },

    hasPluginParameters(pluginName) {
        return (this.PLUGIN_PARAMETERS[pluginName] ?? []).length > 0
            || (this.customPluginParameters?.[pluginName]
                ? Object.keys(this.customPluginParameters[pluginName]).length > 0 : false);
    },

    pluginHexToRgba(hex) {
        const white = () => new Gdk.RGBA({red: 1, green: 1, blue: 1, alpha: 1});
        if (typeof hex !== 'string') return white();
        const normalized = ((s) => s.length === 6 ? `ff${s}` : s)(hex.replace(/^0x/i, '').replace(/^#/, ''));
        if (normalized.length !== 8) return white();
        const [a, r, g, b] = [0, 2, 4, 6].map(s => parseInt(normalized.slice(s, s + 2), 16) / 255);
        return new Gdk.RGBA({red: r, green: g, blue: b, alpha: a});
    },

    pluginRgbaToHex(rgba) {
        const r = Math.round(rgba.red * 255).toString(16).padStart(2, '0');
        const g = Math.round(rgba.green * 255).toString(16).padStart(2, '0');
        const b = Math.round(rgba.blue * 255).toString(16).padStart(2, '0');
        const a = Math.round(rgba.alpha * 255).toString(16).padStart(2, '0');

        return `0x${a}${r}${g}${b}`;
    },

    convertNumberToHex(num) {
        return typeof num === 'number'
            ? `0x${(num >>> 0).toString(16).padStart(8, '0')}`
            : '0xffffffff';
    },

    convertDefaultValue(value, type) {
        if (value === undefined || value === null || value === '') {
            switch (type) {
                case 'int':
                    return 0;
                case 'bool':
                    return false;
                case 'color':
                    return '0xffffffff';
                case 'string':
                    return '';
                default:
                    return '';
            }
        }
        switch (type) {
            case 'int':
                return parseInt(value, 10) || 0;
            case 'bool':
                return value === 'true' || value === '1' || value === true;
            case 'color':
                return String(value);
            case 'string':
                return String(value);
            default:
                return String(value);
        }
    }
};
