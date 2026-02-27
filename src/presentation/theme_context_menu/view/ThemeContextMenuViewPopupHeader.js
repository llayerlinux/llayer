import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { addPointerCursor } from '../../common/ViewUtils.js';

class ThemeContextMenuViewPopupHeader {
    createHeader() {
        let closeBtn = new Gtk.Button();
        let closeIcon = new Gtk.Image();
        closeIcon.set_from_icon_name('window-close-symbolic', Gtk.IconSize.BUTTON);
        closeIcon.set_size_request(16, 16);
        closeBtn.set_image(closeIcon);
        closeBtn.get_style_context().add_class('menu-close-btn');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => {
            this.popup.hide();
            this.isMenuOpened = false;
        });

        let title = new Gtk.Label({label: this.translate('THEME_CONTEXT_REPO_TITLE'), xalign: 0});
        title.get_style_context().add_class('repo-title');

        const isNetwork = this.menuData?.isNetwork;
        const themeName = this.menuData?.theme?.name || null;
        const toggleBtn = new Gtk.Button();
        const toggleIcon = new Gtk.Image();
        const toggleConfig = isNetwork
            ? {icon: 'folder-symbolic', tooltip: this.translate('SWITCH_TO_LOCAL_VIEW')}
            : {icon: 'network-server-symbolic', tooltip: this.translate('SWITCH_TO_NETWORK_VIEW')};
        toggleIcon.set_from_icon_name(toggleConfig.icon, Gtk.IconSize.BUTTON);
        toggleBtn.set_tooltip_text(toggleConfig.tooltip);

        toggleIcon.set_size_request(16, 16);
        toggleBtn.set_image(toggleIcon);
        toggleBtn.get_style_context().add_class('view-toggle-btn');
        toggleBtn.get_style_context().add_class('flat');
        toggleBtn.set_no_show_all(true);
        addPointerCursor(toggleBtn);

        toggleBtn.connect('clicked', () => {
            this.controller?.toggleViewMode?.();
        });

        this.viewToggleButton = toggleBtn;

        const overrideBtn = new Gtk.Button();
        const overrideIcon = new Gtk.Image();
        overrideIcon.set_from_icon_name('preferences-system-symbolic', Gtk.IconSize.BUTTON);
        overrideIcon.set_size_request(16, 16);
        overrideBtn.set_image(overrideIcon);
        overrideBtn.get_style_context().add_class('view-toggle-btn');
        overrideBtn.get_style_context().add_class('flat');
        overrideBtn.set_tooltip_text(this.translate('HYPRLAND_PARAMS_TOOLTIP') || 'Hyprland parameter overrides');
        overrideBtn.set_no_show_all(true);
        addPointerCursor(overrideBtn);

        overrideBtn.connect('clicked', () => {
            this.controller?.showHyprlandOverrides?.();
        });

        this.hyprlandOverrideButton = overrideBtn;

        const spacer = new Gtk.Box({hexpand: true});

        const header = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        header.pack_start(title, false, false, 0);
        header.pack_start(spacer, true, true, 0);
        header.pack_start(overrideBtn, false, false, 0);
        header.pack_start(toggleBtn, false, false, 0);
        header.pack_start(closeBtn, false, false, 0);

        const basePath = this.controller?.themeRepository?.basePath || `${GLib.get_home_dir()}/.config/themes`;
        const localExists = Boolean(themeName) && Gio.File.new_for_path(`${basePath}/${themeName}`).query_exists(null);
        const shouldShowSwitchers = !isNetwork || !themeName || localExists;
        (shouldShowSwitchers ? toggleBtn.show : toggleBtn.hide).call(toggleBtn);
        (shouldShowSwitchers ? overrideBtn.show : overrideBtn.hide).call(overrideBtn);
        return header;
    }
}

export function applyThemeContextMenuViewPopupHeader(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPopupHeader.prototype);
}
