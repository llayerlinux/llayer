import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import {TabType, LoadingState} from '../../common/Constants.js';
import { Events } from '../../../app/eventBus.js';
import { tryOrNull, tryOrNullAsync } from '../../../infrastructure/utils/ErrorUtils.js';
import { isObjectLike } from '../../../infrastructure/utils/Utils.js';

class ThemeSelectorControllerCore {
    hasOwn(obj, key) {
        return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
    }

    isReady() {
        return this.isInitialized === true;
    }

    pickFirstTruthy(...values) {
        return values.find(Boolean) || null;
    }

    getStoreValue(key, fallback = null) {
        const store = this.store;
        const value = (!store || typeof store.get !== 'function') ? undefined : store.get(key);
        return value === undefined ? fallback : value;
    }

    getSettingsFromService() {
        const service = this.settingsService;
        return service && typeof service.getAll === 'function' ? service.getAll() : {};
    }

    getStoreArray(key) {
        const value = this.getStoreValue(key, null);
        return Array.isArray(value) ? value : [];
    }

    registerStoreSubscription(key, callback) {
        this.subscriptions.push(this.store.subscribe(key, callback));
    }

    getCombinedThemes() {
        return [...this.getStoreArray('localThemes'), ...this.getStoreArray('networkThemes')];
    }

    getCurrentStoreThemeName() {
        const settings = this.getStoreValue('settings', {});
        return this.pickFirstTruthy(
            this.getStoreValue('currentTheme', null),
            isObjectLike(settings) ? settings.theme : null
        );
    }

    getCurrentStoreTab() {
        return this.getStoreValue('activeTab', null);
    }

    shouldSkipAutoApplyDownloadedTheme(data, themeName, forceAutoApply, autoApplyOptIn, currentTheme) {
        const source = isObjectLike(data) ? data.source : null;
        return !themeName
            || source === 'apply_usecase'
            || currentTheme === themeName
            || this.autoApplyingThemes.has(themeName)
            || (!forceAutoApply && !autoApplyOptIn);
    }

    getDownloadKey(theme) {
        const safeTheme = isObjectLike(theme) ? theme : {};
        return this.pickFirstTruthy(safeTheme.name, safeTheme.localName);
    }

    parseTabName(tab) {
        return ({
            [TabType.NETWORK]: TabType.NETWORK,
            network: TabType.NETWORK,
            'rice-contest': TabType.NETWORK,
            [TabType.LOCAL]: TabType.LOCAL,
            local: TabType.LOCAL,
            installed: TabType.LOCAL
        })[tab || ''] ?? null;
    }

    extractThemeName(data) {
        const safeData = isObjectLike(data) ? data : {};
        const nestedTheme = isObjectLike(safeData.theme) ? safeData.theme : null;
        return this.pickFirstTruthy(safeData.themeName, nestedTheme ? nestedTheme.name : null)
            || (typeof safeData.theme === 'string' ? safeData.theme : null);
    }

    setView(view) {
        this.view = view;

        this.trySubscribeToEventBus();
        this.view?.needsStoreSubscription && this.view?.subscribeToStore?.();
        this.flushPendingSettingsRefresh();

        this.checkForUpdatesUseCase && this.timers.debounce('checkUpdates', () => this.checkForUpdates(), 1000);
    }

    setSettingsRefreshOverride(flags = {}) {
        const hasOverrideFlag = this.hasOwn(flags, 'languageChanged') || this.hasOwn(flags, 'themeChanged');
        if (!isObjectLike(flags) || !hasOverrideFlag) {
            return;
        }

        this.settingsRefreshOverride = {
            languageChanged: !!flags.languageChanged,
            themeChanged: !!flags.themeChanged
        };
    }

    async initialize() {
        return this.isInitialized
            ? undefined
            : (async () => {
                this.trySubscribeToEventBus();
                this.store.setDependencies(this.eventBus, this.logger);
                this.setupStoreSubscriptions();
                this.setupEventBusSubscriptions();
                this.setupDirectoryMonitoring();
                await this.loadInitialData();
                this.isInitialized = true;
            })();
    }

