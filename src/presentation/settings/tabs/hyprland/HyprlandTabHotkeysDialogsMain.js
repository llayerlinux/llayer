import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from '../../../common/ViewUtils.js';

class HyprlandTabHotkeysDialogsMain {
    buildHotkeyDialogActionBox(dialog, onSave) {
        const actionBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
            margin_top: 12
        });

        const cancelBtn = new Gtk.Button({
            label: this.t('CANCEL') || 'Cancel'
        });
        addPointerCursor(cancelBtn);
        cancelBtn.connect('clicked', () => dialog.destroy());
        actionBox.pack_start(cancelBtn, false, false, 0);

        const saveBtn = new Gtk.Button({
            label: this.t('SAVE') || 'Save'
        });
        saveBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(saveBtn);
        saveBtn.connect('clicked', () => onSave?.());
        actionBox.pack_start(saveBtn, false, false, 0);

        return actionBox;
    }

    showHotkeyOverridesDialog() {
        const existingDialog = this.hotkeyOverridesDialog;
        return existingDialog
            ? existingDialog.present?.()
            : (() => {
                const proto = Object.getPrototypeOf(this);
                proto._hotkeyRowCssLoaded ||= true;

                const dialog = new Gtk.Dialog({
                    title: '',
                    modal: true,
                    resizable: true,
                    decorated: false
                });

                applyOptionalSetters([[this.parentWindow, (window) => dialog.set_transient_for?.(window), Boolean]]);

                dialog.get_style_context().add_class('hotkey-overrides-dialog');
                dialog.set_default_size(580, 480);

                const content = dialog.get_content_area();
                content.set_margin_top(16);
                content.set_margin_bottom(16);
                content.set_margin_start(20);
                content.set_margin_end(20);
                content.set_spacing(10);

                const headerBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 10
                });

                const title = new Gtk.Label({
                    label: this.t('HOTKEY_OVERRIDES_TITLE') || 'Global Hotkey Overrides',
                    halign: Gtk.Align.START
                });
                title.get_style_context().add_class('title-4');
                headerBox.pack_start(title, false, false, 0);

                const addBtn = this.createIconButton(
                    'list-add-symbolic',
                    this.t('ADD_HOTKEY') || 'Add Hotkey',
                    ['suggested-action']
                );
                addBtn.connect('clicked', () => this.showAddHotkeyDialog(dialog));
                headerBox.pack_start(addBtn, false, false, 0);

                headerBox.pack_start(new Gtk.Box(), true, true, 0);

                const helpBtn = this.createIconButton(
                    'help-about-symbolic',
                    this.t('HOTKEYS_HELP') || 'Help',
                    ['flat']
                );
                helpBtn.connect('clicked', () => this.showGlobalHotkeysHelpPopup(helpBtn));
                headerBox.pack_end(helpBtn, false, false, 0);

                content.pack_start(headerBox, false, false, 0);

                const desc = this.createDimLabel(
                    this.t('HOTKEY_OVERRIDES_DESC') || 'Hotkeys applied after any theme\'s keybindings.'
                );
                content.pack_start(desc, false, false, 0);

                content.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }), false, false, 0);

                const scrolled = new Gtk.ScrolledWindow({
                    hscrollbar_policy: Gtk.PolicyType.NEVER,
                    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                    min_content_height: 280
                });

                this.hotkeyListBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 6
                });

                scrolled.add(this.hotkeyListBox);
                content.pack_start(scrolled, true, true, 0);

                this.loadGlobalHotkeyOverrides();

                const actionBox = this.buildHotkeyDialogActionBox(dialog, () => {
                    this.saveGlobalHotkeyOverrides();
                    dialog.destroy();
                });
                content.pack_start(actionBox, false, false, 0);

                dialog.connect('destroy', () => {
                    this.hotkeyOverridesDialog = null;
                    this.hotkeyListBox = null;
                });

                this.hotkeyOverridesDialog = dialog;
                dialog.show_all();
                return undefined;
            })();
    }
}

export function applyHyprlandTabHotkeysDialogsMain(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandTabHotkeysDialogsMain.prototype);
}
