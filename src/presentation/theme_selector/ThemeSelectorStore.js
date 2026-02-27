import {Store} from '../common/Store.js';
import {ViewMode, TabType, LoadingState} from '../common/Constants.js';
import { Events } from '../../app/eventBus.js';
import {
    DEFAULT_NETWORK_PAGINATION,
    normalizePagination
} from './ThemeSelectorContracts.js';

const THEME_SELECTOR_PERSISTED_KEYS = ['activeTab', 'viewMode', 'currentTheme', 'showSettings'];
const isObjectLike = (value) => Boolean(value) && typeof value === 'object';

function normalizeLocalThemes(themes) {
    const byName = new Map(),
        sourceThemes = Array.isArray(themes) ? themes : [];
    for (const theme of sourceThemes) {
        if (!(theme && theme.name) || byName.has(theme.name)) continue;
        byName.set(theme.name, {...theme});
    }

    return Array.from(byName.values()).sort((a, b) =>
        (b.name === 'default') - (a.name === 'default') || a.name.localeCompare(b.name)
    );
}

function parseNetworkThemesPayload(payload) {
    const themes = Array.isArray(payload)
        ? [...payload]
        : (isObjectLike(payload) && Array.isArray(payload.themes) ? [...payload.themes] : []);
    const rawPagination = isObjectLike(payload) && isObjectLike(payload.pagination) ? payload.pagination : null;
    return {
        themes,
        pagination: rawPagination
            ? normalizePagination(rawPagination, DEFAULT_NETWORK_PAGINATION, themes.length)
            : null
    };
}

export class ThemeSelectorStore extends Store {
    constructor() {
        const initialState = {
            activeTab: TabType.LOCAL,
            viewMode: ViewMode.GRID,
            localThemes: [],
            networkThemes: [],
            selectedTheme: null,
            currentTheme: null,
            settings: null,
            localLoadingState: LoadingState.IDLE,
            networkLoadingState: LoadingState.IDLE,
            applyingTheme: false,
            localError: null,
            networkError: null,
            applyError: null,
            showPreview: false,
            previewTheme: null,
            showSettings: false,
            totalLocalThemes: 0,
            localScanProgress: {
                processed: 0,
                total: 0
            },
            updateInfo: null,
            totalNetworkThemes: 0,
            networkPagination: {...DEFAULT_NETWORK_PAGINATION}
        };

        super(initialState);
        this.setupComputedProperties();
        this.setupActions();
    }

    setupComputedProperties() {
        this.computed('currentThemesList', ['activeTab', 'localThemes', 'networkThemes'],
            (activeTab, localThemes, networkThemes) => activeTab === TabType.LOCAL ? localThemes : networkThemes
        );

        this.computed('currentLoadingState', ['activeTab', 'localLoadingState', 'networkLoadingState'],
            (activeTab, localState, networkState) => {
                return activeTab === TabType.LOCAL ? localState : networkState;
            }
        );

        this.computed('currentError', ['activeTab', 'localError', 'networkError'],
            (activeTab, localError, networkError) => {
                return activeTab === TabType.LOCAL ? localError : networkError;
            }
        );
    }

