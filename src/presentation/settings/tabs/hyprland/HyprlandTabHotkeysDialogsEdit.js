import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { applyOptionalSetters } from '../../../common/ViewUtils.js';
import { HOTKEY_DISPATCHERS } from './HyprlandTabHotkeysDialogsConstants.js';

class HyprlandTabHotkeysDialogsEdit {
    showEditHotkeyDialog(id, override) {
        const dialog = new Gtk.Dialog({
            title: this.t('EDIT_HOTKEY_TITLE') || 'Edit Hotkey Override',
            modal: true,
            resizable: false
        });

        applyOptionalSetters([[this.hotkeyOverridesDialog, (window) => dialog.set_transient_for?.(window), Boolean]]);

        dialog.set_default_size(450, -1);

        const content = dialog.get_content_area();
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(16);
        content.set_margin_end(16);
        content.set_spacing(12);

        const keyComboBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const keyLabel = new Gtk.Label({
            label: this.t('HOTKEY') || 'Hotkey:',
            halign: Gtk.Align.START,
            width_chars: 12
        });
        keyComboBox.pack_start(keyLabel, false, false, 0);

        const keyComboDisplay = new Gtk.Label({
            label: this.formatKeyComboFromOverride(override),
            halign: Gtk.Align.START
        });
        keyComboDisplay.get_style_context().add_class('hotkey-key-combo');
        keyComboBox.pack_start(keyComboDisplay, true, true, 0);

        content.pack_start(keyComboBox, false, false, 0);

        const dispatcherBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const dispatcherLabel = new Gtk.Label({
            label: this.t('DISPATCHER') || 'Dispatcher:',
            halign: Gtk.Align.START,
            width_chars: 12
        });
        dispatcherBox.pack_start(dispatcherLabel, false, false, 0);

        const dispatcherCombo = new Gtk.ComboBoxText();
        HOTKEY_DISPATCHERS.forEach((d) => dispatcherCombo.append_text(d));
        dispatcherCombo.set_active(Math.max(0, HOTKEY_DISPATCHERS.indexOf(override.dispatcher)));
        dispatcherBox.pack_start(dispatcherCombo, true, true, 0);

        content.pack_start(dispatcherBox, false, false, 0);

        const argsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        const argsLabel = new Gtk.Label({
            label: this.t('ARGUMENTS') || 'Arguments:',
            halign: Gtk.Align.START,
            width_chars: 12
        });
        argsBox.pack_start(argsLabel, false, false, 0);

        const argsEntry = new Gtk.Entry({
            text: override.args || ''
        });
        argsBox.pack_start(argsEntry, true, true, 0);

        content.pack_start(argsBox, false, false, 0);

        const actionBox = this.buildHotkeyDialogActionBox(dialog, () => {
            this.currentHotkeyOverrides[id] = {
                ...override,
                dispatcher: dispatcherCombo.get_active_text(),
                args: argsEntry.get_text().trim(),
                timestamp: Date.now()
            };
            dialog.destroy();
            this.refreshHotkeyListUI();
        });

        content.pack_start(actionBox, false, false, 0);

        dialog.show_all();
    }
}

export function applyHyprlandTabHotkeysDialogsEdit(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandTabHotkeysDialogsEdit.prototype);
}
