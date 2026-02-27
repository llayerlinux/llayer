import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk';

export function applyHyprlandOverridePopupHotkeysMenuKeyEntry(prototype) {
    prototype.setKeyEntryCaptureMode = function(entry, enabled) {
        entry._captureMode = !!enabled;
        const icon = enabled ? 'input-keyboard-symbolic' : 'document-edit-symbolic';
        entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, icon);
        entry.set_tooltip_text(
            enabled
                ? (this.t('MENU_HOTKEY_CAPTURE_TOOLTIP') || 'Capture mode: press keys to set combo')
                : (this.t('MENU_HOTKEY_TEXT_TOOLTIP') || 'Text mode: edit key combo manually')
        );
    };

    prototype.buildMenuKeyEntry = function(item, keyText, onChange) {
        const entry = new Gtk.Entry({
            text: keyText || '',
            width_chars: 16
        });
        entry.get_style_context().add_class('hotkey-key-combo');
        entry.get_style_context().add_class('menu-override-label');
        entry.set_placeholder_text(this.t('MENU_HOTKEY_KEY_PLACEHOLDER') || 'Super + R');
        this.setKeyEntryCaptureMode(entry, false);

        entry.connect('icon-press', () => {
            this.setKeyEntryCaptureMode(entry, !entry._captureMode);
        });

        entry.connect('key-press-event', (_widget, event) => {
            const [ok, keyval] = event.get_keyval();
            switch (true) {
            case !entry._captureMode:
                return false;
            case !ok:
                return true;
            default:
                break;
            }
            const keyName = Gdk.keyval_name(keyval);
            const state = event.get_state ? (event.get_state()[1] ?? event.get_state()) : 0;
            const mods = [];
            [
                [Gdk.ModifierType.SUPER_MASK, 'SUPER'],
                [Gdk.ModifierType.SHIFT_MASK, 'SHIFT'],
                [Gdk.ModifierType.CONTROL_MASK, 'CTRL'],
                [Gdk.ModifierType.MOD1_MASK, 'ALT']
            ].forEach(([mask, label]) => (state & mask) && mods.push(label));
            const display = this.formatKeyComboFromParts(mods, keyName);
            entry.set_text(display);
            entry._parsedKey = { modifiers: mods, key: keyName };
            onChange?.(entry._parsedKey);
            return true;
        });

        entry.connect('changed', () => {
            const parsed = this.parseKeyComboText(entry.get_text());
            switch (true) {
            case entry._captureMode:
                return;
            case !parsed:
                entry.get_style_context().add_class('error');
                return;
            default:
                break;
            }
            entry.get_style_context().remove_class('error');
            entry._parsedKey = parsed;
            onChange?.(parsed);
        });

        return entry;
    };
}
