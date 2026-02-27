import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Events } from '../../../app/eventBus.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

class ApplyThemeScriptsMonitor {
    captureAutomaticRestorePoint(themeName) {
        const restorePointService = this.diContainer?.get?.('restorePointService');
        if (typeof restorePointService?.refreshRestorePoint !== 'function') return;

        restorePointService.refreshRestorePoint.call(restorePointService, {
            folders: ((f) => Array.isArray(f) ? f : [])(this.settingsService?.settingsManager?.get?.('backupFolders')),
            theme: themeName,
            keepCurrentTheme: true,
            snapshotType: 'automatic',
            sourceTheme: themeName
        });
    }

    cleanupFlagFiles(flagFiles) {
        Object.values(flagFiles).forEach((path) => {
            const flagFile = Gio.File.new_for_path(path);
            flagFile.query_exists(null) && flagFile.delete(null);
        });
    }

    startScriptMonitoring(theme, flagFiles, installScript) {
        if (!flagFiles || Object.keys(flagFiles).length === 0) {
            return;
        }

        this.cleanupFlagFiles(flagFiles);
        const installStartTime = Date.now();

        let attempts = 0;
        const maxAttempts = 600;

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_LONG_MS, () => {
            attempts += 1;
            const allCompleted = Object.values(flagFiles).every((path) => Gio.File.new_for_path(path).query_exists(null));

            switch (true) {
            case allCompleted:
                this.eventBus?.emit?.(Events.THEME_INSTALL_STOP, {theme: theme.name});
                this.cleanupFlagFiles(flagFiles);

                const installTime = Date.now() - installStartTime;
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_LONG_MS, () => {
                    this.getClickStates()?.set(theme.name, false);
                    this.eventBus?.emit?.(Events.THEME_UI_REBUILD_GRID, {themeName: theme.name});
                    return GLib.SOURCE_REMOVE;
                });

                this.sendPerformanceStats(theme, {installMs: installTime});
                const added = this.settingsService?.addToSkipList?.(theme.name);
                added && this.eventBus?.emit?.(Events.APPSETTINGS_CHANGED, {
                    settings: this.settingsService.getAll(),
                    emitter: 'ApplyTheme'
                });

                this.captureAutomaticRestorePoint(theme.name);

                this.settingsService?.getAll?.().showInstallTime && this.notifier?.success?.(
                    this.translate('THEME_INSTALLED_NOTIFY'),
                    this.translate('THEME_INSTALLED_WITH_TIME', {theme: theme.name, seconds: (installTime / 1000).toFixed(1)})
                );
                this.soundService?.playThemeInstalledSound?.();

                return GLib.SOURCE_REMOVE;
            case attempts >= maxAttempts:
                this.eventBus?.emit?.(Events.THEME_INSTALL_STOP, {theme: theme.name});
                this.cleanupFlagFiles(flagFiles);
                return GLib.SOURCE_REMOVE;
            default:
                return GLib.SOURCE_CONTINUE;
            }
        });
    }
}

export function applyApplyThemeScriptsMonitor(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeScriptsMonitor.prototype);
}
