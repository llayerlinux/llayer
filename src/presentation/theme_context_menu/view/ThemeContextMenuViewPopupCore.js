import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { applyParams, standardizeNumber } from '../../../infrastructure/utils/Utils.js';

class ThemeContextMenuViewPopupCore {
    packIf(container, widget, expand = false, fill = false, padding = 0, configure = null) {
        return widget
            ? (configure?.(widget), container.pack_start(widget, expand, fill, padding), true)
            : false;
    }

    translate(key, params = null, defaultText = null) {
        const value = this.t?.(key, params);
        return (typeof value === 'string' && value !== key)
            ? value
            : (defaultText != null ? defaultText : (applyParams?.(key, params) ?? key));
    }

    formatDownloadsCount(count) {
        return String(standardizeNumber?.(count, 0) ?? 0);
    }

    getLocalThemePath(theme = null) {
        let targetTheme = theme || (this.menuData ? this.menuData.theme : null),
            hasTarget = !!(targetTheme && targetTheme.name);
        return hasTarget
            ? (() => {
                let isLocalPath = (value) => typeof value === 'string' && value.length > 0 && !/^https?:/i.test(value);

                let candidates = [
                    targetTheme.path,
                    (!this.menuData?.isNetwork && this.menuData?.repository?.url) || null,
                    targetTheme.repoUrl,
                    this.controller?.themeRepository?.basePath
                        ? `${this.controller.themeRepository.basePath}/${targetTheme.name}`
                        : null,
                    `${GLib.get_home_dir()}/.config/themes/${targetTheme.name}`
                ];

                let localPath = candidates.find((p) => isLocalPath(p));
                return localPath || null;
            })()
            : null;
    }

    shouldUseScroll() {
        const screen = Gdk.Screen.get_default();
        const screenHeight = screen?.get_height() || 1080;
        return screenHeight < 900;
    }

    wrapScrollableContent(inner, useScroll) {
        return useScroll
            ? (() => {
                const scrolled = new Gtk.ScrolledWindow({
                    hscrollbar_policy: Gtk.PolicyType.NEVER,
                    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                    max_content_height: 600
                });
                scrolled.get_style_context().add_class('menu-scroll');
                scrolled.add(inner);
                return scrolled;
            })()
            : inner;
    }
}

export function applyThemeContextMenuViewPopupCore(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPopupCore.prototype);
}
