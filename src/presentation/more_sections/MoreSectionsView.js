import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import * as VIEW_UTILS from '../common/ViewUtils.js';

export class MoreSectionsView {
    constructor(controller, logger = null) {
        this.controller = controller;
        this.logger = logger;
        this.gridBox = null;
        this.rootWidget = null;
        this.currentDir = controller.container.get('currentDir');
        this.soundService = controller.soundService;
    }

    setController(controller) {
        this.controller = controller;
    }

    createContent() {
        this.rootWidget ||= (() => {
            const innerBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                hexpand: true,
                vexpand: true,
                halign: Gtk.Align.FILL,
                valign: Gtk.Align.START,
                margin_top: 0,
                margin_bottom: 12,
                margin_start: 2,
                margin_end: 2,
                spacing: 10
            });

            this.gridBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                hexpand: true,
                vexpand: true,
                halign: Gtk.Align.FILL,
                valign: Gtk.Align.START,
                spacing: 4
            });

            innerBox.pack_start(this.gridBox, true, true, 0);
            return innerBox;
        })();

        this.populateSections();
        return this.rootWidget;
    }

    getSectionDefinitions(t) {
        return [
            {
                name: t('FIX_HYPRLAND_SECTION', 'Fix Hyprland'),
                preview: `${this.currentDir}/assets/fix_hyperland.png`,
                description: t('FIX_HYPRLAND_SECTION_DESC'),
                type: 'fix-hyprland'
            },
            {
                name: t('CONTEST_SECTION_NAME', 'Contest'),
                preview: `${this.currentDir}/assets/kingsOfRices.png`,
                description: t('CONTEST_SECTION_DESC'),
                badge: `${this.currentDir}/assets/dev.png`,
                type: 'contest'
            },
            {
                name: t('DEV_SECTION_NAME', 'Dev Tools'),
                preview: `${this.currentDir}/assets/dynamic_ai.png`,
                description: t('DEV_SECTION_DESC'),
                badge: `${this.currentDir}/assets/dev.png`,
                type: 'dev'
            },
            {
                name: t('CLI_SECTION_NAME', 'CLI'),
                preview: `${this.currentDir}/assets/cli.png`,
                description: t('CLI_SECTION_DESC'),
                badge: `${this.currentDir}/assets/dev.png`,
                type: 'cli'
            },
            {
                name: t('GRUB_SECTION_NAME', 'GRUB'),
                preview: `${this.currentDir}/assets/grub.png`,
                description: t('GRUB_SECTION_DESC'),
                badge: `${this.currentDir}/assets/dev.png`,
                type: 'grub'
            },
            {
                name: t('REFIND_SECTION_NAME', 'rEFInd'),
                preview: `${this.currentDir}/assets/refind.png`,
                description: t('REFIND_SECTION_DESC'),
                badge: `${this.currentDir}/assets/dev.png`,
                type: 'refind'
            },
            {
                name: t('LOGIN_RICES_SECTION_NAME', 'Login Rices'),
                preview: `${this.currentDir}/assets/login_rices.png`,
                description: t('LOGIN_RICES_SECTION_DESC'),
                badge: `${this.currentDir}/assets/dev.png`,
                type: 'login-rices'
            }
        ];
    }

    createGridRow(items) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_end: 12,
            hexpand: true,
            halign: Gtk.Align.CENTER
        });
        row.get_style_context().add_class('my-theme-selector-grid-row');
        row.get_style_context().add_class('more-sections-row');
        items.forEach(item => row.pack_start(item, false, false, 0));
        return row;
    }

    clearContainer(container) {
        (container.get_children?.() ?? []).forEach(child => container.remove(child));
    }

    populateSections() {
        const t = (key, fb = null) => this.getTranslation(key, fb ?? key),
            items = this.getSectionDefinitions(t).map(section => this.createSectionItem(section)),
            rows = [];
        for (let i = 0; i < items.length; i += 2) {
            rows.push(this.createGridRow(items.slice(i, i + 2)));
        }

        this.clearContainer(this.gridBox);
        rows.forEach(r => this.gridBox.pack_start(r, false, false, 0));
        this.gridBox.show_all();
    }

    createSectionItem(section) {
        const container = new Gtk.EventBox({
            width_request: 170,
            height_request: 180,
            hexpand: false,
            vexpand: false
        });
        container.get_style_context().add_class('my-section-item-box');

        container.connect('enter-notify-event', () => {
            container.get_style_context().add_class('hover');
            const win = container.get_window();
            win?.set_cursor(Gdk.Cursor.new_from_name(win.get_display(), 'pointer'));
            this.soundService?.playButtonHoverSound?.()?.catch?.(() => {});
            return false;
        });

        container.connect('leave-notify-event', () => {
            container.get_style_context().remove_class('hover');
            container.get_window()?.set_cursor(null);
            return false;
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4
        });

        const icon = this.createSectionIcon(section);

        const iconWidget = section.badge
            ? (() => {
                const badgeIcon = this.createBadgeIcon(section.badge);
                const overlay = new Gtk.Overlay();
                overlay.add(icon);
                overlay.add_overlay(badgeIcon);
                overlay.set_overlay_pass_through(badgeIcon, true);
                return overlay;
            })()
            : icon;
        box.pack_start(iconWidget, true, true, 0);

        container.add(box);

        container.connect('button-release-event', () => {
            this.handleSectionClick(section);
            return true;
        });

        return container;
    }

    createSectionIcon(section) {
        const image = new Gtk.Image();
        image.set_halign(Gtk.Align.CENTER);
        image.set_valign(Gtk.Align.CENTER);
        image.get_style_context().add_class('section-icon');
        image.set_hexpand(true);
        image.set_vexpand(true);

        const rounded = Gio.File.new_for_path(section.preview).query_exists(null) && VIEW_UTILS?.makeRoundedPixbuf?.(section.preview, 172, 20);
        rounded ? image.set_from_pixbuf(rounded) : image.set_from_icon_name('applications-graphics-symbolic', Gtk.IconSize.LARGE_TOOLBAR);
        return image;
    }

    createBadgeIcon(badgePath) {
        const badgeIcon = new Gtk.Image();
        badgeIcon.get_style_context().add_class('section-badge-3d');
        badgeIcon.set_halign(Gtk.Align.END);
        badgeIcon.set_valign(Gtk.Align.START);
        badgeIcon.set_margin_end(0);
        badgeIcon.set_margin_top(6);

        const badgePixbuf = Gio.File.new_for_path(badgePath).query_exists(null) && VIEW_UTILS?.makeRoundedPixbuf?.(badgePath, 48, 8);
        badgePixbuf ? badgeIcon.set_from_pixbuf(badgePixbuf) : badgeIcon.set_from_icon_name('emblem-new-symbolic', Gtk.IconSize.BUTTON);
        return badgeIcon;
    }

    handleSectionClick(section) {
        this.controller.handleSectionClick(section);
    }

    getTranslation(key, defaultText = key) {
        const value = (this.controller.translator || (k => k))(key);
        return typeof value === 'string' && value !== key ? value : defaultText;
    }

    refresh() {
        this.createContent();
    }

    show() {
        this.rootWidget?.show_all?.();
    }

    hide() {
        this.rootWidget?.hide?.();
    }

    destroy() {
        [this.gridBox, this.rootWidget].forEach(w => w?.destroy?.());
        this.gridBox = this.rootWidget = this.controller = this.logger = null;
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('MoreSectionsView', message, data);
    }
}
