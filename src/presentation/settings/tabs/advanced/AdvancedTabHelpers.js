import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';

export function applyAdvancedTabHelpers(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AdvancedTabHelpers.prototype);
}

class AdvancedTabHelpers {
    guardStoreUpdate(handler) {
        return (...args) => (this.view?.updatingFromStore ? undefined : handler(...args));
    }

    createCheckbox(labelKey, active, sensitive = true) {
        const check = new Gtk.CheckButton({
            label: this.t(labelKey),
            active: active || false
        });
        check.set_sensitive(sensitive);
        return check;
    }

    addSeparator(box, margin = 12) {
        const sep = this.styleSeparator(new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL
        }));
        sep.set_margin_top(margin);
        sep.set_margin_bottom(margin);
        box.pack_start(sep, false, false, 0);
    }

    updateBarCombo(combo, settingsKey) {
        if (!combo) {
            return;
        }
        const current = combo.get_active_id();
        combo.remove_all();
        combo.append('none', this.t('NONE'));
        this.BarRegistry.getIds().forEach(bar => combo.append(bar, bar));
        combo.set_active_id(current || this.settings[settingsKey] || 'none');
    }

    refreshBarCombos() {
        if (this.BarRegistry) {
            this.updateBarCombo(this.widgets.altBarCombo, 'alt_bar');
            this.updateBarCombo(this.widgets.defaultBarCombo, 'default_theme_bar');
            return;
        }
        return;
    }
}