    setupDirectoryMonitoring() {
        const monitorCallback = () => {
            this.themeRepository?.clearCache?.();
            this.timers.debounce('directoryMonitor', () => this.scheduleLocalReload(150), 150);
        };

        this.themeRepository.addMonitorCallback(monitorCallback);
        this.directoryMonitorCallback = monitorCallback;
    }

    setupStoreSubscriptions() {
        this.registerStoreSubscription('activeTab', (newTab) => this.onTabChanged(newTab));

        this.registerStoreSubscription('selectedTheme', (theme) => {
            theme && this.onThemeSelected(theme);
        });
    }

    setupEventBusSubscriptions() {
        const hasInvalidBus = this.eventBusSubscribed
            || typeof this.eventBus?.on !== 'function'
            || typeof this.eventBus?.emit !== 'function';
        if (hasInvalidBus) {
            return;
        }

        this.eventBusSubscribed = true;

        const subscribe = (eventName, callback) => {
            this.eventBusListeners.push({eventName, listenerId: this.eventBus.on(eventName, callback)});
        };

        const events = isObjectLike(this.eventBus.Events) ? this.eventBus.Events : {};
        Object.entries(this.buildEventHandlersMap(events)).forEach(([event, handler]) => subscribe(event, handler));
    }

    buildEventHandlersMap(events = {}) {
        const E = {...Events, ...events};
        return {
            [E.APPSETTINGS_LOADED]: (settings) => {
                this.scheduleSettingsRefresh(settings, {initial: true});
            },
            [E.APPSETTINGS_COMMITTED]: (payload) => {
                this.handleSettingsCommit(payload);
            },
            [E.APPSETTINGS_CHANGED]: (settings) => {
                this.scheduleSettingsRefresh(settings, {debounce: true});
            },
            [E.APPSETTINGS_RESET]: (settings) => {
                this.scheduleSettingsRefresh(isObjectLike(settings) ? settings : {}, {initial: true});
            },

            [E.THEME_APPLY_START]: () => this.store.setApplyingTheme(true),
            [E.THEME_APPLY_SUCCESS]: (data) => this.handleThemeApplySuccess(data),
            [E.THEME_APPLY_ERROR]: (data) => this.handleThemeApplyError(data),
            [E.THEME_APPLY_COMPLETE]: (data) => {
                const theme = isObjectLike(data) ? data.theme : null;
                this.store.setApplyingTheme(false);
                theme && this.activeProcesses.delete(theme);
                this.onThemeApplyComplete?.(data);
            },

            [E.THEME_UI_UPDATE_CURRENT]: (data) => this.store.setCurrentTheme(data.themeName),

            [E.THEME_REPOSITORY_UPDATED]: () => this.handleRepositoryUpdated(),
            [E.THEME_UPDATED]: (data) => this.handleThemeUpdated(data),
            [E.INBOX_THEME_IMPORTED]: (data) => this.handleInboxThemeImported(data),
            [E.THEMES_LOCAL_UPDATED]: () => this.scheduleLocalReload(150),

            [E.THEME_DOWNLOAD_CANCELLED]: (payload) => this.handleDownloadCancelled(payload),
            [E.THEME_DOWNLOAD_COMPLETE]: (data) => this.handleDownloadComplete(data),

            [E.UI_REFRESH_REQUESTED]: (payload) => this.handleRefreshRequested(payload)
        };
    }

    handleThemeApplySuccess(data) {
        this.store.setApplyingTheme(false);
        let themeName = this.extractThemeName(data);
        if (!themeName) return;

        this.activeProcesses.delete(themeName);
        this.store.setCurrentTheme(themeName);

        let found = this.getCombinedThemes().find((theme) => isObjectLike(theme) && theme.name === themeName);
        if (found) {
            this.store.selectTheme(found);
        }

        if (this.getCurrentStoreTab() === TabType.NETWORK) {
            this.view?.updateThemesList?.(this.getStoreArray('networkThemes'));
        }
        this.view?.updateCurrentThemeStyles?.(themeName);
    }

