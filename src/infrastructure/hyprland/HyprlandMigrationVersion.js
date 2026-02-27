import GLib from 'gi://GLib';
import { tryOrNull } from '../utils/ErrorUtils.js';

export function applyHyprlandMigrationVersion(targetPrototype) {
    targetPrototype.detectUserVersion = function() {
        if (this._cachedVersion) return this._cachedVersion;

        const result = tryOrNull('HyprlandMigrationVersion.detectUserVersion.read', () =>
            GLib.spawn_command_line_sync('hyprctl version -j')
        ),
            [ok, stdout] = result || [],
            data = (ok && stdout)
                ? tryOrNull('HyprlandMigrationVersion.detectUserVersion.parse', () =>
                    JSON.parse(new TextDecoder().decode(stdout))
                )
                : null;

        this._cachedVersion = data ? (data.version || 'unknown') : 'unknown';
        return this._cachedVersion;
    };
}
