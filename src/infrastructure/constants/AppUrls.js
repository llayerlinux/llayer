const SERVER_BASE = 'https://llayer.tech';
const THEME_ORG_BASE = 'https://github.com/llayer';
const THEMES_REPOSITORY = `${THEME_ORG_BASE}/lastlayer-themes`;
const SUPPORT_PAGE = 'https://ko-fi.com/llayer';

export const APP_URLS = Object.freeze({
    serverBase: SERVER_BASE,
    themeOrgBase: THEME_ORG_BASE,
    themesRepository: THEMES_REPOSITORY,
    support: SUPPORT_PAGE,
    about: `${SERVER_BASE}/about`,
    thanks: `${SERVER_BASE}/thanks`
});

export const DEFAULT_SERVER_ADDRESS = APP_URLS.serverBase;
export const DEFAULT_SUPPORT_URL = APP_URLS.support;

export function appPageUrl(page = '') {
    const segment = typeof page === 'string' ? page.trim().replace(/^\/+/, '') : '';
    return segment ? `${APP_URLS.serverBase}/${segment}` : APP_URLS.serverBase;
}

export function themeRepositoryUrl(themeName = '') {
    const segment = typeof themeName === 'string' ? themeName.trim() : '';
    return segment ? `${APP_URLS.themeOrgBase}/${segment}` : APP_URLS.themeOrgBase;
}