    handleThemeApplyError(data) {
        const error = isObjectLike(data) ? data.error : null;
        this.store.setApplyingTheme(false, error);
        const themeName = this.extractThemeName(data);
        themeName && this.activeProcesses.delete(themeName);
        this.notifier?.error?.(
            this.translate('THEME_APPLY_ERROR_TITLE'),
            this.translate('THEME_APPLY_ERROR_MESSAGE', {error})
        );
    }

    handleRepositoryUpdated() {
        this.isReady() && this.getCurrentStoreTab() === TabType.LOCAL && this.scheduleLocalReload(300);
    }

    handleThemeUpdated(data) {
        if (!this.isReady()) return;

        const safeData = isObjectLike(data) ? data : {},
              theme = isObjectLike(safeData.theme) ? safeData.theme : null,
              response = isObjectLike(safeData.response) ? safeData.response : null;
        theme?.name && response?.body && this.updateLocalMetadataFromServer(theme.name, response.body);
        this.networkThemeService?.themeCacheService?.clearCache?.();
        this.themeRepository?.clearCache?.();

        return this.parseTabName(this.getCurrentStoreTab()) === TabType.LOCAL
            ? this.loadLocalThemes().then((loaded) => !loaded && this.scheduleLocalReload(300))
            : this.loadNetworkThemes({
                forceRefresh: true,
                page: this.networkPagination?.page ?? null,
                pageSize: this.networkPagination?.pageSize ?? null
            });
    }

    rememberImportingTheme(themeName) {
        this.importingThemes ||= new Set();
        if (themeName) {
            this.importingThemes.add(themeName);
        }
    }

    triggerImportedThemeReload() {
        const loadPromise = this.loadLocalThemes({force: true});
        loadPromise && tryOrNullAsync('ThemeSelectorControllerCore.triggerImportedThemeReload', () => loadPromise);

        this.timers?.debounce?.('inboxImportReload', () => {
            tryOrNullAsync(
                'ThemeSelectorControllerCore.triggerImportedThemeReload.debounced',
                () => this.loadLocalThemes({force: true})
            );
            this.timers?.debounce?.('inboxImportClear', () => this.importingThemes?.clear?.(), 500);
        }, 500);
    }

    getImportedThemeApplyDelay(settings, flyMode = false) {
        if (!flyMode) {
            return this.getTimeoutSetting('regularApplyDelay', 1500);
        }

        const flyParallelApply = settings?.flyParallelApply !== false;
        return flyParallelApply
            ? this.getTimeoutSetting('flyApplyDelay', 500)
            : this.getTimeoutSetting('regularApplyDelay', 1500);
    }

    scheduleImportedThemeAutoApply(themeName, settings, flyMode = false) {
        if (!themeName || !flyMode) return;
        if (settings?.autoApplyAfterImport === false) return;

        const applyDelay = this.getImportedThemeApplyDelay(settings, flyMode);
        this.timers?.debounce?.(
            `inboxAutoApply:${themeName}`,
            () => this.autoApplyImportedTheme(themeName, flyMode),
            applyDelay
        );
    }

    handleInboxThemeImported(data) {
        if (!this.isReady()) return;

        const safeData = isObjectLike(data) ? data : {};
        const themeName = this.extractThemeName(safeData);
        const flyModeEnabled = safeData.flyModeEnabled === true;
        this.themeRepository?.clearCache?.();
        this.scheduleLocalReload(100);
        const settings = this.getEffectiveSettings();
        this.rememberImportingTheme(themeName);
        this.triggerImportedThemeReload();
        this.scheduleImportedThemeAutoApply(themeName, settings, flyModeEnabled);
    }

    findLocalThemeByName(themeName) {
        if (!themeName) return null;

        return this.getStoreArray('localThemes').find(
            (item) => isObjectLike(item) && item.name === themeName
        ) || null;
    }

