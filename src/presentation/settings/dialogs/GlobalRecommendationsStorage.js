import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';

export function applyGlobalRecommendationsStorage(prototype) {
    prototype.getRecommendationsFilePath = function() {
        let persistentDir = GLib.get_home_dir() + '/.lastlayer_persistent';
        GLib.file_test(persistentDir, GLib.FileTest.IS_DIR) || GLib.mkdir_with_parents(persistentDir, 0o755);
        return persistentDir + '/global_recommendations.json';
    };

    prototype.migrateOldRecommendationsFile = function() {
        let oldPath = GLib.get_home_dir() + '/.config/lastlayer/global_recommendations.json',
            newPath = this.getRecommendationsFilePath(),
            canMigrate = GLib.file_test(oldPath, GLib.FileTest.EXISTS) && !GLib.file_test(newPath, GLib.FileTest.EXISTS);
        canMigrate && (() => {
            let result = tryOrNull('migrateOldRecommendations.read', () => GLib.file_get_contents(oldPath)),
                [ok, contents] = result || [];
            ok && (
                GLib.file_set_contents(newPath, contents),
                tryRun('migrateOldRecommendations.delete', () => Gio.File.new_for_path(oldPath).delete(null)),
                console.log('[GlobalRecommendations] Migrated file to persistent location')
            );
        })();
    };

    prototype.loadCurrentOverrides = function() {
        if (!this.settingsManager) {
            return;
        }

        this.globalOverrides = {...(this.settingsManager.get('hyprlandOverrides') ?? {})};
        this.globalHotkeyOverrides = {...(this.settingsManager.get('hotkeyOverrides') ?? {})};
        this.migrateOldRecommendationsFile();

        let recFilePath = this.getRecommendationsFilePath(),
            result = tryOrNull('loadCurrentOverrides.read', () => GLib.file_get_contents(recFilePath)),
            [ok, contents] = result || [],
            recData = ok
            ? tryOrNull('loadCurrentOverrides.parse', () => JSON.parse(new TextDecoder().decode(contents)))
            : null;

        if (!ok || !recData) {
            !ok && console.log('[GlobalRecommendations] No saved file');
            this.resetRecommendationState();
        } else {
            this.recommendationState = {...(recData.state ?? {})};
            this.hyprlandExtraLines = [...(recData.extraLines ?? [])];
            recData.hotkeys && Object.assign(this.globalHotkeyOverrides, recData.hotkeys);
            recData.paramOverrides && Object.assign(this.globalOverrides, recData.paramOverrides);

        }

        this.globalOverrides = Object.fromEntries(
            Object.entries(this.globalOverrides).filter(([key]) => !key.startsWith('__'))
        );

        this.selectedWorkspaces.clear();
        let recommendations = this.getRecommendedSettings();
        for (let rec of recommendations.filter((item) => item.type === 'workspaceRule')) {
            let stateKey = `${rec.id}_workspaces`,
                stored = this.recommendationState[stateKey];
            Array.isArray(stored) && stored.forEach(ws => this.selectedWorkspaces.add(ws));
        }
    };

    prototype.resetRecommendationState = function() {
        this.recommendationState = {};
        this.hyprlandExtraLines = [];
    };

    prototype.addExtraLine = function(line) {
        !this.hyprlandExtraLines.includes(line) && this.hyprlandExtraLines.push(line);
    };

    prototype.removeExtraLine = function(line) {
        const idx = this.hyprlandExtraLines.indexOf(line);
        idx !== -1 && this.hyprlandExtraLines.splice(idx, 1);
    };

    prototype.saveGlobalOverrides = function() {
        let recData = {
            state: JSON.parse(JSON.stringify(this.recommendationState)),
            extraLines: [...this.hyprlandExtraLines],
            hotkeys: {},
            paramOverrides: {}
        };

        for (let [id, override] of Object.entries(this.globalHotkeyOverrides)) {
            override.isRecommended && override.isGlobal && (recData.hotkeys[id] = override);
        }

        let recommendations = this.getRecommendedSettings();
        for (let rec of recommendations.filter((item) => item.type === 'param' && this.recommendationState[item.id])) {
            recData.paramOverrides[rec.paramPath] = this.globalOverrides[rec.paramPath];
        }

        let recFilePath = this.getRecommendationsFilePath(),
            saved = tryRun('saveGlobalOverrides.write', () => {
            let jsonContent = JSON.stringify(recData, null, 2);
            GLib.file_set_contents(recFilePath, jsonContent);
        });
        !saved && console.error('[GlobalRecommendations] Save failed');

        let themePath = this.parameterService ? this.getCurrentThemePath() : null;
        let syncEffectiveOverrides = () => {
            let baseSettings = this.settingsManager?.getAll?.() ?? {},
                mergedSettings = {
                ...baseSettings,
                hyprlandOverrides: {
                    ...(baseSettings.hyprlandOverrides ?? {}),
                    ...recData.paramOverrides
                },
                hotkeyOverrides: {
                    ...(baseSettings.hotkeyOverrides ?? {}),
                    ...recData.hotkeys
                },
                hyprlandExtraLines: recData.extraLines
            };

            this.parameterService.writeEffectiveOverrides?.(themePath, mergedSettings);

            let reloaded = tryRun('saveGlobalOverrides.hyprctlReload', () => {
                GLib.spawn_command_line_async('hyprctl reload');
            });
            !reloaded && console.log('[GlobalRecommendations] Failed to reload Hyprland');
        };
        themePath && syncEffectiveOverrides();

        this.eventBus?.emit?.('GLOBAL_OVERRIDES_CHANGED', {
            params: this.globalOverrides,
            hotkeys: this.globalHotkeyOverrides,
            extraLines: this.hyprlandExtraLines
        });
    };

    prototype.getCurrentThemePath = function() {
        let hasDependencies = this.themeRepository && this.settingsManager,
            currentTheme = hasDependencies ? this.settingsManager.get('theme') : null,
            themesPath = hasDependencies ? this.settingsManager.get('localThemesPath') : null;
        return hasDependencies && currentTheme && themesPath ? `${themesPath}/${currentTheme}` : null;
    };
}
