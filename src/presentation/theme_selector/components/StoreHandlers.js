import GLib from 'gi://GLib';
import {TabType, ViewTabName} from '../../common/Constants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { THEME_LOADING_STATES, THEME_PLACEHOLDER_KEYS } from '../ThemeSelectorContracts.js';

const SPECIAL_TABS = new Set([
    ViewTabName.MORE_SECTIONS,
    ViewTabName.ABOUT,
    ViewTabName.SETTINGS
]);

export class StoreHandlers {
    constructor(deps) {
        this.getController = deps.getController || (() => null);
        this.getCurrentTab = deps.getCurrentTab || (() => ViewTabName.INSTALLED);
        this.updateThemesList = deps.updateThemesList || (() => {
        });
        this.showPlaceholder = deps.showPlaceholder || (() => {
        });
        this.createLoadingSpinner = deps.createLoadingSpinner || (() => {
        });
        this.showNetworkProgressBar = deps.showNetworkProgressBar || (() => {
        });
        this.hideNetworkProgressBar = deps.hideNetworkProgressBar || (() => {
        });
        this.ensureThemeGridAttached = deps.ensureThemeGridAttached || (() => {
        });
        this.renderNetworkThemesDirect = deps.renderNetworkThemesDirect || null;
        this.updateCurrentThemeStyles = deps.updateCurrentThemeStyles || (() => {
        });
        this.applyDownloadStatesToAllCards = deps.applyDownloadStatesToAllCards || (() => {
        });
        this.getGridBox = deps.getGridBox || (() => null);
        this.t = deps.t || ((k) => k);
        this.lastRenderedLocalCount = 0;
    }

    getTabState() {
        const controller = this.getController();
        const store = controller?.store;
        const activeTab = store?.get('activeTab');
        const currentTab = this.getCurrentTab();
        return {controller, store, activeTab, currentTab};
    }

    isNetworkTab(activeTab, currentTab) {
        return activeTab === TabType.NETWORK || currentTab === ViewTabName.NETWORK;
    }

    isInstalledTab(activeTab, currentTab) {
        return activeTab === TabType.LOCAL
            || activeTab === ViewTabName.INSTALLED
            || currentTab === ViewTabName.INSTALLED;
    }

    isSpecialTab(currentTab) {
        return SPECIAL_TABS.has(currentTab);
    }

    shouldIgnoreLocalThemes(activeTab, currentTab) {
        return this.isNetworkTab(activeTab, currentTab)
            || this.isSpecialTab(currentTab)
            || !this.isInstalledTab(activeTab, currentTab);
    }

    handleLocalThemesChange(themes) {
        if (!Array.isArray(themes)
            || this.shouldIgnoreLocalThemes(this.getTabState().activeTab, this.getTabState().currentTab)) return;

        if (themes.length === 0) {
            this.showPlaceholder(this.t(THEME_PLACEHOLDER_KEYS.installed.emptyKey));
            return;
        }

        this.updateThemesList(themes);
        this.getGridBox()?.show_all?.();
        this.getGridBox()?.queue_draw?.();
    }

    handleLocalLoadingStateChange(state) {
        const {store, activeTab, currentTab} = this.getTabState();
        if (activeTab !== TabType.LOCAL && currentTab !== ViewTabName.INSTALLED) return;

        const themes = Array.isArray(store?.get('localThemes')) ? store.get('localThemes') : [];

        if (state === THEME_LOADING_STATES.loading && themes.length > 0) {
            (this.lastRenderedLocalCount !== themes.length)
                && (this.updateThemesList(themes), this.lastRenderedLocalCount = themes.length);
            return;
        }

        this.clearGridBox(this.getGridBox());
        ({
            [THEME_LOADING_STATES.loading]: () => this.createLoadingSpinner(),
            [THEME_LOADING_STATES.error]: () =>
                this.showPlaceholder(this.t(THEME_PLACEHOLDER_KEYS.installed.errorKey))
        }[state] || (() => {
            themes.length > 0
                && (this.updateThemesList(themes),
                    this.lastRenderedLocalCount = themes.length);
            themes.length === 0
                && this.showPlaceholder(
                    this.t(THEME_PLACEHOLDER_KEYS.installed.emptyKey));
        }))();
    }

    clearGridBox(gridBox) {
        for (const child of gridBox?.get_children?.() || []) {
            child?._pulseTimer && (GLib.source_remove(child._pulseTimer), child._pulseTimer = null);
            gridBox.remove(child);
        }
    }

    handleNetworkThemesChange(themes, pagination = null) {
        const {activeTab, currentTab} = this.getTabState();
        if (!this.isNetworkTab(activeTab, currentTab)) return;
        this.ensureThemeGridAttached();
        (this.renderNetworkThemesDirect
            ? this.renderNetworkThemesDirect(themes, pagination)
            : this.updateThemesList(Array.isArray(themes) ? themes : []));
    }

    handleNetworkLoadingStateChange(state) {
        if (!this.isNetworkTab(this.getTabState().activeTab, this.getTabState().currentTab)) return;

        this.ensureThemeGridAttached();
        const themes = Array.isArray(this.getTabState().store?.get('networkThemes'))
            ? this.getTabState().store.get('networkThemes') : [];

        if (state === THEME_LOADING_STATES.loading) {
            this.showNetworkProgressBar();
            themes.length === 0 && this.createLoadingSpinner();
            return;
        }

        this.hideNetworkProgressBar();
        state === THEME_LOADING_STATES.error
            && this.showPlaceholder(this.t(THEME_PLACEHOLDER_KEYS.network.errorKey));
        state !== THEME_LOADING_STATES.error && themes.length === 0
            && this.showPlaceholder(this.t(THEME_PLACEHOLDER_KEYS.network.emptyKey));
    }

    getCurrentThemeValue(controller) {
        const storeTheme = controller.store?.get('currentTheme');
        const settingsTheme = controller.store?.get('settings')?.theme;
        const currentTheme = controller.settingsService?.getCurrentTheme?.();

        if (storeTheme) return storeTheme;
        settingsTheme && controller.store.setCurrentTheme?.(settingsTheme);
        if (settingsTheme) return settingsTheme;
        return currentTheme ?? null;
    }

    applyCurrentThemeAfterUpdate(themes) {
        if (!this.getController()) return;

        const {currentTheme, selectedThemeName} = {
            currentTheme: this.getCurrentThemeValue(this.getController()),
            selectedThemeName: this.getController().store?.get('selectedTheme')?.name || null
        };
        const applyThemeStyles = () => {
            currentTheme && this.updateCurrentThemeStyles(currentTheme);
            selectedThemeName && selectedThemeName !== currentTheme
                && this.updateCurrentThemeStyles(selectedThemeName);
        };

        currentTheme && this.getController().store?.setCurrentTheme?.(currentTheme);
        if (!currentTheme && !selectedThemeName) return;

        applyThemeStyles();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
            applyThemeStyles();
            this.applyDownloadStatesToAllCards();
            return GLib.SOURCE_REMOVE;
        });
    }
}
