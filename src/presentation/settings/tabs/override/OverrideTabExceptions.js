import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor} from '../../../common/ViewUtils.js';

export function applyOverrideTabExceptions(prototype) {

    prototype.showExceptionsPopup = function(param) {
        if (!this.themeRepository) return;

        const exceptions = this.themeRepository.getThemesWithParameterOverride(param.fullPath);

        const dialog = new Gtk.Dialog({
            title: `${this.t('EXCEPTIONS_POPUP_TITLE') || 'Parameter Exceptions'}: ${param.name}`,
            modal: true,
            resizable: true,
            default_width: 400,
            default_height: 300
        });

        if (this.parentWindow) {
            dialog.set_transient_for(this.parentWindow);
        }

        dialog.set_keep_above(true);
        dialog.set_type_hint(1);
        dialog.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);

        const closeBtn = dialog.add_button(this.t('CLOSE') || 'Close', Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn);

        const contentArea = dialog.get_content_area();
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);
        contentArea.set_spacing(12);

        const desc = new Gtk.Label({
            label: this.t('EXCEPTIONS_POPUP_DESC') || 'Themes with per-rice override for this parameter:',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        contentArea.pack_start(desc, false, false, 0);

        if (exceptions.length === 0) {
            const noExceptions = new Gtk.Label({
                label: this.t('NO_EXCEPTIONS') || 'No themes have individual overrides for this parameter.',
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            noExceptions.get_style_context().add_class('dim-label');
            contentArea.pack_start(noExceptions, true, true, 0);
        } else {
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
            });

            const listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.NONE
            });

            for (const exception of exceptions) {
                const row = this.buildExceptionRow(exception, param.fullPath, listBox);
                listBox.add(row);
            }

            scrolled.add(listBox);
            contentArea.pack_start(scrolled, true, true, 0);

            const resetAllBtn = new Gtk.Button({
                label: this.t('RESET_ALL_BTN') || 'Reset All',
                halign: Gtk.Align.END
            });
            resetAllBtn.get_style_context().add_class('destructive-action');
            addPointerCursor(resetAllBtn);
            resetAllBtn.connect('clicked', () => {
                this.resetAllExceptions(param.fullPath);
                dialog.destroy();
            });
            contentArea.pack_start(resetAllBtn, false, false, 0);
        }

        dialog.show_all();
        dialog.connect('response', () => dialog.destroy());
    };

    prototype.buildExceptionRow = function(exception, paramPath, listBox) {
        const row = new Gtk.ListBoxRow();

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const nameLabel = new Gtk.Label({
            label: exception.themeTitle || exception.themeName,
            halign: Gtk.Align.START,
            hexpand: true
        });
        box.pack_start(nameLabel, true, true, 0);

        const valueLabel = new Gtk.Label({
            label: String(exception.value),
            halign: Gtk.Align.END
        });
        valueLabel.get_style_context().add_class('dim-label');
        box.pack_start(valueLabel, false, false, 0);

        const resetBtn = new Gtk.Button({
            label: this.t('RESET_BTN') || 'Reset'
        });
        addPointerCursor(resetBtn);
        resetBtn.connect('clicked', () => {
            this.resetSingleException(exception.themeName, paramPath);
            listBox.remove(row);
        });
        box.pack_start(resetBtn, false, false, 0);

        row.add(box);
        return row;
    };

    prototype.resetSingleException = function(themeName, paramPath) {
        if (!this.themeRepository) return;

        const overrides = this.themeRepository.readOverrides(themeName);
        delete overrides[paramPath];
        this.themeRepository.writeOverrides(themeName, overrides);

        this.refreshExceptionButtonCount(paramPath);
    };

    prototype.resetAllExceptions = function(paramPath) {
        if (!this.themeRepository) return;

        const count = this.themeRepository.clearParameterOverrideFromAllThemes(paramPath);
        print(`[OverrideTab] Reset ${count} per-rice overrides for ${paramPath}`);

        this.refreshExceptionButtonCount(paramPath);
    };

    prototype.refreshExceptionButtonCount = function(paramPath) {
        const btn = this.exceptionButtons?.get(paramPath);
        if (btn) {
            this.updateExceptionButtonCount(btn, paramPath);
        }
    };
}
