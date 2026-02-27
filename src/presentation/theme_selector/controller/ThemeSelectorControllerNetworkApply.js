import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import {
    DEFAULT_NETWORK_PAGINATION,
    normalizePagination,
    toNonNegativeNumber,
    toPositiveNumber
} from '../ThemeSelectorContracts.js';

const THEME_KEY_EXTRACTORS = [
    [theme => theme.id != null, theme => `id:${theme.id}`],
    [theme => theme.name, theme => `name:${String(theme.name).toLowerCase()}`],
    [theme => theme.title, theme => `title:${String(theme.title).toLowerCase()}`]
];
const INVALID_THEME_KEY = Symbol('invalid-theme');

const isObject = (value) => Boolean(value) && typeof value === 'object';

function getSafeOptions(options) {
    return isObject(options) ? options : {};
}

function resolveRequestedPage(options) {
    return options.page ? Number(options.page) : null;
}

function normalizePaginationWithResponse(pagination, previous, requestedPage, themeCount) {
    const responseFallback = {
        ...previous,
        page: requestedPage ?? previous.page ?? 1
    };
    return normalizePagination(pagination, responseFallback, themeCount);
}

function normalizePaginationWithoutResponse(previous, requestedPage, append) {
    const normalized = normalizePagination(null, previous, 0);
    normalized.page = requestedPage || (append ? (normalized.page ?? 1) + 1 : normalized.page);
    normalized.pageSize = toPositiveNumber(normalized.pageSize, previous.pageSize ?? 20);
    return normalized;
}

function resolveThemeKey(theme) {
    if (!isObject(theme)) return INVALID_THEME_KEY;
    const extractor = THEME_KEY_EXTRACTORS.find(([check]) => check(theme));
    return extractor ? extractor[1](theme) : null;
}

function mergeThemes(existingThemes, incomingThemes) {
    const mergedMap = new Map(),
          pushTheme = (theme) => {
              const key = resolveThemeKey(theme);
              key !== INVALID_THEME_KEY && mergedMap.set(key ?? Symbol('theme'), theme);
          };
    existingThemes.forEach(pushTheme);
    incomingThemes.forEach(pushTheme);
    return Array.from(mergedMap.values());
}

function finalizePagination(nextPagination, storePagination, combinedCount) {
    if (isObject(storePagination)) return normalizePagination(storePagination, nextPagination, combinedCount);

    const fallbackPagination = {...nextPagination};
    fallbackPagination.totalItems = Math.max(toNonNegativeNumber(fallbackPagination.totalItems, 0), combinedCount);
    fallbackPagination.totalPages = Math.max(
        toNonNegativeNumber(fallbackPagination.totalPages, 0),
        fallbackPagination.pageSize > 0
            ? Math.ceil(fallbackPagination.totalItems / fallbackPagination.pageSize)
            : toNonNegativeNumber(fallbackPagination.totalPages, 0)
    );
    return fallbackPagination;
}

class ThemeSelectorControllerNetworkApply {
    applyNetworkThemes(themes, pagination = null, options = {}) {
        const themeArray = Array.isArray(themes) ? themes : [];
        const safeOptions = getSafeOptions(options);
        const append = Boolean(safeOptions.append);
        const requestedPage = resolveRequestedPage(safeOptions);
        const prevPagination = this.networkPagination || DEFAULT_NETWORK_PAGINATION;
        const hasPagination = isObject(pagination);
        const nextPagination = hasPagination
            ? normalizePaginationWithResponse(pagination, prevPagination, requestedPage, themeArray.length)
            : normalizePaginationWithoutResponse(prevPagination, requestedPage, append);

        const networkThemes = this.store?.get?.('networkThemes');
        const existingThemes = append && Array.isArray(networkThemes) ? networkThemes : [];
        const combinedThemes = mergeThemes(existingThemes, themeArray);

        this.store.loadNetworkThemes({
            themes: combinedThemes
        });
        this.synchronizeLocalThemesWithNetwork(combinedThemes);
        this.refreshLocalThemeStats();

        const combinedCount = combinedThemes.length;
        const storePagination = this.store?.get?.('networkPagination');
        this.networkPagination = finalizePagination(nextPagination, storePagination, combinedCount);
    }
}

export function applyThemeSelectorControllerNetworkApply(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerNetworkApply.prototype);
}