    scheduleAutoApplyRetry(themeName, flyMode = false) {
        const retryDelay = flyMode
            ? this.getTimeoutSetting('flyRetryDelay', 300)
            : this.getTimeoutSetting('regularRetryDelay', 1000);

        this.timers?.debounce?.(`inboxAutoApplyRetry:${themeName}`, () => {
            this.findLocalThemeByName(themeName) && this.executeAutoApply(themeName, flyMode);
        }, retryDelay);
    }

    autoApplyImportedTheme(themeName, flyMode = false) {
        if (!themeName || !this.isReady()) return;

        if (!this.findLocalThemeByName(themeName)) {
            this.scheduleAutoApplyRetry(themeName, flyMode);
            return;
        }

        this.executeAutoApply(themeName, flyMode);
    }

    emitFlyInstallWarning(themeName, requiredInstallSteps) {
        if (!themeName || requiredInstallSteps.length === 0) return;

        this.eventBus?.emit?.(Events.UNIFIER_LOG, {
            message: `WARNING ${themeName}: requires install for ${requiredInstallSteps.join(', ')} (run Install first)`,
            level: 'warning',
            source: 'FlyImport'
        });
    }

    buildAutoApplyOptions(themeName, flyMode = false) {
        const applyOptions = {};
        if (!flyMode || this.getEffectiveSettings()?.flySkipInstallScript !== true) {
            return applyOptions;
        }

        applyOptions.flySkipInstallScript = true;
        const requiredInstallSteps = this.getRequiredInstallSteps(themeName);
        this.emitFlyInstallWarning(themeName, requiredInstallSteps);
        return applyOptions;
    }

    finalizeAutoApplyExecution(themeName, execution) {
        if (!execution || typeof execution.then !== 'function') {
            this.autoApplyingThemes.delete(themeName);
            return;
        }

        tryOrNullAsync('ThemeSelectorControllerCore.finalizeAutoApplyExecution', () => execution)
            .finally(() => this.autoApplyingThemes.delete(themeName));
    }

    executeAutoApply(themeName, flyMode = false) {
        if (!themeName || !this.isReady() || this.autoApplyingThemes.has(themeName)) return;

        this.autoApplyingThemes.add(themeName);

        const theme = this.findLocalThemeByName(themeName);
        theme && this.store.selectTheme(theme);
        this.store.setCurrentTheme(themeName);

        const applyOptions = this.buildAutoApplyOptions(themeName, flyMode);
        const execution = this.executeApplyTheme?.(themeName, applyOptions);
        this.finalizeAutoApplyExecution(themeName, execution);
    }

    handleDownloadCancelled(payload = {}) {
        const safePayload = isObjectLike(payload) ? payload : {};
        const themeName = isObjectLike(safePayload.theme) ? safePayload.theme.name : null;
        themeName && this.handleDownloadCancel(themeName, safePayload.processId ?? null, safePayload.reason ?? 'user');
    }

    async handleDownloadComplete(data) {
        if (!this.isReady()) return;

        const safeData = isObjectLike(data) ? data : {};
        const downloadedTheme = isObjectLike(safeData.theme)
            ? {...safeData.theme}
            : null;
        const {themeName, completeKey} = {
            themeName: this.extractDownloadedThemeName(
                data, downloadedTheme),
            completeKey: this.getDownloadKey(safeData.theme)
        };

        if (completeKey) {
            this.downloading.delete(completeKey);
            this.view?.setDownloadState?.(completeKey, {
                status: 'complete',
                progress: 100
            });
        }
        if (themeName) {
            this.addLocalThemeToStore(themeName);
        }
        this.scheduleLocalReload(350);

        await this.maybeAutoApplyDownloadedTheme(
            data, downloadedTheme, themeName);
    }

    extractDownloadedThemeName(data, downloadedTheme) {
        let safeTheme = isObjectLike(downloadedTheme) ? downloadedTheme : null;
        let rawName = this.pickFirstTruthy(
            safeTheme?.localName,
            safeTheme?.name,
            safeTheme?.title,
            isObjectLike(data) ? data.localName : null
        );
        let themeName = typeof rawName === 'string' ? rawName.trim() : null;
        if (safeTheme && themeName && !safeTheme.name) {
            safeTheme.name = themeName;
        }
        return themeName;
    }

