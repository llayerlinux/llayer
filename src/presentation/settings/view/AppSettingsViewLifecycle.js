import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';

export function applyAppSettingsViewLifecycle(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AppSettingsViewLifecycle.prototype);
}

class AppSettingsViewLifecycle {
    t(key, params = null) {
        return this.translate ? this.translate(key, params) : key;
    }

    present() {
        this.dialog && (
            this.dialog.show_all(),
            this.dialog.present(),
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => (
                this.dialog && this.sections.themeApps?.refresh?.(),
                GLib.SOURCE_REMOVE
            ))
        );
    }

    close() {
        this.eventBindings.cleanup();
        this.dialog?.destroy?.();
        this.resetViewState();
    }

    resetViewState() {
        this.dialog = null;
        this.widgets = {};
        this.tabs = {};
        this.sections = {};
    }
}
