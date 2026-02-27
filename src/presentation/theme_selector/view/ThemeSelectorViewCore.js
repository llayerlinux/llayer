import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { Events } from '../../../app/eventBus.js';
import { DEFAULT_SERVER_ADDRESS } from '../../../infrastructure/constants/AppUrls.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { isPlainObject } from '../../../infrastructure/utils/Utils.js';
import {ViewTabName} from '../../common/Constants.js';
import {
    DEFAULT_NETWORK_PAGINATION,
    normalizePagination,
    STORE_TAB_TO_VIEW_TAB,
    STORE_TAB_THEME_KEYS,
    THEME_LOADING_STATES,
    THEME_PLACEHOLDER_KEYS
} from '../ThemeSelectorContracts.js';
import * as TabManagerModule from '../components/TabManager.js';
import * as ThemeStateManagerModule from '../components/ThemeStateManager.js';
import * as WindowManagerModule from '../components/WindowManager.js';
import * as PreviewLoaderModule from '../components/PreviewLoader.js';
import * as TabRenderersModule from '../components/TabRenderers.js';
import * as StoreHandlersModule from '../components/StoreHandlers.js';

const LOCAL_RELOAD_PLACEHOLDER_KEYS = THEME_PLACEHOLDER_KEYS.installed;
const DEFAULT_PLACEHOLDER_KEYS = THEME_PLACEHOLDER_KEYS.default;

const WIDGET_REFERENCE_KEYS = [
    'window',
    'contentBox',
    'headerBox',
    'bottomBar',
    'btnInstalled',
    'btnNetwork',
    'parametersBtn',
    'moreSectionsBtn',
    'aboutBtn',
    'closeBtn',
    'addButton',
    'uploadButton',
    'uploadButtonIcon',
    'uploadButtonSpinner',
    'bottomSettingsButton',
    'refreshButton',
    'infoButton',
    'mainContentBox',
    'downloadsContainer',
    'networkProgressArea',
    'networkProgressBar',
    'defaultRestorePointsDialog',
    'restorePointDetailsDialog',
    'gridBox',
    'scrollableGrid',
    'downloadsBox'
];

const EMPTY_FUNCTION = () => {};

export function applyThemeSelectorViewCore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewCore.prototype);
}

class ThemeSelectorViewCore {
    getStoreState() {
        return this.controller?.store?.getState?.() ?? null;
    }

    initializeManagers() {
        this.tabManager = new TabManagerModule.TabManager({
            buttons: {},
            onTabChange: (tab) => this.onTabChanged(tab),
            getMainContentBox: () => this.mainContentBox,
            getScrollableGrid: () => this.scrollableGrid,
            getGridBox: () => this.gridBox,
            detachFromParent: (widget) => this.detachFromParent(widget),
            clearGridBox: () => this.clearGridBox(),
            hideNetworkProgress: () => this.hideNetworkProgressBar(),
            attachScrollHandler: EMPTY_FUNCTION,
            getWindow: () => this.window
        });
        this.themeStateManager = new ThemeStateManagerModule.ThemeStateManager({
            getThemeItems: () => this.themeItems,
            getController: () => this.controller
        });
        this.windowManager = new WindowManagerModule.WindowManager({
            getWindow: () => this.window,
            getContentBox: () => this.contentBox,
            getDownloadsContainer: () => this.downloadsContainer,
            getDownloadsBox: () => this.downloadsBox,
            getNetworkProgressPulseId: () => this.networkProgressPulseId,
            setNetworkProgressPulseId: (id) => {
                this.networkProgressPulseId = id;
            }
        });
        this.previewLoader = new PreviewLoaderModule.PreviewLoader({
            getServerAddress: () => this.getEffectiveServerAddress(),
            getCurrentDir: () => this.getCurrentDir(),
            makeRoundedPixbuf: (pixbuf, width, radius) => this.makeRoundedPixbuf(pixbuf, width, radius)
        });
        this.tabRenderers = new TabRenderersModule.TabRenderers({
            t: (key) => this.translate(key),
            hideNetworkProgress: () => this.hideNetworkProgressBar(),
            clearGridBox: () => this.clearGridBox(),
            ensureThemeGridAttached: () => this.ensureThemeGridAttached(),
            showPlaceholder: (text) => this.showPlaceholder(text),
            createPlaceholderInMainContent: (text) => this.createPlaceholderInMainContent(text),
            detachFromParent: (widget) => this.detachFromParent(widget),
            getMainContentBox: () => this.mainContentBox,
            getGridBox: () => this.gridBox,
            getScrollableGrid: () => this.scrollableGrid,
            getDI: () => this.DI,
            getMoreSectionsView: () => this.moreSectionsView,
            getAboutView: () => this.aboutView
        });
        this.storeHandlers = new StoreHandlersModule.StoreHandlers({
            getController: () => this.controller,
            getCurrentTab: () => this.currentTab,
            updateThemesList: (themes) => this.updateThemesList(themes),
            showPlaceholder: (text) => this.showPlaceholder(text),
            createLoadingSpinner: () => this.createLoadingSpinner(),
            showNetworkProgressBar: () => this.showNetworkProgressBar(),
            hideNetworkProgressBar: () => this.hideNetworkProgressBar(),
            ensureThemeGridAttached: () => this.ensureThemeGridAttached(),
            renderNetworkThemesDirect: (themes, pagination) => {
                this.renderNetworkThemesDirect(themes, pagination);
            },
            updateCurrentThemeStyles: (themeName) => this.updateCurrentThemeStyles(themeName),
            applyDownloadStatesToAllCards: () => this.applyDownloadStatesToAllCards(),
            getGridBox: () => this.gridBox,
            t: (key) => this.translate(key)
        });
    }