    setupActions() {
        this.action('switchTab', (store, tabType) => {
            store.update({activeTab: tabType});
        });

        this.action('setViewMode', (store, mode) => {
            store.set('viewMode', mode);
        });

        this.action('selectTheme', (store, theme) => {
            store.set('selectedTheme', theme);
        });

        this.action('showPreview', (store, theme) => {
            store.update({
                showPreview: true,
                previewTheme: theme
            });
        });

        this.action('hidePreview', (store) => {
            store.update({
                showPreview: false,
                previewTheme: null
            });
        });

        this.action('toggleSettings', (store) => {
            const current = store.get('showSettings');
            store.set('showSettings', !current);
        });

        this.action('loadLocalThemes', (store, themes) => {
            if (!themes) return;

            const normalizedThemes = normalizeLocalThemes(themes);
            store.set('localThemes', normalizedThemes);
            store.update({
                totalLocalThemes: normalizedThemes.length,
                localLoadingState: LoadingState.SUCCESS,
                localError: null
            });

            store.eventBus?.emit?.(Events.THEMES_LOCAL_UPDATED, {count: normalizedThemes.length});
        });

        this.action('loadNetworkThemes', (store, payload) => {
            const {themes, pagination} = parseNetworkThemesPayload(payload);

            const currentPagination = store.get('networkPagination') || DEFAULT_NETWORK_PAGINATION;
            const nextPagination = pagination ? {...currentPagination, ...pagination} : currentPagination;
            const normalizedTotalItems = typeof nextPagination.totalItems === 'number'
                ? Math.max(nextPagination.totalItems, themes.length)
                : themes.length;

            store.update({
                networkThemes: themes,
                totalNetworkThemes: normalizedTotalItems ?? themes.length,
                networkLoadingState: LoadingState.SUCCESS,
                networkError: null,
                networkPagination: {
                    ...nextPagination,
                    totalItems: normalizedTotalItems,
                    page: nextPagination.page || 1,
                    pageSize: nextPagination.pageSize || 20
                }
            });
        });

        this.action('setLoadingState', (store, type, state, error = null) => {
            const updates = {
                [TabType.LOCAL]: {localLoadingState: state, localError: error},
                [TabType.NETWORK]: {networkLoadingState: state, networkError: error}
            };
            store.update(updates[type] || updates[TabType.NETWORK]);
        });

        this.action('setApplyingTheme', (store, isApplying, error = null) => {
            store.update({
                applyingTheme: isApplying,
                applyError: error
            });
        });

        this.action('setCurrentTheme', (store, theme) => {
            store.set('currentTheme', theme);
        });

        this.action('setSettings', (store, settings) => {
            store.set('settings', settings ? {...settings} : null);
        });

        this.action('setUpdateInfo', (store, updateInfo) => {
            store.set('updateInfo', updateInfo ? {...updateInfo} : null);
        });

        this.action('updateTheme', (store, updatedTheme) => {
            const updateThemeInList = (themes) => {
                const target = (updatedTheme?.name || '').toLowerCase();
                return themes.map(theme => {
                    const currentName = (theme?.name || '').toLowerCase();
                    return currentName === target ? {...theme, ...updatedTheme} : theme;
                });
            };

            const oldLocalThemes = store.get('localThemes');
            const oldNetworkThemes = store.get('networkThemes');

            store.update({
                localThemes: updateThemeInList(oldLocalThemes),
                networkThemes: updateThemeInList(oldNetworkThemes)
            });

            const selectedTheme = store.get('selectedTheme');
            selectedTheme && selectedTheme.name === updatedTheme.name && store.set('selectedTheme', updatedTheme);
        });

        this.action('removeTheme', (store, themeName) => {
            const filterThemes = (themes) => {
                return themes.filter(theme => theme.name !== themeName);
            };

            const localThemes = filterThemes(store.get('localThemes'));
            const networkThemes = filterThemes(store.get('networkThemes'));

            store.update({
                localThemes,
                networkThemes,
                totalLocalThemes: localThemes.length,
                totalNetworkThemes: networkThemes.length,
                selectedTheme: null
            });
        });
    }

    exportState() {
        return THEME_SELECTOR_PERSISTED_KEYS.reduce((acc, key) => {
            acc[key] = this.get(key);
            return acc;
        }, {});
    }

    importState(storedState) {
        const safeState = isObjectLike(storedState) ? storedState : {};
        const stateToImport = {};
        THEME_SELECTOR_PERSISTED_KEYS
            .filter((key) => Object.prototype.hasOwnProperty.call(safeState, key))
            .forEach((key) => {
                stateToImport[key] = safeState[key];
            });
        this.update(stateToImport);
    }

}
