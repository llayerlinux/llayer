const isObjectLike = (value) => Boolean(value) && typeof value === 'object';

export const DEFAULT_PAGINATION = Object.freeze({
    page: 1,
    pageSize: 20,
    totalPages: 0,
    totalItems: 0
});

export function toPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function toNonNegativeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function paginationFromItems(items, page = 1) {
    const count = Array.isArray(items) ? items.length : 0;
    return {
        page,
        pageSize: count,
        totalPages: count ? 1 : 0,
        totalItems: count
    };
}

export function normalizePagination(rawPagination, fallbackPagination = DEFAULT_PAGINATION, itemsCount = 0) {
    const fb = isObjectLike(fallbackPagination) ? fallbackPagination : DEFAULT_PAGINATION,
        input = isObjectLike(rawPagination) ? rawPagination : {},
        fbItems = Math.max(toNonNegativeNumber(fb.totalItems, 0), itemsCount);

    return {
        page: toPositiveNumber(input.page, toPositiveNumber(fb.page, DEFAULT_PAGINATION.page)),
        pageSize: toPositiveNumber(input.pageSize, toPositiveNumber(fb.pageSize, DEFAULT_PAGINATION.pageSize)),
        totalPages: toNonNegativeNumber(input.totalPages, toNonNegativeNumber(fb.totalPages, DEFAULT_PAGINATION.totalPages)),
        totalItems: Math.max(toNonNegativeNumber(input.totalItems, fbItems), itemsCount)
    };
}
