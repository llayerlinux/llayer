import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import * as ThemeSelectorEventsModule from '../components/ThemeSelectorEvents.js';
import * as ThemesGridModule from '../components/ThemesGrid.js';
import * as WidgetFactoryModule from '../components/WidgetFactory.js';
import { THEME_LOADING_STATES, THEME_PLACEHOLDER_KEYS } from '../ThemeSelectorContracts.js';

const TWEAKS_VIEW_WIDGET_KEYS = [
    'tweaksNotebookGlobal',
    'basicOuterGlobal',
    'tweaksBoxGlobal',
    'advancedOuterGlobal',
    'pluginsOuterGlobal',
    'pluginsListBox',
    'pluginsListContainer'
];

const {Box} = WidgetFactoryModule;
const callIfFunction = (fn, fallback = undefined) => (typeof fn === 'function' ? fn() : fallback);
const THEME_TAB_CONFIGS = {
    installed: {
        isNetwork: false,
        themesKey: 'localThemes',
        loadingStateKey: 'localLoadingState',
        ...THEME_PLACEHOLDER_KEYS.installed
    },
    network: {
        isNetwork: true,
        themesKey: 'networkThemes',
        loadingStateKey: 'networkLoadingState',
        ...THEME_PLACEHOLDER_KEYS.network
    }
};

export function applyThemeSelectorViewStore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewStore.prototype);
}

class ThemeSelectorViewStore {
    getTweaksController() {
        return this.DI?.get?.('tweaksController') ?? null;
    }

    exitTweaksTab() {
        this.getTweaksController()?.view?.exitTweaksTab?.();
    }

    resetTweaksViewWidgets() {
        const view = this.getTweaksController()?.view;
        view && TWEAKS_VIEW_WIDGET_KEYS.forEach(k => view[k] = null);
    }

    getTabRenderers() {
        return {
            installed: () => this.renderInstalledTab(),
            network: () => this.renderNetworkTab(),
            settings: () => this.renderSettingsTab(),
            'more-sections': () => this.renderMoreSectionsTab(),
            about: () => this.renderAboutTab()
        };
    }

    handleTabSwitch(t) {
        this.tabManager.setRenderers(this.getTabRenderers());
        this.tabManager.switchTo(t);
        this.currentTab = this.tabManager.getCurrentTab();
        this.bottomBarComponent?.setContextTab?.(this.currentTab);
    }

    updateMainContent(t) {
        const renderer = this.getTabRenderers()[t];
        if (renderer) {
            renderer();
            return;
        }

        this.clearGridBox();
        this.showPlaceholder(this.translate(THEME_PLACEHOLDER_KEYS.default.emptyKey));
    }

    createThemeTabMessages(config) {
        return {
            emptyKey: config.emptyKey,
            errorKey: config.errorKey
        };
    }

    getThemesForConfig(state, config) {
        return Array.isArray(state?.[config.themesKey]) ? state[config.themesKey] : [];
    }

    renderThemeListOrState(themes, state, config) {
        this.renderThemesByState(themes, state, this.createThemeTabMessages(config));
    }

    async loadMissingNetworkThemes(config) {
        this.renderThemeListOrState([], THEME_LOADING_STATES.loading, config);
        await callIfFunction(config.loadFn);
    }

    async loadMissingInstalledThemes(config) {
        this.createLoadingSpinner();
        await callIfFunction(config.rescanFn);
        const updatedState = this.controller.store.getState();
        const updatedThemes = this.getThemesForConfig(updatedState, config);
        this.clearGridBox();
        this.renderThemeListOrState(updatedThemes, updatedState?.[config.loadingStateKey], config);
    }

    async renderThemeTab(cfg) {
        let config = cfg || {};
        !config.isNetwork && this.hideNetworkProgressBar();

        this.resetMainContentBoxForTheme();
        this.ensureThemeGridAttached();
        this.clearGridBox();

        let state = this.controller.store.getState(),
            themes = this.getThemesForConfig(state, config);
        if (themes.length > 0) {
            this.renderThemeListOrState(themes, state?.[config.loadingStateKey], config);
            return;
        }

        if (config.isNetwork) {
            await this.loadMissingNetworkThemes(config);
            return;
        }

        await this.loadMissingInstalledThemes(config);
    }

    async renderInstalledTab() {
        const config = {
            ...THEME_TAB_CONFIGS.installed,
            rescanFn: () => callIfFunction(this.controller.forceRescanLocalThemes?.bind(this.controller), Promise.resolve())
        };
        await this.renderThemeTab(config);
    }

    async renderNetworkTab() {
        const config = {
            ...THEME_TAB_CONFIGS.network,
            loadFn: () => callIfFunction(this.controller.loadNetworkThemes?.bind(this.controller), Promise.resolve())
        };
        await this.renderThemeTab(config);
    }

    renderSettingsTab() {
        this.tabRenderers?.renderSettings?.();
    }

