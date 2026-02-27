import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';

class ServerEditViewDialogShortcuts {
    setupKeyboardShortcuts() {
        this.dialog && (() => {
            const accelGroup = new Gtk.AccelGroup();
            this.dialog.add_accel_group(accelGroup);

            const bind = (accel) => {
                const [key, mods] = Gtk.accelerator_parse(accel);
                key && accelGroup.connect(key, mods, Gtk.AccelFlags.VISIBLE, () => {
                    this.applyTestData();
                    return true;
                });
            };

            bind('<Control><Shift>d');
            bind('F9');
        })();
    }
}

export function applyServerEditViewDialogShortcuts(prototype) {
    copyPrototypeDescriptors(prototype, ServerEditViewDialogShortcuts.prototype);
}
