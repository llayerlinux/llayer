import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { setupPointerCursors } from '../../common/ViewUtils.js';

class ThemeContextMenuViewPopupWindow {
    async showMenu(menuData, triggerWidget, event = null) {
        this.menuData = menuData;
        this.menuSessionId = (this.menuSessionId || 0) + 1;

        this.t = typeof this.t === 'function' ? this.t : (key) => key;

        this.popup?.destroy?.();
        this.popup = null;

        this.createPopupWindow();
        this.createContent();

        this.popup.set_visible(true);
        this.popup.show_all();
        setupPointerCursors(this.popup);
        this.positionMenu(triggerWidget, event);
        this.popup.present();

        const win = this.popup.get_window();
        win?.show();
        win?.raise();

        this.popup.grab_focus();
        this.isVisible = true;
        this.isMenuOpened = true;
    }

    hideMenu() {
        this.popup?.hide?.();
        this.popup?.destroy?.();
        this.popup = null;
        this.isVisible = false;
        this.isMenuOpened = false;
    }

    createPopupWindow() {
        this.popup = new Gtk.Window({
            type: Gtk.WindowType.TOPLEVEL,
            decorated: false,
            resizable: false,
            modal: false,
            skip_taskbar_hint: true,
            skip_pager_hint: true,
            default_width: 320,
            default_height: 580
        });

        this.popup.set_keep_above(true);
        this.popup.set_name('theme-context-menu');

        const style = this.popup.get_style_context();
        style.add_class('theme-context-menu');

        const currentDir = GLib.get_current_dir();
        const cssPath = GLib.build_filenamev([currentDir, 'styles', 'style.css']);
        const cssFile = Gio.File.new_for_path(cssPath);

        cssFile.query_exists(null) && (() => {
            const originalCssProvider = new Gtk.CssProvider();
            originalCssProvider.load_from_path(cssPath);
            this.popup.get_style_context().add_provider(
                originalCssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1
            );
        })();

        const viewFromContainer = this.controller?.container?.get?.('themeSelectorView');
        const cssProvider = viewFromContainer?.cssProvider;
        cssProvider && (
            this.popup.get_style_context().add_provider(
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            )
        );

        this.popup.connect('key-press-event', (widget, ev) => {
            const keyval = ev.get_keyval();
            const keyName = Gdk.keyval_name(keyval[1]);
            if (keyName === 'Escape') {
                this.popup.hide();
                this.isMenuOpened = false;
                return true;
            }
            return false;
        });

        this.popup.connect('hide', () => {
            this.isMenuOpened = false;
        });
    }

    createContent() {
        const inner = this.createInnerContent();
        const content = this.wrapScrollableContent(inner, this.shouldUseScroll());

        const mainBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        mainBox.pack_start(this.createClickCloseRegion(), false, false, 0);
        mainBox.pack_start(content, true, true, 0);

        this.popup.add(mainBox);
    }

    createClickCloseRegion() {
        const eb = new Gtk.EventBox();
        eb.set_hexpand(true);
        eb.set_vexpand(true);
        eb.connect('button-press-event', () => {
            this.popup.hide();
            return true;
        });

        const box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        box.pack_start(eb, true, true, 0);
        return box;
    }

    createInnerContent() {
        const inner = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8});
        inner.get_style_context().add_class('theme-context-menu');

        inner.pack_start(this.createHeader(), false, false, 0);
        inner.pack_start(this.createRepositoryBox(), false, false, 0);
        inner.pack_start(this.createAuthorsBox(), false, false, 0);
        const publishedSection = this.createPublishedSection();
        this.packIf(inner, publishedSection, false, true, 0, (section) => {
            section.set_hexpand(true);
            section.set_halign(Gtk.Align.FILL);
        });
        const propertiesSection = this.createPropertiesSection();
        this.packIf(inner, propertiesSection, false, false, 0);

        inner.pack_start(this.createInstallScriptsSection(), false, false, 0);
        inner.pack_start(this.createActionsSection(), false, false, 0);

        return inner;
    }
}

export function applyThemeContextMenuViewPopupWindow(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPopupWindow.prototype);
}
