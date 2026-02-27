import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { TabType, ViewTabName, LoadingState } from '../../common/Constants.js';
import { toPositiveNumber } from '../ThemeSelectorContracts.js';

class ThemeSelectorControllerNetworkLoad {
    getInstalledThemeNameSet(localThemes = []) {
        const themes = Array.isArray(localThemes) ? localThemes : [];
        return new Set(
            themes
                .filter((theme) => theme && theme.name)
                .map((theme) => theme.name.toLowerCase())
        );
    }

    markInstalledThemes(themes, installedNames) {
        themes.filter((theme) => theme?.name).forEach((theme) => {
            const normalizedName = theme.name.toLowerCase();
            if (!installedNames.has(normalizedName)) return;

            theme.isLocalWithMetadata = true;
            if (!theme.source || typeof theme.source !== 'string') {
                theme.source = 'LOCAL_WITH_METADATA';
            }
        });
    }

    queuePendingForceRefresh(requestOptions = {}) {
        this.pendingForceRefreshNetworkThemes = {
            forceRefresh: true,
            page: requestOptions.page,
            pageSize: requestOptions.pageSize
        };
    }

    normalizeNetworkLoadResult(result) {
        const themes = result && Array.isArray(result.themes)
            ? result.themes
            : (Array.isArray(result) ? result : []);
        const pagination = result && result.pagination ? result.pagination : null;
        return {themes, pagination};
    }

    applyInstalledFlagsToNetworkThemes(themes) {
        const localThemesRaw = this.store?.get?.('localThemes');
        const localThemes = Array.isArray(localThemesRaw) ? localThemesRaw : [];
        const installedNames = this.getInstalledThemeNameSet(localThemes);
        this.markInstalledThemes(themes, installedNames);
    }

    shouldRenderNetworkTabNow() {
        return this.store?.get?.('activeTab') === TabType.NETWORK || this.view?.currentTab === ViewTabName.NETWORK;
    }

    finalizeNetworkLoadCycle() {
        this.isLoadingNetworkThemes = false;
        const pending = this.pendingForceRefreshNetworkThemes;
        if (!pending) return;

        this.pendingForceRefreshNetworkThemes = null;
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.loadNetworkThemes({...pending, fromCache: false});
            return GLib.SOURCE_REMOVE;
        });
    }

    loadNetworkThemes(options = {}) {
        const requestOptions = this.getNetworkRequestOptions(options);
        const requestedPage = Number(requestOptions.page) || 1;
        const append = Boolean(requestOptions.append);

        if (this.isLoadingNetworkThemes && !options.fromCache) {
            if (options.forceRefresh) {
                this.queuePendingForceRefresh(requestOptions);
            }
            return undefined;
        }

        this.isLoadingNetworkThemes = true;
        this.store.setLoadingState(TabType.NETWORK, LoadingState.LOADING);

        const handleSuccess = (result) => {
            let {themes, pagination} = this.normalizeNetworkLoadResult(result);
            let normalizedThemes = Array.isArray(themes)
                ? themes.map((theme) => ({...theme}))
                : [];
            let currentNetworkThemes = Array.isArray(this.store?.get?.('networkThemes'))
                ? this.store.get('networkThemes')
                : [],
                shouldSkipUpdate = !append
                && !options.forceRefresh
                && !this.haveNetworkThemesChanged(currentNetworkThemes, normalizedThemes);

            if (shouldSkipUpdate) {
                this.store.setLoadingState(TabType.NETWORK, LoadingState.SUCCESS);
                this.view?.hideNetworkProgressBar?.();
                this.finalizeNetworkLoadCycle();
                return;
            }

            this.applyInstalledFlagsToNetworkThemes(normalizedThemes);
            this.applyNetworkThemes(normalizedThemes, pagination, {
                append: append && requestedPage > 1,
                page: (pagination && pagination.page) || requestedPage
            });

            if (this.shouldRenderNetworkTabNow()) {
                this.view?.renderNetworkThemesDirect?.(normalizedThemes, pagination);
            }

            this.store.setLoadingState(TabType.NETWORK, LoadingState.SUCCESS);
            this.finalizeNetworkLoadCycle();
        };

        const handleError = (error) => {
            this.store.setLoadingState(TabType.NETWORK, LoadingState.ERROR, error?.message || null);
            this.finalizeNetworkLoadCycle();
        };

        this.loadNetworkThemesUseCase.executeWithCallback(requestOptions, (error, result) => {
            if (error) {
                handleError(error);
                return;
            }
            handleSuccess(result);
        });
        return undefined;
    }

    getThemeComparisonKey(theme) {
        const innerTheme = theme && typeof theme === 'object' ? theme : null;
        return innerTheme
            ? [
                innerTheme.id !== undefined && innerTheme.id !== null ? String(innerTheme.id) : '',
                (innerTheme.name || innerTheme.title || '').trim().toLowerCase(),
                innerTheme.version ? String(innerTheme.version).trim().toLowerCase() : '',
                innerTheme.updatedAt ? String(innerTheme.updatedAt).trim() : '',
                innerTheme.published ? String(innerTheme.published).trim() : '',
                innerTheme.youtubeLink ? String(innerTheme.youtubeLink).trim() : '',
                innerTheme.repoUrl ? String(innerTheme.repoUrl).trim() : '',
                innerTheme.previewUrl ? String(innerTheme.previewUrl).trim() : ''
            ].join('::')
            : '';
    }

    haveNetworkThemesChanged(currentThemes, nextThemes) {
        const bothArrays = Array.isArray(currentThemes) && Array.isArray(nextThemes);
        return !bothArrays
            || currentThemes.length !== nextThemes.length
            || currentThemes.some((t, i) => this.getThemeComparisonKey(t) !== this.getThemeComparisonKey(nextThemes[i]));
    }

    getNetworkRequestOptions(overrides = {}) {
        const basePage = this.networkPagination?.page ?? 1;
        const basePageSize = this.networkPagination?.pageSize ?? 20;
        const hasOverrides = overrides && typeof overrides === 'object';
        const page = hasOverrides && overrides.page
            ? toPositiveNumber(overrides.page, 1)
            : basePage;
        const pageSize = hasOverrides && overrides.pageSize
            ? toPositiveNumber(overrides.pageSize, 1)
            : basePageSize;
        return {
            ...overrides,
            page,
            pageSize
        };
    }
}

export function applyThemeSelectorControllerNetworkLoad(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerNetworkLoad.prototype);
}
