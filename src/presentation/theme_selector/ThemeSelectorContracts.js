import { TabType, ViewTabName } from '../common/Constants.js';
import {
    DEFAULT_PAGINATION,
    normalizePagination,
    toNonNegativeNumber,
    toPositiveNumber
} from '../../infrastructure/utils/PaginationUtils.js';

export const DEFAULT_NETWORK_PAGINATION = DEFAULT_PAGINATION;

export const STORE_TAB_TO_VIEW_TAB = Object.freeze({
    [TabType.LOCAL]: ViewTabName.INSTALLED,
    [TabType.NETWORK]: ViewTabName.NETWORK
});

export const STORE_TAB_THEME_KEYS = Object.freeze({
    [TabType.LOCAL]: 'localThemes',
    [TabType.NETWORK]: 'networkThemes'
});

export const THEME_PLACEHOLDER_KEYS = Object.freeze({
    default: Object.freeze({
        emptyKey: 'THEMES_EMPTY_DEFAULT',
        errorKey: 'THEMES_ERROR_DEFAULT'
    }),
    installed: Object.freeze({
        emptyKey: 'THEMES_EMPTY_INSTALLED',
        errorKey: 'THEMES_ERROR_INSTALLED'
    }),
    network: Object.freeze({
        emptyKey: 'THEMES_EMPTY_NETWORK',
        errorKey: 'THEMES_ERROR_NETWORK'
    })
});

export const THEME_LOADING_STATES = Object.freeze({
    loading: 'loading',
    error: 'error'
});

export {
    normalizePagination,
    toNonNegativeNumber,
    toPositiveNumber
};