    onTabChanged(tab) {
        const nextTab = typeof tab === 'string' ? tab : '';
        const hasChanged = Boolean(nextTab) && nextTab !== this.currentTab;
        this.currentTab = hasChanged ? nextTab : this.currentTab;
        hasChanged
            && [ViewTabName.INSTALLED, ViewTabName.NETWORK].includes(nextTab)
            && this.controller?.handleTabSwitch?.(nextTab);
    }

    getEffectiveServerAddress() {
        const effectiveSettings = (isPlainObject(this.currentSettings) && Object.keys(this.currentSettings).length > 0)
            ? this.currentSettings
            : (isPlainObject(this.getStoreState()?.settings) ? this.getStoreState().settings : {});

        return this.serverAddressOverride
            || effectiveSettings.serverAddress
            || effectiveSettings.serverUrl
            || DEFAULT_SERVER_ADDRESS;
    }

    detachFromParent(widget) {
        widget?.get_parent?.()?.remove(widget);
    }

    getContainer(candidate) {
        return candidate.container?.get ? candidate.container : null;
    }

    getCurrentDir() {
        return this.container?.get?.('currentDir') ?? GLib.get_current_dir();
    }

    tryGetService(serviceName) {
        return this.container?.get?.(serviceName) ?? null;
    }

    getEventBus() {
        const isValidBus = (bus) => bus && typeof bus.emit === 'function' && typeof bus.on === 'function';
        const resolvedBus = isValidBus(this.eventBus) ? this.eventBus : this.tryGetService('eventBus');
        if (isValidBus(resolvedBus)) {
            this.eventBus = resolvedBus;
        }
        return isValidBus(resolvedBus) ? resolvedBus : null;
    }

    rebuildMainLayout() {
        let capturedState = this.windowManager?.captureWindowState?.() || null,
            state = isPlainObject(capturedState) ? capturedState : {},
            shouldRemainVisible = this.isVisible || state.wasVisible;

        this.windowManager?.clearPulseTimer();
        this.contentBox.foreach((child) => {
            this.contentBox.remove(child);
            if (child !== this.mainContentBox && child !== this.downloadsContainer) {
                child?.destroy?.();
            }
        });
        this.localizedElements = [];
        this.networkProgressArea = this.networkProgressBar = null;
        let header = this.createHeaderBox(),
            bottomBar = this.createBottomBar();
        this.networkProgressArea = this.createNetworkProgressArea();
        for (const [widget, property, expand] of [
            [header, 'headerBox', false],
            [this.networkProgressArea, null, false],
            [this.mainContentBox, null, true],
            [bottomBar, 'bottomBar', false],
            [this.downloadsContainer, null, false]
        ].filter(([widget]) => Boolean(widget))) {
            this.contentBox.pack_start(widget, expand, expand, 0);
            if (property) {
                this[property] = widget;
            }
        }

        this.contentBox.show_all();
        this.windowManager?.restoreWindowState(state);
        if (!shouldRemainVisible) {
            this.window?.hide?.();
        }
    }

    getThemesForStoreTab(storeState = null) {
        if (!storeState) return null;
        const themesKey = STORE_TAB_THEME_KEYS[storeState.activeTab];
        return themesKey ? storeState[themesKey] ?? null : null;
    }

    restoreContentAfterWindowCreation() {
        let fromState = this.getThemesForStoreTab(this.getStoreState());
        let themesToRender = Array.isArray(this.themes) && this.themes.length > 0 ? this.themes : fromState;
        [themesToRender, this.pendingThemes].forEach((batch) => {
            Array.isArray(batch) && batch.length > 0 && this.gridBox
                && this.updateThemesList(batch);
        });
        this.pendingThemes = null;
        typeof this.translateWidgetTexts === 'function'
            && this.translateWidgetTexts(this.window);
    }

    clearWidgetReferences() {
        for (const reference of WIDGET_REFERENCE_KEYS) {
            this[reference] = null;
        }
        this.isUploadInProgress = false;
        this.localizedElements = [];
    }

