import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import {TabType, ViewTabName, LoadingState} from '../../common/Constants.js';
import { Events } from '../../../app/eventBus.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { tryOrNullAsync } from '../../../infrastructure/utils/ErrorUtils.js';

class ThemeSelectorControllerLoading {
    updateLocalScanProgress(processed, total) {
        this.store.update({localScanProgress: {processed, total}});
        this.view?.updateLocalLoadingProgress?.(processed, total);
    }

    async loadInitialData() {
        const settings = await this.loadAppSettingsUseCase.execute();
        this.store.setSettings(settings);
        const currentTheme = this.getThemeFromSettings(settings);
        this.store.setCurrentTheme(currentTheme);
        await this.loadLocalThemes();
        tryOrNullAsync('loadInitialData.ensureInitialRestorePoint', () => {
            return this.container?.get?.('restorePointService')?.ensureInitialAutomaticRestorePoint?.();
        });
    }

    checkForUpdates() {
        const result = this.checkForUpdatesUseCase.execute();
        if (result.hasUpdate && result.update) {
            this.store?.setUpdateInfo?.(result.update);
            this.view?.showUpdateNotification?.(result.update);
        }
    }

    async awaitPreviousLoad(force) {
        if (this.loadingLocalThemes && force) {
            await this.loadingLocalThemes;
            this.loadingLocalThemes = null;
        }
    }

    updateBasePath() {
        const localThemesPath = this.settingsService?.getAll?.()?.localThemesPath;
        if (localThemesPath) {
            this.themeRepository.basePath = localThemesPath;
        }
    }

    async loadLocalThemes(options = {}) {
        const force = options.force === true;
        if (this.loadingLocalThemes && !force) {
            return this.loadingLocalThemes;
        }

        await this.awaitPreviousLoad(force);
        let timeoutId = 0;

        let loadPromise = (async () => {
            this.store.setLoadingState(TabType.LOCAL, LoadingState.LOADING);
            this.updateBasePath();

            let progressUpdate = (processed, total) => this.updateLocalScanProgress(processed, total);

            let themes = await tryOrNullAsync(
                'ThemeSelectorControllerLoading.getLocalThemesAsync',
                async () => this.themeRepository.getLocalThemesAsync({
                    force,
                    batchSize: 8,
                    onProgress: progressUpdate,
                    useMainLoopYield: this.isInitialized === true
                })
            ) || [];

            let byName = new Map(),
                themeList = Array.isArray(themes) ? themes : [];
            for (const theme of themeList) {
                if (!(theme && theme.name) || byName.has(theme.name)) continue;
                byName.set(theme.name, {...theme});
            }
            let list = Array.from(byName.values()).sort((a, b) =>
                (b.name === 'default') - (a.name === 'default') || a.name.localeCompare(b.name)
            );

            this.store.set('localThemes', []);
            this.store.update({totalLocalThemes: 0});
            let loadLocalThemesIntoStore = this.store.loadLocalThemes
                ? () => this.store.loadLocalThemes(list)
                : () => {
                    this.store.set('localThemes', list);
                    this.store.update({
                        totalLocalThemes: list.length,
                        localLoadingState: LoadingState.SUCCESS,
                        localError: null
                    });
                };
            loadLocalThemesIntoStore();

            let notifyThemes = this.store.get('localThemes');
            this.store.notifySubscribers?.('localThemes', Array.isArray(notifyThemes) ? notifyThemes : list, null);

            this.store.setLoadingState(TabType.LOCAL, LoadingState.SUCCESS);
            this.eventBus.emit(Events.THEMES_LOCAL_UPDATED, {count: list.length});

            let storeActiveTab = this.store.get('activeTab'),
                isInstalledActive = (storeActiveTab === TabType.LOCAL || storeActiveTab === ViewTabName.INSTALLED ||
                this.view?.currentTab === ViewTabName.INSTALLED || this.view?.currentTab === TabType.LOCAL);
            if (this.view && isInstalledActive) {
                this.view.updateThemesList?.(list);
            }

            this.loadingLocalThemes = null;
            this.updateLocalScanProgress(list.length, list.length);
            if (timeoutId) {
                GLib.source_remove(timeoutId);
                timeoutId = 0;
            }

            return list;
        })();

        let timeoutPromise = new Promise((_, reject) => {
            timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.NETWORK_TIMEOUT_MS, () => {
                this.loadingLocalThemes = null;
                reject(new Error('Timeout loading local themes'));
                return GLib.SOURCE_REMOVE;
            });
        });

        this.loadingLocalThemes = Promise.race([loadPromise, timeoutPromise]);
        return this.loadingLocalThemes;
    }

    async forceRescanLocalThemes() {
        this.themeRepository?.clearCache && this.themeRepository.clearCache();

        await this.loadLocalThemes({force: true});
        await this.refreshLocalThemeStats({force: true});
    }
}

export function applyThemeSelectorControllerLoading(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerLoading.prototype);
}
