import GLib from 'gi://GLib';
import { TabType, ViewMode } from '../../common/Constants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export function applyThemeSelectorControllerNavigationTabs(targetPrototype) {
    targetPrototype.onTabChanged = async function(newTab) {
        if (this.isInitialized !== true) {
            return undefined;
        }

        switch (newTab) {
        case TabType.NETWORK:
            return this.loadNetworkThemes({
                forceRefresh: true,
                page: this.networkPagination?.page,
                pageSize: this.networkPagination?.pageSize
            });
        case TabType.LOCAL:
            return this.forceRescanLocalThemes();
        default:
            return undefined;
        }
    };

    targetPrototype.refreshThemes = async function() {
        const currentTab = this.store.get('activeTab');
        const normalizedTab = this.parseTabName(currentTab);
        if (normalizedTab === TabType.LOCAL) {
            this.scheduleLocalReload(0);
        } else {
            this.scheduleNetworkReload(0);
        }
    };

    targetPrototype.handleRefresh = async function() {
        const normalizedTab = this.parseTabName(this.store.get('activeTab'));
        const actions = {
            [TabType.LOCAL]: async () => {
                this.timers.clear('localReload');
                await this.forceRescanLocalThemes();
            },
            [TabType.NETWORK]: async () => {
                this.timers.clear('networkReload');
                this.isLoadingNetworkThemes = false;
                await this.loadNetworkThemes({
                    forceRefresh: true,
                    page: this.networkPagination?.page,
                    pageSize: this.networkPagination?.pageSize
                });
            }
        };
        await actions[normalizedTab]?.();
    };

    targetPrototype.goToNetworkPage = async function(page, options = {}) {
        const targetPage = Math.max(1, Number(page));
        const totalPages = this.networkPagination?.totalPages || 0;
        if (totalPages && targetPage > totalPages) {
            return undefined;
        }
        return this.loadNetworkThemes({
            forceRefresh: true,
            page: targetPage,
            pageSize: this.networkPagination?.pageSize,
            append: Boolean(options.append)
        });
    };

    targetPrototype.goToNextNetworkPage = async function() {
        const nextPage = (this.networkPagination?.page || 1) + 1;
        const totalPages = this.networkPagination?.totalPages || 0;
        if (totalPages && nextPage > totalPages) {
            return undefined;
        }
        return this.goToNetworkPage(nextPage, {append: true});
    };

    targetPrototype.goToPrevNetworkPage = async function() {
        const prevPage = (this.networkPagination?.page || 1) - 1;
        if (prevPage < 1) {
            return undefined;
        }
        return this.goToNetworkPage(prevPage, {append: false});
    };

    targetPrototype.toggleViewMode = function() {
        const currentMode = this.store.get('viewMode');
        const newMode = currentMode === ViewMode.GRID ? ViewMode.LIST : ViewMode.GRID;
        this.store.setViewMode(newMode);
    };

    targetPrototype.switchToTab = function(tabType) {
        this.store.switchTab(tabType);
    };

    targetPrototype.handleTabSwitch = async function(tabName) {
        const mapTabName = (name) => {
            switch (name) {
            case 'installed':
                return 'local';
            case 'network':
            case 'rice-contest':
                return 'network';
            default:
                return name;
            }
        };
        const mappedTabName = mapTabName(tabName);

        switch (mappedTabName) {
        case TabType.NETWORK:
            this.switchToTab(mappedTabName);
            if (this.loadingLocalThemes) {
                this.loadingLocalThemes = null;
            }
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_DELAY_SHORT_MS, () => {
                if (this.isInitialized) {
                    this.view.applyDownloadStatesToAllCards();
                }
                return GLib.SOURCE_REMOVE;
            });
            break;
        case TabType.LOCAL: {
            this.switchToTab(mappedTabName);
            await this.forceRescanLocalThemes();
            const state = this.store.getState();
            const refreshed = Array.isArray(state.localThemes) ? state.localThemes : [];
            this.view?.updateThemesList?.(refreshed);
            break;
        }
        default:
            break;
        }
    };

    targetPrototype.selectTheme = function(theme) {
        this.store.selectTheme(theme);
    };

    targetPrototype.storeState = function() {
        return this.store.exportState();
    };
}
