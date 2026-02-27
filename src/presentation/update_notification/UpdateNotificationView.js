import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../../infrastructure/constants/Commands.js';
import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';
import {addPointerCursor} from '../common/ViewUtils.js';

export class UpdateNotificationView {
    constructor(container = null) {
        this.container = container;
        this.translator = container?.has?.('translator') ? container.get('translator') : null;
        this.settingsService = container?.has?.('settingsService') ? container.get('settingsService') : null;
        this.banner = null;
        this.isVisible = false;
        this.updateInfo = null;
        this.ignoredVersions = this.loadIgnoredVersions();
    }

    createBanner(updateInfo) {
        if (!updateInfo) {
            return null;
        }

        this.updateInfo = updateInfo;

        const bannerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 2,
            margin_bottom: 2
        });

        const eventBox = new Gtk.EventBox({
            visible: true,
            above_child: false
        });

        bannerBox.get_style_context().add_class('update-notification-banner');

        const iconBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER
        });

        const updateIcon = new Gtk.Image({
            icon_name: 'software-update-available-symbolic',
            icon_size: Gtk.IconSize.LARGE_TOOLBAR,
            pixel_size: 32
        });
        iconBox.pack_start(updateIcon, false, false, 0);

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const notificationText = updateInfo.title || this.getTranslation('UPDATE_AVAILABLE_TEXT', 'New version available');
        const titleLabel = new Gtk.Label({
            label: notificationText,
            xalign: 0,
            wrap: true
        });
        titleLabel.get_style_context().add_class('update-notification-title');

        const versionText = `${this.getTranslation('VERSION', 'Version')}: ${updateInfo.version}`;
        const versionLabel = new Gtk.Label({
            label: versionText,
            xalign: 0
        });
        versionLabel.get_style_context().add_class('update-notification-version');

        textBox.pack_start(titleLabel, false, false, 0);
        textBox.pack_start(versionLabel, false, false, 0);

        const closeButton = new Gtk.Button({
            relief: Gtk.ReliefStyle.NONE,
            valign: Gtk.Align.CENTER,
            tooltip_text: this.getTranslation('IGNORE_VERSION', 'Ignore this version')
        });

        const closeIcon = new Gtk.Image({
            icon_name: 'window-close-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR,
            pixel_size: 20
        });
        closeButton.add(closeIcon);
        closeButton.get_style_context().add_class('update-notification-close');
        addPointerCursor(closeButton);

        closeButton.connect('clicked', () => {
            this.ignoreVersion(updateInfo.version);
            this.hide();
        });

        eventBox.connect('button-press-event', () => {
            updateInfo.url && GLib.spawn_command_line_async(`${Commands.XDG_OPEN} ${updateInfo.url}`);
            return false;
        });

        eventBox.connect('enter-notify-event', (widget) => {
            const window = widget.get_window();
            const handCursor = window ? Gdk.Cursor.new_from_name(window.get_display(), 'pointer') : null;
            window?.set_cursor?.(handCursor);
            return false;
        });

        eventBox.connect('leave-notify-event', (widget) => {
            widget.get_window()?.set_cursor?.(null);
            return false;
        });

        bannerBox.pack_start(iconBox, false, false, 0);
        bannerBox.pack_start(textBox, true, true, 0);
        bannerBox.pack_start(closeButton, false, false, 0);

        eventBox.add(bannerBox);

        this.banner = eventBox;
        this.isVisible = true;

        return eventBox;
    }

    show(updateInfo, container) {
        if (!updateInfo || !container || this.isVersionIgnored(updateInfo.version)) {
            return;
        }

        this.hide();

        const banner = this.createBanner(updateInfo);
        banner && container.pack_start(banner, false, false, 2);
        banner && container.reorder_child(banner, 0);
        banner?.show_all?.();
    }

    hide() {
        const removeBanner = () => {
            const parent = this.banner?.get_parent?.();
            parent?.remove?.(this.banner);
            this.banner = null;
        };

        removeBanner();
        this.isVisible = false;
    }

    ignoreVersion(version) {
        this.ignoredVersions.push(version);
        this.writeIgnoredVersions();
    }

    isVersionIgnored(version) {
        return this.ignoredVersions.includes(version);
    }

    loadIgnoredVersions() {
        let {configPath} = this.getIgnoredUpdatesPath(),
            file = Gio.File.new_for_path(configPath),
            [ok, contents] = file.query_exists(null)
            ? (tryOrNull(
                'UpdateNotificationView.loadIgnoredVersions.read',
                () => GLib.file_get_contents(configPath)
            ) || [])
            : [false, null];
        let data = (ok && contents)
            ? tryOrNull(
                'UpdateNotificationView.loadIgnoredVersions.parse',
                () => JSON.parse(new TextDecoder('utf-8').decode(contents))
            )
            : null;
        return Array.isArray(data?.ignored) ? data.ignored : [];
    }

    writeIgnoredVersions() {
        const {configDir, configPath} = this.getIgnoredUpdatesPath();
        GLib.mkdir_with_parents(configDir, parseInt('755', 8));
        const data = JSON.stringify({ignored: this.ignoredVersions}, null, 2);
        GLib.file_set_contents(configPath, data);
    }

    getIgnoredUpdatesPath() {
        const configDir = `${GLib.get_user_config_dir()}/lastlayer`;
        const configPath = `${configDir}/ignored_updates.json`;
        return {configDir, configPath};
    }

    getTranslation(key, defaultText) {
        const result = this.translator ? this.translator(key) : null;
        return (result && result !== key) ? result : (defaultText || key);
    }

    capture() {
        if (!this.banner || !this.isVisible) {
            return null;
        }
        const parent = this.banner.get_parent();
        parent?.remove?.(this.banner);
        return this.updateInfo;
    }

    restore(updateInfo, container) {
        updateInfo && container && !this.isVersionIgnored(updateInfo.version) && this.show(updateInfo, container);
    }
}
