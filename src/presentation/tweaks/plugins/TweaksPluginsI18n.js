import {CUSTOM_PARAM_DESCRIPTION_DEFAULTS} from './TweaksPluginsConstants.js';

export const TweaksPluginsI18n = {
    standardizeString(value) {
        return value == null ? '' : String(value).trim();
    },

    parseParamKey(name) {
        return name ? String(name).replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() : '';
    },

    translatePluginParamLabel(param) {
        const defaultText = param.label || param.name || '';
        const key = param.labelKey || `PLUGIN_PARAM_${this.parseParamKey(param.name)}`;
        return this.translate(key, null, defaultText);
    },

    getCustomParamDescriptionDefaults() {
        const baseDefaults = [...CUSTOM_PARAM_DESCRIPTION_DEFAULTS];

        const translated = this.translate('PLUGINS_PARAM_CUSTOM_DESCRIPTION');
        if (translated) {
            baseDefaults.push(this.standardizeString(translated));
        }

        return baseDefaults.map((item) => this.standardizeString(item));
    },

    isCustomParamDefaultDescription(value) {
        const trimmed = this.standardizeString(value);
        return !trimmed || this.getCustomParamDescriptionDefaults()
            .some((def) => def.toLowerCase() === trimmed.toLowerCase());
    },

    translatePluginParamDescription(param) {
        if (this.isCustomParamDefaultDescription(param.description)) {
            return this.translate('PLUGINS_PARAM_CUSTOM_DESCRIPTION');
        }

        const key = param.descriptionKey || `PLUGIN_PARAM_${this.parseParamKey(param.name)}_DESC`;
        return this.translate(key, null, param.description || '');
    }
};