    recreateWindowIfNeeded() {
        const capturedState = this.windowManager?.captureWindowState?.() || null,
            state = isPlainObject(capturedState) ? capturedState : {},
            wasVisible = this.isVisible || state.wasVisible;
        this.windowManager?.clearPulseTimer();
        this.window.destroy?.();
        this.clearWidgetReferences();
        this.resetTweaksViewWidgets();
        this.createWindow();
        this.restoreContentAfterWindowCreation();
        this.windowManager?.restoreWindowState(state);
        if (wasVisible) {
            this.show();
        }
    }

    rebuildForLocalization() {
        const wasVisible = this.isVisible || this.window?.get_visible?.();
        this.recreateWindowIfNeeded();
        if (!wasVisible && this.window) {
            this.window.hide?.();
            this.isVisible = false;
        }
    }

    refreshActiveView() {
        const store = this.controller?.store,
            selectedTheme = store?.get?.('selectedTheme') ?? null,
            settingsFromStore = store?.get?.('settings'),
            currentTheme = store?.get?.('currentTheme')
                || (isPlainObject(settingsFromStore) ? settingsFromStore.theme : null)
                || this.controller?.settingsService?.getCurrentTheme?.()
                || null;

        this.updateMainContent(this.currentTab);
        this.setActiveButtonByTab(this.currentTab);
        this.applyThemeSelection(currentTheme, selectedTheme, store);
        GLib.timeout_add?.(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
            this.applyThemeSelection(currentTheme, selectedTheme, store);
            return GLib.SOURCE_REMOVE;
        });
    }

    applyThemeSelection(currentTheme, selectedTheme, store) {
        currentTheme && (store?.setCurrentTheme?.(currentTheme), this.updateCurrentThemeStyles(currentTheme));
        selectedTheme && store?.selectTheme?.(selectedTheme);
        selectedTheme?.name && selectedTheme.name !== currentTheme && this.updateCurrentThemeStyles(selectedTheme.name);
    }

    openSettingsDialog() {
        this.container.get('appSettingsController').open();
    }

    mapStoreTabToViewTab(tab) {
        return STORE_TAB_TO_VIEW_TAB[tab] || null;
    }

    setActiveButtonByTab(t) {
        this.tabManager?.setActiveButton(t);
    }

    clearGridBox() {
        this.gridBox?.foreach(c => {
            if (c._pulseTimer) {
                GLib.source_remove(c._pulseTimer);
                c._pulseTimer = null;
            }
            this.gridBox.remove(c);
        });
    }

    renderThemesByState(themes, state, messageKeys = {}) {
        const list = Array.isArray(themes) ? themes : [];
        if (this.currentTab === ViewTabName.NETWORK) {
            if (state === THEME_LOADING_STATES.loading) {
                this.showNetworkProgressBar();
            } else {
                this.hideNetworkProgressBar();
            }
        }

        if (list.length > 0) {
            this.updateThemesList(list);
            this.gridBox?.show_all?.();
            return undefined;
        }
        if (state === THEME_LOADING_STATES.loading) {
            this.createLoadingSpinner();
            return undefined;
        }

        const errorKey = messageKeys.errorKey || DEFAULT_PLACEHOLDER_KEYS.errorKey;
        const emptyKey = messageKeys.emptyKey || DEFAULT_PLACEHOLDER_KEYS.emptyKey;
        const placeholderKey = state === THEME_LOADING_STATES.error ? errorKey : emptyKey;
        return this.showPlaceholder(this.translate(placeholderKey));
    }

    renderNetworkThemesDirect(themes, pagination = null) {
        const list = Array.isArray(themes) ? themes : [];
        pagination && this.controller && (
            this.controller.networkPagination = normalizePagination(
                pagination,
                isPlainObject(this.controller.networkPagination) ? this.controller.networkPagination : DEFAULT_NETWORK_PAGINATION,
                list.length));
        this.currentTab !== ViewTabName.NETWORK && (this.currentTab = ViewTabName.NETWORK);

        this.hideNetworkProgressBar();
        this.clearGridBox();
        this.updateThemesList(list);
    }

    openAppSettings() {
        this.getEventBus()?.emit?.(Events.APPSETTINGS_OPEN);
    }

    setProcessManager(pm) {
        this.processManager = pm;
    }

    setupThemeStyleUpdates() {
        const eventBus = this.controller?.eventBus;
        eventBus?.on?.(Events.THEME_APPLY_SUCCESS, (eventData) => {
            const shouldRefreshLocal = Boolean(eventData?.theme?.name)
                && this.currentTab === ViewTabName.INSTALLED;
            if (!shouldRefreshLocal) {
                return;
            }

            GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                TIMEOUTS.DEBOUNCE_MS,
                async () => {
                    await this.controller?.forceRescanLocalThemes?.();
                    const state = this.getStoreState();
                    this.clearGridBox();
                    this.renderThemesByState(
                        state ? state.localThemes : null,
                        state ? state.localLoadingState : null,
                        LOCAL_RELOAD_PLACEHOLDER_KEYS
                    );
                    return GLib.SOURCE_REMOVE;
                }
            );
        });
    }
}
