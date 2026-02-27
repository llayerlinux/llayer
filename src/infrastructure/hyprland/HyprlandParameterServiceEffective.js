import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull, tryRun } from '../utils/ErrorUtils.js';
import { patchConfigSource } from './HyprlandConfigPatcher.js';

class HyprlandParameterServiceEffective {
    getRecommendationPaths() {
        const home = GLib.get_home_dir();
        const persistentDir = `${home}/.lastlayer_persistent`;
        return {
            persistentDir,
            recFilePath: `${persistentDir}/global_recommendations.json`,
            oldPath: `${home}/.config/lastlayer/global_recommendations.json`
        };
    }

    migrateRecommendationsIfNeeded({persistentDir, recFilePath, oldPath}) {
        const shouldMigrate = GLib.file_test(oldPath, GLib.FileTest.EXISTS)
            && !GLib.file_test(recFilePath, GLib.FileTest.EXISTS);
        if (!shouldMigrate) return;

        tryRun('loadGlobalRecommendations.migrate', () => {
            if (!GLib.file_test(persistentDir, GLib.FileTest.IS_DIR)) {
                GLib.mkdir_with_parents(persistentDir, 0o755);
            }

            const contents = this.readFileText(oldPath);
            if (!contents) return;

            GLib.file_set_contents(recFilePath, contents);
            tryRun('loadGlobalRecommendations.deleteOld', () => Gio.File.new_for_path(oldPath).delete(null));
        });
    }

    getEffectiveOverridesPath(themePath) {
        return `${themePath}/.effective_hyprland.json`;
    }

    loadGlobalRecommendations() {
        const paths = this.getRecommendationPaths();
        this.migrateRecommendationsIfNeeded(paths);
        const text = this.readFileText(paths.recFilePath);
        return tryOrNull('loadGlobalRecommendations.parse', () => (text ? JSON.parse(text) : null));
    }

    hasRecommendationData(recData) {
        if (!recData) return false;
        return (recData.paramOverrides && Object.keys(recData.paramOverrides).length > 0)
            || (recData.hotkeys && Object.keys(recData.hotkeys).length > 0)
            || (recData.extraLines && recData.extraLines.length > 0);
    }

    mergeRecommendationData(settings, recData) {
        if (!this.hasRecommendationData(recData)) return settings;

        let effectiveSettings = {...settings};
        if (recData.paramOverrides && Object.keys(recData.paramOverrides).length > 0) {
            effectiveSettings.hyprlandOverrides = {
                ...recData.paramOverrides,
                ...(effectiveSettings.hyprlandOverrides ?? {})
            };
        }
        if (recData.hotkeys && Object.keys(recData.hotkeys).length > 0) {
            effectiveSettings.hotkeyOverrides = {
                ...recData.hotkeys,
                ...(effectiveSettings.hotkeyOverrides ?? {})
            };
        }
        if (recData.extraLines && recData.extraLines.length > 0) {
            effectiveSettings.hyprlandExtraLines = [
                ...(effectiveSettings.hyprlandExtraLines ?? []),
                ...recData.extraLines
            ];
        }

        return effectiveSettings;
    }

    writeEffectiveOverrides(themePath, settings, {skipMainConfigPatch = false} = {}) {
        const recData = this.loadGlobalRecommendations();
        const effectiveSettings = this.mergeRecommendationData(settings, recData);

        const collection = this.getMergedParameters(themePath, effectiveSettings);
        const effective = collection.getApplicableOverrides();
        const effectivePath = this.getEffectiveOverridesPath(themePath);

        const wroteEffectiveFile = tryRun('writeEffectiveOverrides', () => {
            GLib.file_set_contents(effectivePath, JSON.stringify({
                generatedAt: new Date().toISOString(),
                parameters: collection.getEffectiveOverrides()
            }, null, 2));
        });
        !wroteEffectiveFile && this.log('Error writing effective overrides');
        this.writeOverridesConfig(themePath, effectiveSettings, collection, {skipMainConfigPatch});
        return effective;
    }

    writeOverridesConfig(themePath, settings, existingCollection = null, {skipMainConfigPatch = false} = {}) {
        if (!themePath) return false;
        const hyprlandDir = `${themePath}/hyprland`;
        if (!GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR)) return false;

        const collection = existingCollection || this.getMergedParameters(themePath, settings ?? {});
        const overrides = collection.getApplicableOverrides();
        const entries = Object.entries(overrides)
            .filter(([key]) => !key.startsWith('__'))
            .sort(([a], [b]) => a.localeCompare(b));

        const lines = [
            '# LastLayer parameter overrides - auto-generated',
            '# This file is sourced after theme configs to apply overrides',
            ''
        ];

        if (entries.length === 0) {
            lines.push('# (no overrides)');
        } else {
            entries.forEach(([path, value]) => lines.push(`${path} = ${value}`));
        }

        const saved = tryRun('writeOverridesConfig', () => {
            GLib.file_set_contents(`${hyprlandDir}/.lastlayer-overrides.conf`, lines.join('\n'));
            this.ensureOverridesSource(themePath, {skipMainConfigPatch});
        });
        !saved && this.log('Error writing overrides config');
        return saved;
    }

    ensureOverridesSource(themePath, {skipMainConfigPatch = false} = {}) {
        if (!themePath) return false;
        const sourceLine = `source=${themePath}/hyprland/.lastlayer-overrides.conf`;
        const patchOpts = {
            confMarker: '.lastlayer-overrides.conf',
            comment: '# LastLayer parameter overrides (auto-generated)'
        };

        const candidates = [
            `${themePath}/hyprland.conf`,
            `${themePath}/config/hypr/hyprland.conf`,
            `${themePath}/.config/hypr/hyprland.conf`,
        ];
        !skipMainConfigPatch && candidates.push(`${GLib.get_home_dir()}/.config/hypr/hyprland.conf`);

        let anyPatched = false;
        for (const configPath of candidates) {
            const patched = patchConfigSource(configPath, sourceLine, patchOpts);
            !patched && configPath && GLib.file_test(configPath, GLib.FileTest.EXISTS)
                && this.log(`Error patching config for overrides (${configPath})`);
            anyPatched = patched || anyPatched;
        }
        return anyPatched;
    }
}

export function applyHyprlandParameterServiceEffective(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandParameterServiceEffective.prototype);
}