    async maybeAutoApplyDownloadedTheme(data, downloadedTheme, themeName) {
        if (!this.isReady()) return;

        const settings = this.getEffectiveSettings(),
              safeData = isObjectLike(data) ? data : {},
              forceAutoApply = safeData.autoApply === true || this.pendingAutoApplyThemes.has(themeName),
              shouldSkip = this.shouldSkipAutoApplyDownloadedTheme(
                  data, themeName, forceAutoApply, this.shouldAutoApplyNetwork(settings), this.getCurrentStoreThemeName()
              );

        if (shouldSkip) {
            this.pendingAutoApplyThemes.delete(themeName);
            return;
        }

        this.autoApplyingThemes.add(themeName);
        await this.loadLocalThemes();
        this.isReady() && await this.applyThemeAfterDownload(downloadedTheme, settings, {force: forceAutoApply});
        this.pendingAutoApplyThemes.delete(themeName);
        this.autoApplyingThemes.delete(themeName);
    }

    async handleRefreshRequested(payload = {}) {
        if (!this.isReady()) return;

        const safePayload = isObjectLike(payload) ? payload : {};
        const normalizedTab = this.parseTabName(safePayload.tab || this.getCurrentStoreTab());
        if (!normalizedTab) return;

        this.store.setLoadingState(normalizedTab, LoadingState.LOADING);
        await this.handleRefresh();
    }

    getEffectiveSettings() {
        const storeSettings = this.getStoreValue('settings', null);
        return (isObjectLike(storeSettings) && Object.keys(storeSettings).length > 0)
            ? storeSettings
            : this.getSettingsFromService();
    }

    getTimeoutSetting(key, defaultValue) {
        const value = this.getEffectiveSettings()?.timeouts?.[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : defaultValue;
    }

    getThemeMetadataPath(themeName) {
        if (!themeName) return null;
        const basePath = this.themeRepository?.basePath
            || GLib.build_filenamev([GLib.get_home_dir(), '.config', 'themes']);
        return GLib.build_filenamev([basePath, themeName, 'lastlayer-metadata.json']);
    }

    readThemeMetadata(themeName) {
        const metadataPath = this.getThemeMetadataPath(themeName);
        if (!(metadataPath && GLib.file_test(metadataPath, GLib.FileTest.EXISTS))) return null;

        const [ok, content] = tryOrNull(
            'ThemeSelectorControllerCore.readThemeMetadata.read',
            () => GLib.file_get_contents(metadataPath)
        ) || [];
        if (!ok) return null;

        return tryOrNull(
            'ThemeSelectorControllerCore.readThemeMetadata.parse',
            () => JSON.parse(new TextDecoder().decode(content))
        );
    }

    getRequiredInstallSteps(themeName) {
        const requiresInstall = this.readThemeMetadata(themeName)?.unifier?.requiresInstallScript;
        return Array.isArray(requiresInstall)
            ? requiresInstall.filter((item) => typeof item === 'string' && item.length > 0)
            : [];
    }

    trySubscribeToEventBus() {
        !this.eventBusSubscribed && this.setupEventBusSubscriptions();
    }

    executeApplyTheme(themeName, extraOptions = {}) {
        if (!themeName || !this.isReady()) return null;

        const userOnUIUpdate = typeof extraOptions.onUIUpdate === 'function' ? extraOptions.onUIUpdate : null;
        return this.applyThemeUseCase.execute(themeName, {
            ...extraOptions,
            onUIUpdate: (result, appliedTheme, elapsedTime) => {
                if (!this.isReady()) {
                    return;
                }

                this.handleApplyResult(result, appliedTheme, this.getSettingsFromService(), elapsedTime);
                userOnUIUpdate?.(result, appliedTheme, elapsedTime);
            }
        });
    }

    getThemeFromSettings(settings) {
        return typeof settings?.theme === 'string'
            ? settings.theme
            : (this.settingsService?.getCurrentTheme?.() ?? null);
    }
}

export function applyThemeSelectorControllerCore(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerCore.prototype);
}
