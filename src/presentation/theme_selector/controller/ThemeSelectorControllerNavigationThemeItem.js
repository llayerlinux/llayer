import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

const INSTALL_SCRIPT_RELATIVE_PATHS = [
    'start-scripts/installThemeApps.sh',
    'start-scripts/install_theme_apps.sh',
    'scripts/installThemeApps.sh',
    'scripts/install_theme_apps.sh'
];

function resolveThemePath(theme) {
    if (typeof theme?.path === 'string' && theme.path.trim().length > 0) {
        return theme.path.trim();
    }

    const themeName = typeof theme?.name === 'string' ? theme.name.trim() : '';
    return themeName ? `${GLib.get_home_dir()}/.config/themes/${themeName}` : '';
}

function hasInstallScript(theme) {
    const themePath = resolveThemePath(theme);
    return themePath && INSTALL_SCRIPT_RELATIVE_PATHS.some((relativePath) => {
        return Gio.File.new_for_path(`${themePath}/${relativePath}`).query_exists(null);
    });
}

function shouldUseInstallPhase(theme, settings = {}) {
    const themeName = typeof theme?.name === 'string' ? theme.name.trim() : '';
    if (!themeName) return false;

    const skipList = Array.isArray(settings.skip_install_theme_apps)
        ? settings.skip_install_theme_apps
        : [];
    return !skipList.includes(themeName) && hasInstallScript(theme);
}

