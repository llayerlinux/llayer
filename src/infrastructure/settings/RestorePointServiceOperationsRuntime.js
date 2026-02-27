import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { BarRegistry } from '../bars/BarRegistry.js';
import { Commands } from '../constants/Commands.js';
import { Events } from '../../app/eventBus.js';
import { tryOrNull } from '../utils/ErrorUtils.js';

export function applyRestorePointServiceOperationsRuntime(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, RestorePointServiceOperationsRuntime.prototype);
}

class RestorePointServiceOperationsRuntime {
    emitRestorePointDisplay(timestamp, emitter = 'RestorePointService') {
        const normalizedTimestamp = typeof timestamp === 'string' ? timestamp.trim() : '';
        this.eventBus?.emit?.(Events.APPSETTINGS_RESTOREPOINT_DISPLAY, {
            timestamp: normalizedTimestamp.length ? normalizedTimestamp : null,
            emitter
        });
    }

    getThemeSelectorSettingsPath() {
        return `${this.prefDir}/theme_selector_settings.json`;
    }

    readThemeSelectorSettings() {
        let path = this.getThemeSelectorSettingsPath();
        let exists = Gio.File.new_for_path(path).query_exists(null);
        let [ok, content] = exists
            ? (tryOrNull('RestorePointService.readThemeSelectorSettings.read', () => GLib.file_get_contents(path)) || [])
            : [];

        return ok && content
            ? (tryOrNull(
                'RestorePointService.readThemeSelectorSettings.parse',
                () => JSON.parse(new TextDecoder('utf-8').decode(content))
            ) || {})
            : {};
    }

    updateThemeSelectorSettings(patch = {}) {
        this.ensureDir(this.prefDir);
        GLib.file_set_contents(
            this.getThemeSelectorSettingsPath(),
            JSON.stringify({...this.readThemeSelectorSettings(), ...patch}, null, 2)
        );
    }

    syncPrimarySettings(patch = {}) {
        const settingsManager = this.settingsService?.settingsManager;
        const canUpdate = Boolean(settingsManager && typeof settingsManager.update === 'function');

        const allowedKeys = ['theme', 'default_theme_bar', 'default_bar_manual', 'default_theme_bar_cmd'];
        const normalizedPatch = {};
        allowedKeys.forEach((key) => {
            patch[key] !== undefined && (normalizedPatch[key] = patch[key]);
        });
        const hasPatch = Object.keys(normalizedPatch).length > 0;

        return canUpdate && hasPatch && (() => {
            try {
                settingsManager.update(normalizedPatch);
                typeof settingsManager.write === 'function'
                    && settingsManager.write(null, {silent: true, force: true});
                return true;
            } catch (_error) {
                return false;
            }
        })();
    }

    ensureCurrentThemeFile(themeName) {
        const path = `${this.prefDir}/current_theme`;
        this.ensureDir(this.prefDir);
        GLib.file_set_contents(
            path,
            (typeof themeName === 'string' && themeName.trim().length) ? themeName.trim() : 'default'
        );
    }

    readCurrentThemeFile() {
        const path = `${this.prefDir}/current_theme`;
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return null;
        const [ok, content] = GLib.file_get_contents(path);
        return ok ? new TextDecoder('utf-8').decode(content).trim() : null;
    }

    detectActiveThemeFromHyprConf() {
        const confPath = `${GLib.get_home_dir()}/.config/hypr/hyprland.conf`;
        if (!GLib.file_test(confPath, GLib.FileTest.EXISTS)) return null;
        try {
            const [ok, raw] = GLib.file_get_contents(confPath);
            return Array.from(
                (ok ? new TextDecoder('utf-8').decode(raw) : '').matchAll(/\.config\/themes\/([^/]+)\//g),
                (match) => match[1]
            ).find((name) =>
                name !== 'default'
                && GLib.file_test(`${GLib.get_home_dir()}/.config/themes/${name}`, GLib.FileTest.IS_DIR)
            ) || null;
        } catch (_) { }
        return null;
    }

    removeFile(path) {
        (path && Gio.File.new_for_path(path).query_exists(null)) && Gio.File.new_for_path(path).delete(null);
    }

    buildBarProbeCommands(bar) {
        return [
            [Commands.PGREP, '-u', GLib.get_user_name(), bar],
            [Commands.PGREP, bar],
            [Commands.BASH, '-c', `ps ax -o comm= | grep -w ${GLib.shell_quote(bar)} | head -n 1`]
        ];
    }

    async hasRunningProcess(commands) {
        for (const cmd of commands) {
            if (await this.tryExec(cmd)) {
                return true;
            }
        }
        return false;
    }

    async detectRunningBar() {
        for (const bar of BarRegistry.getIds()) {
            if (await this.hasRunningProcess(this.buildBarProbeCommands(bar))) {
                return bar;
            }
        }
        return 'none';
    }

    async tryExec(argv) {
        try {
            let output = await this.exec(argv);
            if (typeof output === 'string') {
                let trimmed = output.trim();
                return trimmed.length > 0
                    && !/^command failed:/i.test(trimmed);
            }
            return !!output;
        } catch (_error) {
            return false;
        }
    }
}
