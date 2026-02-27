import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { Commands } from '../constants/Commands.js';
import { tryRun } from '../utils/ErrorUtils.js';

export const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

const NotificationIcons = {
    [NotificationType.INFO]: 'dialog-information',
    [NotificationType.SUCCESS]: 'dialog-information',
    [NotificationType.WARNING]: 'dialog-warning',
    [NotificationType.ERROR]: 'dialog-error',
    [NotificationType.CRITICAL]: 'dialog-error'
};

const NotificationUrgency = {
    [NotificationType.INFO]: 'normal',
    [NotificationType.SUCCESS]: 'normal',
    [NotificationType.WARNING]: 'normal',
    [NotificationType.ERROR]: 'critical',
    [NotificationType.CRITICAL]: 'critical'
};

const GTK_MESSAGE_MAP = {
    [NotificationType.INFO]: Gtk.MessageType.INFO,
    [NotificationType.SUCCESS]: Gtk.MessageType.INFO,
    [NotificationType.WARNING]: Gtk.MessageType.WARNING,
    [NotificationType.ERROR]: Gtk.MessageType.ERROR,
    [NotificationType.CRITICAL]: Gtk.MessageType.ERROR
};

const SPAWN_FLAGS = GLib.SpawnFlags.SEARCH_PATH
    | GLib.SpawnFlags.STDERR_TO_DEV_NULL
    | GLib.SpawnFlags.STDOUT_TO_DEV_NULL;

export class Notifier {
    constructor(_logger = null) {
        this.enableSystem = true;
        this.enableGTK = false;
        this.appName = 'LastLayer';
        this.defaultTimeout = 5000;
        this.hasNotifySend = true;
        this.hasDBus = true;
        this.systemTransports = [
            {available: () => this.hasNotifySend, send: this.tryNotifySend.bind(this)},
            {available: () => this.hasDBus, send: this.tryDBusNotification.bind(this)}
        ];
    }

    standardizeType(type) {
        return Object.values(NotificationType).includes(type)
            ? type
            : NotificationType.INFO;
    }

    buildNotification(type, title, message, options = {}) {
        const normalizedType = this.standardizeType(type);
        const timeout = Number(options.timeout) > 0 ? Number(options.timeout) : this.defaultTimeout;
        return {
            type: normalizedType,
            title: String(title ?? ''),
            message: String(message ?? ''),
            timeout,
            icon: options.icon || NotificationIcons[normalizedType],
            urgency: options.urgency || NotificationUrgency[normalizedType],
            actions: Array.isArray(options.actions) ? options.actions : []
        };
    }

    notify(type, title, message, options = {}) {
        const notification = this.buildNotification(type, title, message, options);
        return {
            system: this.enableSystem ? this.notifySystem(notification) : false,
            gtk: this.enableGTK ? this.notifyGTK(notification) : false
        };
    }

    notifySystem(notification) {
        return this.systemTransports.some((transport) => transport.available() && transport.send(notification));
    }

    tryNotifySend(notification) {
        const sent = tryRun('Notifier.tryNotifySend', () => {
            const args = [
                Commands.NOTIFY_SEND,
                '-a', this.appName,
                '-u', notification.urgency || 'normal',
                '-t', String(notification.timeout || this.defaultTimeout)
            ];

            notification.icon && args.push('-i', notification.icon);
            args.push(notification.title, notification.message);

            GLib.spawn_async(
                null,
                args,
                null,
                SPAWN_FLAGS,
                null
            );
        });
        !sent && (this.hasNotifySend = false);
        return sent;
    }

    tryDBusNotification(notification) {
        const cmd = [
            Commands.DBUS_SEND,
            '--session',
            '--dest=org.freedesktop.Notifications',
            '--type=method_call',
            '/org/freedesktop/Notifications',
            'org.freedesktop.Notifications.Notify',
            `string:"${this.appName}"`,
            'uint32:0',
            `string:"${notification.icon || ''}"`,
            `string:"${notification.title}"`,
            `string:"${notification.message}"`,
            'array:string:""',
            'array:dict:string:string:""',
            `int32:${notification.timeout}`
        ];
        GLib.spawn_async(null, cmd, null,
            SPAWN_FLAGS, null);
        return true;
    }

    notifyGTK(notification) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.showGTKDialog(notification);
            return false;
        });
        return true;
    }

    showGTKDialog(notification) {
        const messageType = this.getGTKMessageType(notification.type);
        const dialog = new Gtk.MessageDialog({
            message_type: messageType,
            buttons: Gtk.ButtonsType.OK,
            text: notification.title,
            secondary_text: notification.message
        });

        dialog.set_icon_name('lastlayer');

        let dialogDestroyed = false;

        dialog.connect('response', () => {
            !dialogDestroyed && (dialogDestroyed = true, dialog.destroy());
        });

        notification.timeout > 0 && GLib.timeout_add(GLib.PRIORITY_DEFAULT, notification.timeout, () => {
            const shouldDestroy = !dialogDestroyed && dialog.get_visible();
            shouldDestroy && (dialogDestroyed = true, dialog.destroy());
            return false;
        });

        dialog.show();
    }

    getGTKMessageType(type) {
        return GTK_MESSAGE_MAP[type] || Gtk.MessageType.INFO;
    }

    info(title, message, options = {}) {
        return this.notify(NotificationType.INFO, title, message, options);
    }

    success(title, message, options = {}) {
        return this.notify(NotificationType.SUCCESS, title, message, options);
    }

    warning(title, message, options = {}) {
        return this.notify(NotificationType.WARNING, title, message, options);
    }

    error(title, message, options = {}) {
        return this.notify(NotificationType.ERROR, title, message, options);
    }

    critical(title, message, options = {}) {
        return this.notify(NotificationType.CRITICAL, title, message, options);
    }

}
