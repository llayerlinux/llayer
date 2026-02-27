import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import { tryOrNull } from '../utils/ErrorUtils.js';
import { normalizeThemeStats } from '../utils/Utils.js';
import { DEFAULT_SERVER_ADDRESS } from '../constants/AppUrls.js';
import { normalizePagination, paginationFromItems } from '../utils/PaginationUtils.js';

const NETWORK_THEME_SEARCH_PAGE_SIZE = 100;

function asThemeList(response) {
    if (Array.isArray(response)) return response;
    return response && Array.isArray(response.items) ? response.items : [];
}

function responsePagination(response, rawThemes) {
    if (!Array.isArray(response) && response && response.pagination) {
        let fallback = {
            page: 1,
            pageSize: rawThemes.length || 20,
            totalPages: rawThemes.length ? 1 : 0,
            totalItems: rawThemes.length
        };
        return normalizePagination(response.pagination, fallback, rawThemes.length);
    }
    if (Array.isArray(response)) {
        return paginationFromItems(rawThemes, 1);
    }
    return null;
}

function findThemeByName(themes, targetName) {
    if (!Array.isArray(themes) || !targetName) return null;
    return themes.find((theme) => (theme?.name || theme?.title || '').trim().toLowerCase() === targetName) || null;
}

class ThemeRepositoryNetwork {
    convertToEntityResponse(response) {
        const rawThemes = asThemeList(response);
        const entities = rawThemes.map((theme) => this.createNetworkThemeEntity(theme)).filter(Boolean);
        return {
            themes: entities,
            pagination: responsePagination(response, rawThemes)
        };
    }

    refreshThemesFromServer(service, effectiveServerUrl, options, callbackFn) {
        if (!effectiveServerUrl) {
            callbackFn(new Error('Server address is not configured'), null);
            return;
        }

        service.themeCacheService?.clearCache?.();
        service.loadThemesFromServerWithCallback(effectiveServerUrl, options, (error, response) => {
            if (error) {
                this.logWarn('loadThemesFromServerWithCallback error', {error: error.message});
                callbackFn(error, null);
                return;
            }
            callbackFn(null, this.convertToEntityResponse(response));
        });
    }

    getNetworkThemesWithCallback(serverUrl = null, options = {}, callback) {
        const callbackFn = typeof callback === 'function' ? callback : () => {};
        const service = this.networkThemeService;
        if (!service) {
            callbackFn(new Error('NetworkThemeService is not available'), null);
            return;
        }

        const forceRefresh = !!options.forceRefresh;
        const effectiveServerUrl = serverUrl
            || service.settingsService?.getNetworkThemeSettings?.()?.serverAddress
            || null;
        if (forceRefresh) {
            this.refreshThemesFromServer(service, effectiveServerUrl, options, callbackFn);
            return;
        }

        callbackFn(null, this.convertToEntityResponse(service.fetchThemes(options)));
    }

    getNetworkThemes(serverUrl = null, options = {}) {
        return new Promise((complete, fail) => {
            this.getNetworkThemesWithCallback(serverUrl, options, (error, result) => {
                error ? fail(error) : complete(result);
            });
        });
    }

    async getNetworkThemeByName(name, serverUrl = null) {
        let targetName = (typeof name === 'string' ? name.trim().toLowerCase() : '');
        if (!targetName) return null;

        let service = this.networkThemeService;
        if (!service) return null;

        let actualServerUrl = serverUrl || service.settingsService.getNetworkThemeSettings().serverAddress;
        let cachedMatch = findThemeByName(service.themeCacheService?.loadFromCache?.(actualServerUrl)?.themes, targetName);
        if (cachedMatch) return this.createNetworkThemeEntity({ ...cachedMatch, serverUrl: actualServerUrl });

        let page = 1;
        while (true) {
            let response = await service.loadThemesFromServer(actualServerUrl, {
                page,
                pageSize: NETWORK_THEME_SEARCH_PAGE_SIZE
            }).catch((e) => {
                this.logWarn('getNetworkThemeByName server load failed', {page, error: e.message});
                return null;
            });

            if (!response) return null;

            let themes = asThemeList(response);
            let matched = findThemeByName(themes, targetName);
            if (matched) {
                matched.serverUrl = actualServerUrl;
                service.themeCacheService?.writeCache?.(themes, actualServerUrl, response?.pagination || null);
                return this.createNetworkThemeEntity(matched);
            }

            let totalPages = Number(response?.pagination?.totalPages) || 0;
            if (!totalPages || page >= totalPages) return null;
            page += 1;
        }
    }

    async getNetworkThemeById(themeId, serverUrl = null) {
        let id = typeof themeId === 'string' ? parseInt(themeId, 10) : themeId;
        if (!(id > 0) || !this.networkThemeService?.fetchThemeById) return null;

        let actualServerUrl = (serverUrl
            || this.networkThemeService?.settingsService?.getNetworkThemeSettings?.()?.serverAddress
            || DEFAULT_SERVER_ADDRESS).replace(/\/$/, '');

        return this.networkThemeService.fetchThemeById(actualServerUrl, id)
            .then(theme => theme ? this.createNetworkThemeEntity({...theme, serverUrl: actualServerUrl}) : null)
            .catch((e) => {
                this.logWarn('getNetworkThemeById server load failed', {id, error: e?.message});
                return null;
            });
    }

    createNetworkThemeEntity(theme) {
        const safe = theme ?? {};

        const entity = {
            name: safe.name || safe.title || 'unknown-theme',
            title: safe.title || safe.name || this.translate('UNKNOWN_THEME'),
            description: safe.description || '',
            icon: safe.preview || safe.previewUrl || safe.icon || null,
            preview: safe.preview || safe.previewUrl || safe.icon || null,
            previewUrl: safe.previewUrl || safe.preview || null,
            url: safe.archiveUrl || safe.url || null,
            archiveUrl: safe.archiveUrl || safe.url || null,
            repoUrl: safe.repoUrl || '',
            published: safe.published || '',
            youtubeLink: safe.youtubeLink || '',
            author: safe.author || null,
            adaptedBy: safe.adaptedBy || null,
            properties: this.parseObject(safe.properties),
            tags: Array.isArray(safe.tags) ? safe.tags : [],
            packageSupport: Array.isArray(safe.packageSupport) ? safe.packageSupport : [],
            installScripts: Array.isArray(safe.installScripts) ? safe.installScripts : [],
            ...normalizeThemeStats(safe),
            id: safe.id || null,
            source: 'network',
            serverUrl: safe.serverUrl || null,
            isNetwork: true,
            isLocalWithMetadata: false,
            includes: safe.includes || null,
            isLocal() {
                return false;
            }
        };

        return entity;
    }

    parseObject(value) {
        const parsed = typeof value === 'string' && value.length > 0
            ? tryOrNull('ThemeRepositoryNetwork.parseObject', () => JSON.parse(value))
            : (typeof value === 'object' ? value : {});
        return (parsed && typeof parsed === 'object') ? parsed : {};
    }

    setNetworkThemeService(networkThemeService) {
        this.networkThemeService = networkThemeService;
    }

    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
}

export function applyThemeRepositoryNetwork(prototype) {
    copyPrototypeDescriptors(prototype, ThemeRepositoryNetwork.prototype);
}
