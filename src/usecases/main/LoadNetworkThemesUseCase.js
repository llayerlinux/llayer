import {
    normalizePagination,
    paginationFromItems,
    DEFAULT_PAGINATION
} from '../../infrastructure/utils/PaginationUtils.js';

export class LoadNetworkThemesUseCase {
    constructor(themeRepository, settingsService, logger, eventBus) {
        this.themeRepository = themeRepository;
        this.settingsService = settingsService;
        this.logger = logger || null;
        this.eventBus = eventBus || null;
    }

    readNumberOption(value, defaultValue, min = 1) {
        return Math.max(min, Number.isFinite(Number(value)) ? Number(value) : defaultValue);
    }

    standardizeResponse(response, page, pageSize) {
        if (!response) {
            return {
                themes: [],
                pagination: normalizePagination(
                    {page, pageSize, totalPages: 0, totalItems: 0},
                    DEFAULT_PAGINATION,
                    0
                )
            };
        }

        if (Array.isArray(response)) {
            return {
                themes: response,
                pagination: paginationFromItems(response, 1)
            };
        }

        const items = Array.isArray(response.items)
            ? response.items
            : (Array.isArray(response.themes) ? response.themes : []);
        const fallbackPagination = {
            page,
            pageSize,
            totalPages: 0,
            totalItems: items.length
        };
        const rawPagination = response.pagination || {
            page: response.page,
            pageSize: response.pageSize,
            totalPages: response.totalPages,
            totalItems: response.totalItems
        };

        return {
            themes: items,
            pagination: normalizePagination(rawPagination, fallbackPagination, items.length)
        };
    }

    executeWithCallback(options = {}, callback) {
        const callbackFn = typeof callback === 'function' ? callback : () => {};

        const forceRefresh = Boolean(options?.forceRefresh);
        const cacheOnly = Boolean(options?.cacheOnly);
        const networkSettings = this.settingsService.getNetworkThemeSettings();
        const defaultPageSize = this.readNumberOption(networkSettings?.pageSize, 20);
        const page = this.readNumberOption(options?.page, 1);
        const pageSize = this.readNumberOption(options?.pageSize, defaultPageSize);
        const serverAddress = this.settingsService.getServerAddress();

        if (cacheOnly) {
            const cached = this.themeRepository.networkThemeService.fetchThemes({page, pageSize});
            return this.standardizeResponse(cached, page, pageSize);
        }

        this.themeRepository.getNetworkThemesWithCallback(serverAddress, {
            forceRefresh,
            page,
            pageSize
        }, (error, response) => {
            if (error) {
                callbackFn(error, null);
                return;
            }

            const normalized = this.standardizeResponse(response, page, pageSize);
            callbackFn(null, normalized);
        });
        return undefined;
    }

    async execute(options = {}) {
        return new Promise((complete, fail) => {
            this.executeWithCallback(options, (error, result) => {
                error ? fail(error) : complete(result);
            });
        });
    }

}
