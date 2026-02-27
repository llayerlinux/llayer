import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import {TabType, LoadingState} from '../../common/Constants.js';
import { Events } from '../../../app/eventBus.js';
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
        isObjectLike(flags) && hasOverrideFlag && (this.settingsRefreshOverride = {
            languageChanged: !!flags.languageChanged,
            themeChanged: !!flags.themeChanged
        });
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
        return hasInvalidBus
            ? undefined
            : (() => {
                this.eventBusSubscribed = true;

                const subscribe = (eventName, callback) => {
                    this.eventBusListeners.push({eventName, listenerId: this.eventBus.on(eventName, callback)});
                };

                const events = isObjectLike(this.eventBus.Events) ? this.eventBus.Events : {};
                Object.entries(this.buildEventHandlersMap(events)).forEach(([event, handler]) => subscribe(event, handler));
            })();
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
        found && this.store.selectTheme(found);

        this.getCurrentStoreTab() === TabType.NETWORK
            && this.view?.updateThemesList?.(this.getStoreArray('networkThemes'));
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

        completeKey
            && (this.downloading.delete(completeKey),
                this.view?.setDownloadState?.(completeKey, {
                    status: 'complete',
                    progress: 100
                }));
        themeName && this.addLocalThemeToStore(themeName);
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
        safeTheme && themeName && !safeTheme.name && (safeTheme.name = themeName);
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

    trySubscribeToEventBus() {
        !this.eventBusSubscribed && this.setupEventBusSubscriptions();
    }

    executeApplyTheme(themeName, extraOptions = {}) {
        if (!themeName || !this.isReady()) return null;

        const userOnUIUpdate = typeof extraOptions.onUIUpdate === 'function' ? extraOptions.onUIUpdate : null;
        return this.applyThemeUseCase.execute(themeName, {
            ...extraOptions,
            onUIUpdate: (result, appliedTheme, elapsedTime) => {
                this.isReady() && (
                    this.handleApplyResult(result, appliedTheme, this.getSettingsFromService(), elapsedTime),
                    userOnUIUpdate && userOnUIUpdate(result, appliedTheme, elapsedTime)
                );
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
