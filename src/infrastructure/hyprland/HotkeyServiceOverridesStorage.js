import GLib from 'gi://GLib';
import { sanitizeHotkeyOverrideMap } from './HotkeyOverrideSanitizer.js';
import { tryRun } from '../utils/ErrorUtils.js';

export function applyHotkeyServiceOverridesStorage(targetPrototype) {
    targetPrototype.getGlobalOverrides = function(settings) {
        let source = [
            this.settingsManager?.readGlobalHotkeys?.(),
            settings?.hotkeyOverrides,
            this.settingsManager?.getAll?.()?.hotkeyOverrides
        ].find((v) => v && typeof v === 'object' && Object.keys(v).length > 0);
        return source ? sanitizeHotkeyOverrideMap(source).overrides : {};
    };

    targetPrototype.getPerRiceOverrides = function(themePath) {
        let readOverridesFile = (path, logMessage, pickParams) => {
            let {data, error} = this.isFile(path) ? this.readJsonFile(path) : {data: null, error: null};
            if (data) return pickParams(data);
            error && this.log(`${logMessage}: ${error.message}`);
            return null;
        };

        let newOverrides = readOverridesFile(
            `${themePath}/per_rice_hotkeys.json`,
            'Error reading per_rice_hotkeys',
            (data) => data.params ?? {}
        );
        if (newOverrides) return sanitizeHotkeyOverrideMap(newOverrides).overrides;

        let legacyOverrides = readOverridesFile(
            `${themePath}/.hotkey-overrides.json`,
            'Error reading legacy hotkey overrides',
            (data) => data.params ?? data.overrides ?? {}
        );
        return sanitizeHotkeyOverrideMap(legacyOverrides || {}).overrides;
    };

    targetPrototype.savePerRiceOverrides = function(themePath, params) {
        let perRiceFile = `${themePath}/per_rice_hotkeys.json`,
            nextParams = sanitizeHotkeyOverrideMap(params).overrides,
            saved = tryRun('HotkeyServiceOverridesStorage.savePerRiceOverrides', () => {
                GLib.file_set_contents(perRiceFile, JSON.stringify({
                    version: 1, params: nextParams, updatedAt: new Date().toISOString()
                }, null, 2));
            });
        !saved && this.log('Error saving per_rice_hotkeys');
        return saved;
    };

    targetPrototype.saveGlobalOverrides = function(params) {
        return this.settingsManager?.writeGlobalHotkeys?.(params) ?? false;
    };
}
