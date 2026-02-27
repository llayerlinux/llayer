import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import {dispatchNotification} from '../../common/NotificationUtils.js';
import {BASIC_LABEL_DEFAULTS} from './TweaksViewConstants.js';

export function applyTweaksViewCore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewCore.prototype);
}

class TweaksViewCore {
    replaceParams(template, params = {}) {
        return Object.keys(params).reduce((acc, paramKey) => {
            const safeValue = params[paramKey] === undefined || params[paramKey] === null
                ? ''
                : String(params[paramKey]);
            return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), safeValue);
        }, template);
    }

    translate(key, params = null, defaultText = null) {
        const translator = this.translator;
        const translated = translator ? translator(key, params) : null;

        switch (true) {
            case typeof translated === 'string' && translated !== key:
                return translated;
            case defaultText != null:
                return defaultText;
            case Boolean(params && typeof params === 'object' && key):
                return this.replaceParams(key, params);
            default:
                return key;
        }
    }

    getCurrentLanguageCode() {
        const lang = this.translator?.getCurrentLanguage?.();
        return lang ? String(lang).toLowerCase() : 'en';
    }

    escapeMarkup(value) {
        return value == null
            ? ''
            : String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    t(key) {
        const translated = this.translate(key);
        return translated !== key ? translated : (BASIC_LABEL_DEFAULTS[key] || key);
    }

    notify(message, details = '') {
        return dispatchNotification({
            notifier: this.controller?.notifier,
            source: 'TweaksViewCore',
            message,
            details
        });
    }
}