    renderMoreSectionsTab() {
        this.tabRenderers?.renderMoreSections?.();
    }

    renderAboutTab() {
        this.tabRenderers?.renderAbout?.();
    }

    subscribeToStore() {
        this.needsStoreSubscription = false;
        let view = this,
            store = this.controller.store;

        this.eventsComponent = new ThemeSelectorEventsModule.ThemeSelectorEvents({
            eventBus: view.controller.eventBus,
            store,
            handlers: {
                onLocalThemesChanged: (themes) => {
                    if (!themes) return;
                    if (view.gridBox) {
                        view.handleLocalThemesChange(themes);
                        return;
                    }
                    view.pendingThemes = themes;
                },
                onNetworkThemesChanged: (themes) => {
                    view.handleNetworkThemesChange(themes, store.get('networkPagination'));
                },
                onLocalLoadingStateChanged: (state) => view.handleLocalLoadingStateChange(state),
                onNetworkLoadingStateChanged: (state) => view.handleNetworkLoadingStateChange(state),
                onCurrentThemeChanged: (themeName) => {
                    if (!themeName || (themeName === 'default' && view._defaultThemeStale)) return;
                    view.updateCurrentThemeStyles(themeName);
                },
                onSelectedThemeChanged: (theme) => {
                    const themeName = theme?.name;
                    if (!themeName || (themeName === 'default' && view._defaultThemeStale)) return;
                    view.updateCurrentThemeStyles(themeName);
                },
                onActiveTabChanged: (tab) => view.handleActiveTabChanged(tab)
            }
        });
        this.eventsComponent.subscribe();
    }

    handleActiveTabChanged(tab) {
        const mapped = this.mapStoreTabToViewTab(tab);
        mapped && mapped !== this.currentTab && this.handleTabSwitch(mapped);
    }

    createThemesList(themes) {
        if (!Array.isArray(themes) || !this.gridBox) {
            return;
        }
        this.themeItemComponent?.clearClickStates?.();
        this.ensureThemesGridComponent();
        const r = this.themesGridComponent.render(themes, this.gridBox);
        this.cardsByTab = r.cardsByTab;
        this.themeItems = r.themeItems;
    }

    ensureThemesGridComponent() {
        const canCreateGrid = !this.themesGridComponent && ThemesGridModule?.ThemesGrid;
        if (!canCreateGrid) return;

        this.themesGridComponent = new ThemesGridModule.ThemesGrid({
            Box,
            createThemeItem: (theme) => this.createThemeItem(theme),
            getCurrentTab: () => this.currentTab,
            onRenderComplete: (cardsByTab, themeItems) => {
                this.cardsByTab = cardsByTab;
                this.themeItems = themeItems;
                callIfFunction(this.applyDownloadStatesToAllCards?.bind(this));
            }
        });
    }

    updateThemesList(themes) {
        this.themes = themes;
        this.createThemesList(themes);
        this.lastRenderedLocalCount = Array.isArray(themes) ? themes.length : 0;
        this.storeHandlers?.applyCurrentThemeAfterUpdate?.(themes);
    }

    handleLocalThemesChange(t) {
        this.storeHandlers?.handleLocalThemesChange?.(t);
    }

    handleLocalLoadingStateChange(s) {
        this.storeHandlers?.handleLocalLoadingStateChange?.(s);
    }

    handleNetworkThemesChange(t, p) {
        this.storeHandlers?.handleNetworkThemesChange?.(t, p);
    }

    handleNetworkLoadingStateChange(s) {
        this.storeHandlers?.handleNetworkLoadingStateChange?.(s);
    }

    ensureThemeGridAttached() {
        this.detachFromParent(this.scrollableGrid);
        if (!this.scrollableGrid.get_parent()) {
            this.mainContentBox.pack_start(this.scrollableGrid, true, true, 0);
        }
        this.scrollableGrid?.show_all?.();
        this.mainContentBox?.show_all?.();
    }

    resetMainContentBoxForTheme() {
        const toRemove = [];
        this.mainContentBox.foreach(c => c !== this.scrollableGrid && toRemove.push(c));
        toRemove.forEach(c => this.mainContentBox.remove(c));
    }

    setDownloadState(n, s) {
        this.themeStateManager?.setDownloadState?.(n, s);
    }

    updateItemDownloadProgress(n, p) {
        this.themeStateManager?.updateProgress?.(n, p);
    }

    ensureActiveDownloadOverlays() {
        this.themeStateManager?.applyToAllCards?.();
    }

    applyDownloadStatesToAllCards() {
        this.themeStateManager?.applyToAllCards?.();
    }

    applyDownloadStateToCard(n, s) {
        this.themeStateManager?.applyStateToCard?.(n, s);
    }

    loadNetworkThemePreview(t, w, x, y) {
        this.previewLoader?.loadNetworkPreview?.(t, w, x, y);
    }
}
