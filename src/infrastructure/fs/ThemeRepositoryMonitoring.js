import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { TIMEOUTS } from '../constants/Timeouts.js';

class ThemeRepositoryMonitoring {
    setupDirectoryMonitoring() {
        const themesDir = Gio.File.new_for_path(this.basePath);
        !themesDir.query_exists(null) && themesDir.make_directory_with_parents(null);

        this.dirMonitor = themesDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this.dirMonitor.connect('changed', (_monitor, _file, _otherFile, _eventType) => {
            this.debounceTimer && GLib.source_remove(this.debounceTimer);

            this.debounceTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.DEBOUNCE_MS, () => {
                this.invalidateCache();
                this.monitorCallbacks.forEach(callback => {
                    callback();
                });
                this.debounceTimer = null;
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    addMonitorCallback(callback) {
        this.monitorCallbacks.add(callback);
    }

    removeMonitorCallback(callback) {
        this.monitorCallbacks.delete(callback);
    }

    destroy() {
        this.dirMonitor?.cancel();
        this.dirMonitor = null;
        this.debounceTimer && GLib.source_remove(this.debounceTimer);
        this.debounceTimer = null;
        this.monitorCallbacks.clear();
    }
}

export function applyThemeRepositoryMonitoring(prototype) {
    copyPrototypeDescriptors(prototype, ThemeRepositoryMonitoring.prototype);
}