export function applyThemeSelectorControllerNavigationThemeItem(targetPrototype) {
    targetPrototype.setPendingApplyCallback = function(themeName, callback) {
        this._pendingApplyCallbacks = this._pendingApplyCallbacks || new Map();
        this._pendingApplyCallbacks.set(themeName, callback);
    };

    targetPrototype.clearThemeProcessState = function(themeName) {
        this.downloading.delete(themeName);
        this.pendingAutoApplyThemes.delete(themeName);
        this.autoApplyingThemes.delete(themeName);
        this.activeProcesses.delete(themeName);
    };

    targetPrototype.notifyInstallPhase = function(theme, settings, onInstallProgress) {
        if (shouldUseInstallPhase(theme, settings)) {
            onInstallProgress({status: 'start', phase: 'installing'});
            return;
        }
        onInstallProgress({status: 'applying', phase: 'applying'});
    };

    targetPrototype.executeThemeApplyWithProgress = async function(themeName, theme, settings, onInstallProgress) {
        if (this.isInitialized !== true) {
            this.activeProcesses.delete(themeName);
            return false;
        }

        this.notifyInstallPhase(theme, settings, onInstallProgress);
        this.setPendingApplyCallback(themeName, onInstallProgress);

        const applyExecution = this.executeApplyTheme(themeName);
        if (!applyExecution) {
            this.activeProcesses.delete(themeName);
            return false;
        }

        try {
            await applyExecution;
            return true;
        } catch (error) {
            this.activeProcesses.delete(themeName);
            throw error;
        }
    };

    targetPrototype.downloadAndApplyNetworkTheme = async function(theme, settings, onInstallProgress) {
        const progressUI = this.createSimpleDownloadProgressUI(theme);
        let progressRemoved = false;

        const cleanupProgressContainer = (reloadLocalThemes = false) => {
            if (progressRemoved) return;
            progressRemoved = true;

            progressUI.container?.get_parent?.()?.remove(progressUI.container);

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
                (this.view?.downloadsBox?.get_children?.() || []).length === 0 && this.view && (
                    this.view.downloadsContainer.visible = false,
                    this.view.downloadsContainer.get_style_context().remove_class('visible'),
                    this.view.downloadsContainer.hide?.(),
                    reloadLocalThemes && this.loadLocalThemes()
                );
                this.view?.adaptWindowSize?.();
                return GLib.SOURCE_REMOVE;
            });
        };

        const scheduleProgressCleanup = (delayMs, reloadLocalThemes = false) => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
                cleanupProgressContainer(reloadLocalThemes);
                return GLib.SOURCE_REMOVE;
            });
        };

        this.downloading.set(theme.name, {progress: 0});
        this.view?.setDownloadState?.(theme.name, {status: 'start', progress: 0});
        onInstallProgress({status: 'start', phase: 'downloading'});

        if (this.view?.downloadsContainer && this.view?.downloadsBox) {
            this.view.downloadsContainer.visible = true;
            this.view.downloadsContainer.get_style_context().add_class('visible');
            this.view.downloadsBox.pack_start(progressUI.container, false, false, 0);
            this.view.downloadsContainer.show_all();
        }

        this.shouldAutoApplyNetwork(settings) && this.pendingAutoApplyThemes.add(theme.name);

        const downloadResult = await this.downloadRiceUseCase.execute(theme, {
            onProgress: (progress) => {
                progressUI.updateProgress(progress);
                const percentage = progress.percentage || 0;
                this.downloading.set(theme.name, {progress: percentage});
                this.view?.updateItemDownloadProgress?.(theme.name, percentage);
                onInstallProgress({
                    status: 'progress',
                    phase: 'downloading',
                    progress: progress.percentage,
                    downloadedSize: progress.downloaded,
                    totalSize: progress.totalSize
                });
            },
            onStatusChange: (status) => {
                switch (status.status) {
                    case 'extracting':
                        progressUI.updateProgress({downloaded: 0, percentage: 100, status: 'extracting', totalSize: 0});
                        onInstallProgress({status: 'extracting', phase: 'installing'});
                        return;
                    case 'completed':
                        this.downloading.delete(theme.name);
                        this.view?.setDownloadState?.(theme.name, {status: 'complete', progress: 100});
                        status.theme && this.store.updateTheme({
                            ...status.theme,
                            downloading: false,
                            status: 'available'
                        });
                        return;
                    case 'error':
                        this.downloading.delete(theme.name);
                        this.view?.setDownloadState?.(theme.name, {status: 'complete', progress: 0});
                        scheduleProgressCleanup(TIMEOUTS.ERROR_DISPLAY_MS, true);
                        onInstallProgress(status);
                        return;
                    default:
                        onInstallProgress(status);
                }
            }
        });

        if (!downloadResult?.success) {
            this.clearThemeProcessState(theme.name);
            scheduleProgressCleanup(0, false);
            this.notifier?.error?.(this.translate('DOWNLOAD_FAILED'), downloadResult?.error || this.translate('UNKNOWN_ERROR'));
            return downloadResult;
        }

        if (this.isInitialized !== true) {
            this.clearThemeProcessState(theme.name);
            return false;
        }

        await this.loadLocalThemes();
        if (this.isInitialized !== true) {
            this.clearThemeProcessState(theme.name);
            return false;
        }

        this.autoApplyingThemes.add(theme.name);
        this.setPendingApplyCallback(theme.name, onInstallProgress);
        this.notifyInstallPhase({name: theme.name}, settings, onInstallProgress);

        const applyExecution = this.executeApplyTheme(theme.name);
        if (!applyExecution) {
            this.clearThemeProcessState(theme.name);
            scheduleProgressCleanup(0, false);
            return false;
        }

        try {
            await applyExecution;
        } catch (error) {
            this.clearThemeProcessState(theme.name);
            scheduleProgressCleanup(0, false);
            throw error;
        }

        this.autoApplyingThemes.delete(theme.name);
        this.pendingAutoApplyThemes.delete(theme.name);
        this.downloading.delete(theme.name);
        this.postInstallNotifications(theme, true);
        cleanupProgressContainer(false);
        return true;
    };

    targetPrototype.handleThemeItemClick = async function(theme, options = {}) {
        if (this.isInitialized !== true || (this.activeProcesses.has(theme.name) && theme.name !== 'default')) {
            return false;
        }

        const onInstallProgress = typeof options.onInstallProgress === 'function'
            ? options.onInstallProgress
            : () => {};
        const settings = this.settingsService?.getAll?.() || {};

        this.activeProcesses.set(theme.name, 'processing');

        if (theme.name === 'default') {
            onInstallProgress({status: 'applying', phase: 'applying'});
            this.setPendingApplyCallback(theme.name, onInstallProgress);

            const quickRestorePointId = this.getDefaultQuickRestorePointId?.();
            if (quickRestorePointId) {
                try {
                    const restored = await this.restoreDefaultFromPoint?.(quickRestorePointId, {
                        notify: false, applyTheme: true, applyThemeName: 'default'
                    });
                    if (restored?.success) {
                        this.activeProcesses.delete(theme.name);
                        return true;
                    }
                } catch (_error) {}
            }
            await this.executeThemeApplyWithProgress(theme.name, theme, settings, onInstallProgress);
            this.activeProcesses.delete(theme.name);
            return true;
        }

        const isLocallyAvailable = !this.isNetworkTheme(theme)
            || Gio.File.new_for_path(`${GLib.get_home_dir()}/.config/themes/${theme.name}`).query_exists(null);

        if (isLocallyAvailable) {
            await this.executeThemeApplyWithProgress(theme.name, theme, settings, onInstallProgress);
            return true;
        }

        return this.downloadAndApplyNetworkTheme(theme, settings, onInstallProgress);
    };

    targetPrototype.onThemeApplyComplete = function(data) {
        const themeName = data?.theme || data?.themeName;
        if (themeName === undefined || themeName === null || themeName === '') {
            return;
        }

        const callback = this._pendingApplyCallbacks?.get(themeName);
        if (!callback) {
            return;
        }

        callback({status: data?.success ? 'complete' : 'error'});
        this._pendingApplyCallbacks.delete(themeName);
    };
}
