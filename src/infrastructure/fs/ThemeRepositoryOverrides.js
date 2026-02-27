import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {ThemePath} from '../../domain/valueObjects/ThemePath.js';
import { tryRun } from '../utils/ErrorUtils.js';

class ThemeRepositoryOverrides {
    async removeTheme(name) {
        const themePath = new ThemePath(name);
        const removed = themePath.remove();
        removed && this.metadataCache.delete(name);
        return removed;
    }

    async writeThemeMetadata(name, metadata) {
        const themePath = new ThemePath(name);
        const themeDir = Gio.File.new_for_path(themePath.paths.root);
        !themeDir.query_exists(null) && themeDir.make_directory_with_parents(null);

        const metadataStr = JSON.stringify(metadata, null, 2);
        GLib.file_set_contents(themePath.paths.metadata, metadataStr);
        this.metadataCache.set(name, metadata);
    }

    readPerRiceHyprland(themeName) {
        let themePath = new ThemePath(themeName);

        if (Gio.File.new_for_path(themePath.paths.perRiceHyprlandFile).query_exists(null)) {
            return this.readJsonFile(
                themePath.paths.perRiceHyprlandFile,
                `Failed to read per_rice_hyprland for ${themeName}`
            )?.params ?? {};
        }

        if (Gio.File.new_for_path(themePath.paths.legacyOverridesFile).query_exists(null)) {
            let json = this.readJsonFile(
                themePath.paths.legacyOverridesFile,
                `Failed to read legacy overrides for ${themeName}`
            );
            if (json) {
                let result = {};
                for (const [key, value] of Object.entries(json)) {
                    !['version', 'updatedAt', 'overrides', 'params'].includes(key) && typeof value === 'string' && (result[key] = value);
                }
                json.overrides && typeof json.overrides === 'object' && Object.assign(result, json.overrides);
                json.params && typeof json.params === 'object' && Object.assign(result, json.params);
                return result;
            }
        }

        return {};
    }

    readOverrides(themeName) {
        return this.readPerRiceHyprland(themeName);
    }

    writePerRice(filePathKey, themeName, params) {
        let themePath = new ThemePath(themeName);
        if (!Gio.File.new_for_path(themePath.paths.root).query_exists(null)) {
            this.logger?.warn?.(`[ThemeRepository] Theme directory does not exist: ${themeName}`);
            return false;
        }
        let saved = tryRun(`ThemeRepositoryOverrides.${filePathKey}.${themeName}`, () => {
            GLib.file_set_contents(themePath.paths[filePathKey], JSON.stringify({
                version: 1, params, updatedAt: new Date().toISOString()
            }, null, 2));
        });
        !saved && this.logger?.warn?.(`[ThemeRepository] Failed to write ${filePathKey} for ${themeName}`);
        return saved;
    }

    writePerRiceHyprland(themeName, params) {
        return this.writePerRice('perRiceHyprlandFile', themeName, params);
    }

    writeOverrides(themeName, overrides) {
        return this.writePerRiceHyprland(themeName, overrides);
    }

    readPerRiceHotkeys(themeName) {
        let themePath = new ThemePath(themeName);

        if (Gio.File.new_for_path(themePath.paths.perRiceHotkeysFile).query_exists(null)) {
            return this.readJsonFile(
                themePath.paths.perRiceHotkeysFile,
                `Failed to read per_rice_hotkeys for ${themeName}`
            )?.params ?? {};
        }

        if (Gio.File.new_for_path(themePath.paths.legacyHotkeyOverridesFile).query_exists(null)) {
            let json = this.readJsonFile(
                    themePath.paths.legacyHotkeyOverridesFile,
                    `Failed to read legacy hotkey overrides for ${themeName}`
                ),
                structured = [json?.overrides, json?.params]
                    .find((value) => value && typeof value === 'object');
            if (!json || structured) return structured || {};
            let result = {};
            for (const [key, value] of Object.entries(json)) {
                key !== 'version' && key !== 'updatedAt' && (result[key] = value);
            }
            return result;
        }

        return {};
    }

    readHotkeyOverrides(themeName) {
        return this.readPerRiceHotkeys(themeName);
    }

    writePerRiceHotkeys(themeName, params) {
        return this.writePerRice('perRiceHotkeysFile', themeName, params);
    }

    writeHotkeyOverrides(themeName, overrides) {
        return this.writePerRiceHotkeys(themeName, overrides);
    }

    getThemesWithParameterOverride(paramPath) {
        const themes = [];
        for (const themeName of this.listThemeNames()) {
            const params = this.readPerRiceHyprland(themeName);
            params[paramPath] !== undefined && themes.push(themeName);
        }
        return themes;
    }
}

export function applyThemeRepositoryOverrides(prototype) {
    copyPrototypeDescriptors(prototype, ThemeRepositoryOverrides.prototype);
}
