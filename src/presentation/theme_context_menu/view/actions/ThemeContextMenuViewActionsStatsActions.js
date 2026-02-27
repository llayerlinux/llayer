import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { addPointerCursor } from '../../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';

class ThemeContextMenuViewActionsStatsActions {
    buildActionContent(iconName, labelText, iconSize = 16) {
        const content = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.CENTER
        });

        const icon = new Gtk.Image({
            icon_name: iconName,
            icon_size: Gtk.IconSize.BUTTON
        });
        icon.set_pixel_size(iconSize);
        icon.get_style_context().add_class('action-button-icon');

        const label = new Gtk.Label({label: labelText});
        content.pack_start(icon, false, false, 0);
        content.pack_start(label, false, false, 0);
        return content;
    }

    applyPointerCursor(widget) {
        addPointerCursor(widget);
    }

    setButtonContent(button, iconName, labelText, iconSize) {
        const child = button.get_child?.();
        child && button.remove(child);
        const content = this.buildActionContent(iconName, labelText, iconSize);
        button.add(content);
        return content;
    }

    createApplyButton(styleClass, iconSize) {
        const btn = new Gtk.Button();
        this.setButtonContent(btn, 'media-playback-start-symbolic', this.translate('APPLY_THEME'), iconSize);
        btn.get_style_context().add_class(styleClass);
        this.applyActionButton = btn;
        const needsReapply = !this.menuData?.isNetwork && this.menuData?.theme?.needsReapply;
        needsReapply && (btn.get_style_context().add_class('apply-needs-reapply'), btn.set_tooltip_text(this.translate('REAPPLY_REQUIRED_NOTICE')));
        this.applyPointerCursor(btn);
        btn.connect('clicked', () => {
            this.controller?.applyTheme?.().finally(() => { this.isMenuOpened = false; });
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_LONG_MS, () => {
                this.isVisible && this.hideMenu();
                return false;
            });
            return true;
        });
        return btn;
    }

    createDeleteButtonWithProgress(iconSize) {
        const deleteBtn = new Gtk.Button();
        deleteBtn.get_style_context().add_class('destructive-action');
        this.applyPointerCursor(deleteBtn);

        const deleteLabel = this.translate('DELETE');
        const deleteContent = this.buildActionContent('user-trash-symbolic', deleteLabel, iconSize);
        const deleteProgress = new Gtk.ProgressBar({
            width_request: 120, height_request: 6, hexpand: false, vexpand: false
        });
        deleteProgress.set_show_text(false);
        deleteProgress.set_no_show_all(true);
        deleteProgress.hide();

        const setDeleteProgress = (on) => {
            const child = deleteBtn.get_child && deleteBtn.get_child();
            child && deleteBtn.remove(child);
            on
                ? (
                    deleteBtn.set_sensitive(false),
                    deleteBtn.add(deleteProgress),
                    deleteProgress.show(),
                    deleteBtn._pulseTimer && GLib.source_remove(deleteBtn._pulseTimer),
                    deleteBtn._pulseTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
                        deleteProgress.pulse();
                        return GLib.SOURCE_CONTINUE;
                    })
                )
                : (
                    deleteBtn._pulseTimer && GLib.source_remove(deleteBtn._pulseTimer),
                    deleteBtn._pulseTimer = null,
                    deleteBtn.set_sensitive(true),
                    deleteBtn.add(deleteContent),
                    deleteContent.show_all(),
                    deleteProgress.hide()
                );
            deleteBtn.show_all();
        };

        deleteBtn.add(deleteContent);

        deleteBtn.connect('clicked', () => {
            const deleteTheme = this.controller?.deleteTheme;
            deleteTheme && (() => {
                const deleteResult = deleteTheme.call(this.controller, {
                    onProgress: (status) => {
                        switch (status) {
                            case 'start':
                                setDeleteProgress(true);
                                break;
                            case 'complete':
                                setDeleteProgress(false);
                                break;
                            default:
                                break;
                        }
                    }
                });
                deleteResult?.then
                    ? deleteResult.then(() => this.isMenuOpened && (this.isMenuOpened = false))
                    : (this.isMenuOpened && (this.isMenuOpened = false));
            })();
        });

        return deleteBtn;
    }

    createActionsSection() {
        const actionsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
        actionsBox.get_style_context().add_class('actions-box');
        this.applyActionButton = null;
        this.reapplyNoticeLabel = null;

        const theme = this.menuData.theme;
        const isNetwork = this.menuData.isNetwork;
        const needsReapply = !isNetwork && theme?.needsReapply;
        const iconSize = isNetwork ? 14 : 16;
        const buttons = [];

        isNetwork
            ? (() => {
            const editBtn = new Gtk.Button();
            this.setButtonContent(editBtn, 'document-edit-symbolic', this.translate('THEME_CONTEXT_EDIT_ON_SERVER'), iconSize);
            editBtn.get_style_context().add_class('suggested-action');
            this.applyPointerCursor(editBtn);
            editBtn.connect('clicked', () => this.controller?.editOnServer?.());
            buttons.push(editBtn);

            const localThemePath = this.getLocalThemePath(theme);
            const localThemeDir = localThemePath ? Gio.File.new_for_path(localThemePath) : null;
            (!localThemeDir || !localThemeDir.query_exists(null))
                ? (() => {
                    const installBtn = new Gtk.Button();
                    this.setButtonContent(installBtn, 'go-down-symbolic', this.translate('DOWNLOAD'), iconSize);
                    installBtn.get_style_context().add_class('install-btn');
                    this.applyPointerCursor(installBtn);
                    installBtn.connect('clicked', () => this.controller?.installTheme?.());
                    buttons.push(installBtn);
                })()
                : buttons.push(this.createApplyButton('apply_rice-btn-network', iconSize));
            })()
            : (buttons.push(this.createDeleteButtonWithProgress(iconSize)), buttons.push(this.createApplyButton('apply_rice-btn-installed', iconSize)));

        const actionsRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
        actionsRow.set_hexpand(true);
        actionsRow.get_style_context().add_class('actions-row');
        actionsRow.get_style_context().add_class(isNetwork ? 'actions-row--network' : 'actions-row--local');

        buttons.forEach((btn) => {
            btn.set_hexpand(true);
            btn.set_halign(Gtk.Align.FILL);
            btn.get_style_context().add_class('actions-row-button');
            actionsRow.pack_start(btn, true, true, 0);
        });

        actionsBox.pack_start(actionsRow, false, false, 0);

        !isNetwork && (() => {
            const notice = new Gtk.Label({
                label: this.translate('REAPPLY_REQUIRED_NOTICE'),
                halign: Gtk.Align.START,
                xalign: 0,
                wrap: true
            });
            notice.get_style_context().add_class('reapply-notice-label');
            notice.set_no_show_all(true);
            needsReapply ? notice.show() : notice.hide();
            actionsBox.pack_start(notice, false, false, 0);
            this.reapplyNoticeLabel = notice;
        })();
        return actionsBox;
    }
}

export function applyThemeContextMenuViewActionsStatsActions(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewActionsStatsActions.prototype);
}
