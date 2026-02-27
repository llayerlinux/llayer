import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import {NOTIFICATION_TYPE_PRIORITIES} from './ThemeContextMenuControllerConstants.js';
import { translateWithFallback } from '../../../infrastructure/utils/Utils.js';

export function applyThemeContextMenuControllerNotifications(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerNotifications.prototype);
}

class ThemeContextMenuControllerNotifications {
    buildTypePriority(localized) {
        return NOTIFICATION_TYPE_PRIORITIES.map(({key, baseMatchers}) => ({
            key,
            matchers: [...baseMatchers, localized[key]].filter(Boolean)
        }));
    }

    detectNotificationType(titleLower, typePriority) {
        return typePriority.find(({matchers}) => matchers.filter(Boolean).some((m) => titleLower.includes(m)))?.key || 'info';
    }

    sendNotification(title, message) {
        let lower = (title || '').toString().toLowerCase();
        let localized = {
            error: (this.translate('ERROR') || '').toLowerCase(),
            success: (this.translate('SUCCESS') || '').toLowerCase(),
            warning: (this.translate('WARNING') || '').toLowerCase()
        };

        let typePriority = this.buildTypePriority(localized);

        let notify = (notifier, type) => notifier
            ? (() => {
                const calls = [
                    () => (typeof notifier[type] === 'function')
                        ? (notifier[type](title, message), true)
                        : false,
                    () => (typeof notifier.notify === 'function')
                        ? (notifier.notify(type, title, message), true)
                        : false
                ];
                return calls.some((call) => call());
            })()
            : false;

        let type = this.detectNotificationType(lower, typePriority),
            containerNotifier = this.container?.get?.('notifier');
        (notify(this.notifier, type) || notify(containerNotifier, type))
            || GLib.spawn_command_line_async(`${Commands.NOTIFY_SEND} "${title}" "${message}"`);
    }

    translate(key, params = null) {
        return translateWithFallback(this.translator, key, params);
    }

    notify(titleKey, messageKey, params = null) {
        const title = this.translate(titleKey);
        const message = this.translate(messageKey, params || undefined);
        this.sendNotification(title, message);
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('ThemeContextMenuController', message, data);
    }
}
