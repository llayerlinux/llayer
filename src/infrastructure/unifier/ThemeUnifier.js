import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';

import { Events } from '../../app/eventBus.js';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { HyprlandConfigGenerator } from '../hyprland/HyprlandConfigGenerator.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export class ThemeUnifier {
    constructor(options = {}, auditLog = null) {
        this._native = createAuditedNative(
            new LastlayerSupporter.ThemeUnifier(),
            'ThemeUnifier',
            auditLog
        );

        this.logger = options.logger ?? null;
        this.eventBus = options.eventBus ?? null;
        this.settingsManager = options.settingsManager ?? null;
        this.tempPath = options.tempPath ?? `${GLib.get_user_cache_dir()}/llayer-unifier-temp`;
        this.getPreviewSource = options.getPreviewSource ?? (() => 'auto');
        this.hyprlandConfigGenerator = options.hyprlandConfigGenerator
            ?? new HyprlandConfigGenerator({ logger: this.logger });

        this._native.connect('log-message', (_obj, message) => {
            if (this.logger?.info) {
                this.logger.info(message);
            } else {
                print(message);
            }
        });

        this._native.connect('unifier-log', (_obj, message, level, source) => {
            this.eventBus?.emit?.(Events.UNIFIER_LOG, { message, level, source });
        });

        this._native.connect('schedule-auto-tags', (_obj, themePath, themeName, metadataJson) => {
            this.scheduleAutoTagGeneration(themePath, themeName, metadataJson);
        });

        this.syncSettings();
    }

    syncSettings() {
        const sm = this.settingsManager;
        if (!sm) return;

        const allSettings = sm.getAll?.() ?? {};
        const settingsJson = JSON.stringify({
            commentOutWallpaperExecs: sm.get?.('commentOutWallpaperExecs') ?? false,
            swayToHyprlandConvert: sm.get?.('swayToHyprlandConvert') !== false,
            previewSource: this.getPreviewSource(),
            hideWifiNameOnImport: sm.get?.('hideWifiNameOnImport') === true,
            autoGenerateTagsOnImport: sm.get?.('autoGenerateTagsOnImport') === true,
            autoGenerateTagsProviderId: sm.get?.('autoGenerateTagsProviderId') ?? null,
            hyprpanel_adaptive_isolation: allSettings.hyprpanel_adaptive_isolation === true,
            hyprpanel_adaptive_scale_enabled: allSettings.hyprpanel_adaptive_scale_enabled === true,
            hyprpanel_adaptive_scale_value: Number.isFinite(allSettings.hyprpanel_adaptive_scale_value)
                ? allSettings.hyprpanel_adaptive_scale_value : 68,
            quickshell_adaptive_isolation: allSettings.quickshell_adaptive_isolation === true,
            enable_dependency_isolation: allSettings.enable_dependency_isolation === true,
            isolation_grouping_mode: allSettings.isolation_grouping_mode ?? null,
            flySeamlessMode: allSettings.flySeamlessMode === true,
            swayConvertFixFonts: sm.get?.('swayConvertFixFonts') !== false,
            swayConvertFixActive: sm.get?.('swayConvertFixActive') !== false,
        });

        this._native.configure(settingsJson);
    }

    unify(sourcePath, themeName, options = {}) {
        this.syncSettings();

        const resultJson = this._native.unify(sourcePath, themeName, JSON.stringify(options));
        const result = tryOrDefault('ThemeUnifier.unify.parseResult', () => JSON.parse(resultJson), null);
        if (!result) {
            return { success: false, error: 'Failed to parse unify result' };
        }

        result?.success && this.generateHyprlandConfigForUnifyResult(sourcePath, result);
        return result;
    }

    generateHyprlandConfigForUnifyResult(sourcePath, result) {
        const themePath = this.resolveGeneratedThemePath(sourcePath, result);
        if (!themePath) {
            return;
        }

        if (!tryRun('ThemeUnifier.generateHyprlandConfig', () => {
            this.hyprlandConfigGenerator?.generateThemeForCurrentVersion?.(themePath);
        })) {
            this.logMessage('Hyprland config normalization warning');
            return;
        }

        this.logMessage(`Hyprland config normalized for "${themePath}"`);
    }

    resolveGeneratedThemePath(sourcePath, result) {
        const candidates = [
            result?.themePath,
            result?.outputPath,
            result?.finalPath,
            result?.path,
            sourcePath
        ].filter((value) => typeof value === 'string' && value.trim().length > 0);

        for (const candidate of candidates) {
            const themePath = candidate.trim();
            const hasHyprlandDir = Gio.File.new_for_path(`${themePath}/hyprland`).query_exists(null);
            const hasHyprlandConf = Gio.File.new_for_path(`${themePath}/hyprland.conf`).query_exists(null);
            if (hasHyprlandDir || hasHyprlandConf) {
                return themePath;
            }
        }

        return null;
    }

    scheduleAutoTagGeneration(themePath, themeName, metadataJson) {
        const metadata = tryOrDefault('ThemeUnifier.scheduleAutoTags.metadata', () => JSON.parse(metadataJson), null);
        metadata && this.eventBus?.emit?.('schedule_auto_tags', { themePath, themeName, metadata });

        const workerPath = this.getAutoTagWorkerPath();
        if (!workerPath) {
            return;
        }

        const providerId = this.settingsManager?.get?.('autoGenerateTagsProviderId') ?? null;
        const payload = JSON.stringify({ themePath, themeName, providerId });
        if (!tryRun('ThemeUnifier.scheduleAutoTags.spawn', () => {
            GLib.spawn_async(
                null,
                ['gjs', '-m', workerPath, '--', payload],
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );
        })) {
            this.logMessage('Auto tag generation spawn failed');
            return;
        }

        this.logMessage(`Auto tag generation scheduled for "${themeName}"`);
    }

    getAutoTagWorkerPath() {
        const workerPath = GLib.build_filenamev([
            GLib.get_current_dir(),
            'src',
            'infrastructure',
            'ai',
            'AutoTagGenerationWorker.js'
        ]);
        if (GLib.file_test(workerPath, GLib.FileTest.EXISTS)) {
            return workerPath;
        }

        this.logMessage(`AutoTagGenerationWorker not found: ${workerPath}`);
        return null;
    }

    logMessage(msg) {
        if (this.logger?.info) {
            this.logger.info(`[ThemeUnifier] ${msg}`);
        } else {
            print(`[ThemeUnifier] ${msg}`);
        }
    }
}
