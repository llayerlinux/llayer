import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { Commands } from '../../../../infrastructure/constants/Commands.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

class ThemeContextMenuViewActionsStatsMisc {
    runInCurrentMenuSession(sessionId, callback) {
        this.popup && sessionId === this.menuSessionId && callback();
    }

    determineMenuPosition(triggerWidget, event = null) {
        const pos = event?.get_root_coords?.();
        if (pos?.length >= 3) return [pos[1], pos[2] - 4];

        if (!triggerWidget) return null;

        const alloc = triggerWidget.get_allocation(),
              origin = triggerWidget.get_window().get_origin();
        return [origin[1] + alloc.x + alloc.width / 2 - 135, origin[2] + 8];
    }

    updateMenuData(newMenuData) {
        if (!newMenuData || !this.popup) {
            return;
        }

        this.menuData = newMenuData;
        let theme = newMenuData.theme && typeof newMenuData.theme === 'object'
            ? newMenuData.theme
            : {};
        let needsReapply = !newMenuData.isNetwork && theme?.needsReapply;
        this.applyActionButton && (() => {
            const style = this.applyActionButton.get_style_context();
            needsReapply ? style.add_class('apply-needs-reapply') : style.remove_class('apply-needs-reapply');
            this.applyActionButton.set_tooltip_text(needsReapply ? this.translate('REAPPLY_REQUIRED_NOTICE') : null);
        })();
        this.reapplyNoticeLabel && (needsReapply ? this.reapplyNoticeLabel.show() : this.reapplyNoticeLabel.hide());

        this.statsLabels && (() => {
            const stats = this.buildStatsSnapshot(theme);
            const sessionId = this.menuSessionId;
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.runInCurrentMenuSession(sessionId, () => {
                    this.applyStatsToLabels(this.statsLabels, stats);
                });
                return GLib.SOURCE_REMOVE;
            });
        })();

        theme.networkDataLoaded && !newMenuData.isNetwork && this.showViewToggleButton(true, this.menuSessionId);
    }

    showViewToggleButton(show, sessionId = this.menuSessionId) {
        const btn = this.viewToggleButton;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.runInCurrentMenuSession(sessionId, () => {
                tryOrNull('showViewToggleButton', () => {
                    show ? (btn.set_visible(true), btn.show()) : (btn.set_visible(false), btn.hide());
                });
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    setLocalThemeAvailable(available) {
        this.localThemeAvailable = available;
        available && this.menuData?.isNetwork && this.showViewToggleButton(true);
    }

    copyToClipboard(text) {
        GLib.spawn_command_line_async(
            GLib.getenv('XDG_SESSION_TYPE') === 'wayland'
                ? `echo -n "${text}" | wl-copy`
                : `echo -n "${text}" | xclip -selection clipboard`
        );

        this.controller?.container?.get?.('settingsManager')?.get?.('flyDisableExternalNotifications') !== true && (() => {
            const copiedTitle = this.translate('URL_COPIED').replace(/\"/g, '\\"'),
                  snippet = `${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`.replace(/\"/g, '\\"');
            GLib.spawn_command_line_async(`${Commands.NOTIFY_SEND} -a \"LastLayer\" \"${copiedTitle}\" \"${snippet}\"`);
        })();
    }

    positionMenu(triggerWidget, event = null) {
        let coords = this.determineMenuPosition(triggerWidget, event);
        if (!coords) {
            this.popup.set_position(Gtk.WindowPosition.CENTER);
            return;
        }

        const screen = Gdk.Screen.get_default(),
              [mw, mh] = this.popup.get_size(),
              clamp = (val, max, dim) => Math.max(10, Math.min(val, max - (dim || 320) - 10));
        this.popup.move(
            clamp(coords[0], screen.get_width(), mw),
            clamp(coords[1], screen.get_height(), mh || 580)
        );
    }
}

export function applyThemeContextMenuViewActionsStatsMisc(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewActionsStatsMisc.prototype);
}
