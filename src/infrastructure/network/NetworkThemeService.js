import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=2.4';
import { parseStringList, standardizeNumber, standardizeOptionalNumber, firstNonEmptyString } from '../utils/Utils.js';
import { THEME_PROPERTY_FLAGS } from '../constants/ThemeProperties.js';
import { TRUTHY_STRINGS } from '../constants/BooleanValues.js';
import { tryOrNull } from '../utils/ErrorUtils.js';

const toTrimmedString = (value) => typeof value === 'string' ? value.trim() : '';
const toBool = (v) => typeof v === 'boolean' ? v :
    (typeof v === 'string' ? TRUTHY_STRINGS.includes(v.trim().toLowerCase()) : !!v);

const isUnknownAuthorName = (name) => !name || name.toLowerCase() === 'unknown';

const parseAuthor = (author) => {
    const name = toTrimmedString(typeof author !== 'object' || !author
        ? author : firstNonEmptyString(author?.label, author?.name, author?.login));
    if (isUnknownAuthorName(name)) return null;

    return typeof author !== 'object' || !author
        ? { name, label: name, url: '', avatar: null }
        : {
            name,
            label: name,
            url: firstNonEmptyString(author.url, author.html_url) || '',
            avatar: firstNonEmptyString(author.avatar, author.avatar_url)
        };
};

const parseStringProps = (value) => {
    const text = toTrimmedString(value);
    if (!text) return {};

    if (text.startsWith('{') || text.startsWith('[')) {
        const parsed = tryOrNull('NetworkThemeService.parseStringProps', () => JSON.parse(text));
        if (parsed && typeof parsed === 'object') return parsed;
    }

    return Object.fromEntries(text.split(',').map(s => s.trim()).filter(Boolean).map(k => [k, true]));
};

const arrayToPropsObject = (arr) => arr.reduce((acc, entry) => {
    switch (typeof entry) {
    case 'string':
        acc[entry] = true;
        return acc;
    case 'object':
        entry && Object.keys(entry).filter(k => entry[k]).forEach(k => acc[k] = true);
        return acc;
    default:
        return acc;
    }
}, {});

const createEmptyPagination = (page, pageSize) => ({
    page,
    pageSize,
    totalPages: 0,
    totalItems: 0
});

const toPositiveNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isAbsoluteUrl = (url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
const isFileUrl = (url) => typeof url === 'string' && (url.startsWith('file://') || url.startsWith('file:/'));
const pickThemeField = (theme, ...keys) =>
    keys.map((key) => theme?.[key]).find(v => v !== undefined && v !== null && v !== '');
const ensureArray = (value) => Array.isArray(value) ? value : [];
const isObjectLike = (value) => Boolean(value) && typeof value === 'object';
const resolvePublishedValue = (theme) => firstNonEmptyString(theme?.published, theme?.publicated) || '';

function toServerUrlFactory(cleanServer) {
    return (url) => {
        if (!url || isAbsoluteUrl(url)) return url;

        if (isFileUrl(url)) {
            let filePath = url.startsWith('file://') ? url.slice(7) : url.slice(6);
            let marker = ['/themesLinx', '/uploads'].find(m => filePath.includes(m));
            return marker ? `${cleanServer}${filePath.substring(filePath.indexOf(marker))}` : url;
        }

        return `${cleanServer}/${url.startsWith('/') ? url.slice(1) : url}`;
    };
}

function resolveBaseThemeProps(rawProps) {
    if (!rawProps) return {};
    if (typeof rawProps === 'string') return parseStringProps(rawProps);
    if (Array.isArray(rawProps)) return arrayToPropsObject(rawProps);
    return typeof rawProps === 'object' ? rawProps : {};
}

function parseThemeProperties(rawProps, rawTheme) {
    let normalized = Object.fromEntries(
        Object.entries(resolveBaseThemeProps(rawProps))
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, toBool(value)])
    );

    THEME_PROPERTY_FLAGS
        .filter((flag) => rawTheme && Object.prototype.hasOwnProperty.call(rawTheme, flag))
        .forEach((flag) => { normalized[flag] = !!rawTheme[flag]; });

    rawTheme?.isExistsScripts !== undefined
        && (normalized.isExistsScripts = !!rawTheme.isExistsScripts);

    return normalized;
}

function normalizeParsedPagination(parsedPayload, defaultPage, defaultPageSize, themesLength) {
    if (Array.isArray(parsedPayload)) {
        return {
            page: defaultPage,
            pageSize: defaultPageSize,
            totalPages: themesLength ? 1 : 0,
            totalItems: themesLength
        };
    }

    return {
        page: Number(parsedPayload.page) || defaultPage,
        pageSize: Number(parsedPayload.pageSize) || defaultPageSize,
        totalPages: Number(parsedPayload.totalPages) || 0,
        totalItems: Number(parsedPayload.totalItems) || themesLength
    };
}

function normalizeCachedPagination(cachedData, themes) {
    return cachedData.pagination || {
        page: 1,
        pageSize: themes.length,
        totalPages: 1,
        totalItems: themes.length
    };
}

function isThemeRecord(theme) {
    return isObjectLike(theme) && typeof (theme.name || theme.title) === 'string';
}

function buildThemeLinks(theme, toServerUrl) {
    const archiveUrl = toServerUrl(pickThemeField(theme, 'archiveUrl', 'archive_url', 'archive', 'url'));
    const downloadUrl = toServerUrl(pickThemeField(
        theme,
        'downloadUrl',
        'download_url',
        'archiveUrl',
        'archive_url',
        'archive',
        'url'
    ));
    const previewUrl = toServerUrl(pickThemeField(theme, 'previewUrl', 'preview'));
    return {archiveUrl, downloadUrl, previewUrl};
}

function buildProcessedTheme(theme, toServerUrl, serverUrl) {
    const {archiveUrl, downloadUrl, previewUrl} = buildThemeLinks(theme, toServerUrl);
    const publishedValue = resolvePublishedValue(theme);

    return {
        id: theme.id,
        name: firstNonEmptyString(theme.name, theme.title),
        title: firstNonEmptyString(theme.title, theme.name),
        description: theme.description || '',
        preview: previewUrl,
        previewUrl,
        url: archiveUrl,
        archiveUrl,
        downloadUrl,
        repoUrl: theme.repoUrl,
        published: publishedValue,
        publicated: publishedValue,
        youtubeLink: theme.youtubeLink || '',
        version: theme.version || '1.0',
        author: parseAuthor(theme.author),
        tags: parseStringList(theme.tags),
        lastModified: theme.lastModified || theme.updated,
        size: theme.size || 0,
        properties: parseThemeProperties(theme.properties, theme),
        adaptedBy: theme.adaptedBy || null,
        downloadCount: standardizeNumber(theme.downloadCount),
        averageInstallMs: standardizeOptionalNumber(theme.averageInstallMs),
        averageApplyMs: standardizeOptionalNumber(theme.averageApplyMs),
        installCount: standardizeNumber(theme.installCount, 0),
        applyCount: standardizeNumber(theme.applyCount, 0),
        isNetwork: true,
        serverUrl,
        packageSupport: parseStringList(theme.packageSupport),
        includes: theme.includes || null
    };
}

export class NetworkThemeService {
    constructor(settingsService, themeCacheService, logger = null) {
        this.settingsService = settingsService;
        this.themeCacheService = themeCacheService;
        this.logger = logger;
        this.defaultPageSize = 20;
        this.lastPagination = null;
    }

    warn(message, payload = null) {
        this.logger?.warn?.(message, payload ?? {});
    }

    getSettings() {
        return this.settingsService?.getNetworkThemeSettings?.() ?? {};
    }

    getServerAddress(settings) {
        return typeof settings?.serverAddress === 'string' ? settings.serverAddress : null;
    }

    standardizeServerUrl(serverUrl) {
        return typeof serverUrl !== 'string'
            ? serverUrl
            : (serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl);
    }

    getRequestTimeoutSeconds(settings) {
        return Math.max(5, Number(settings?.requestTimeout) || 20);
    }

    createSession(timeoutSeconds) {
        const session = new Soup.Session();
        session.timeout = timeoutSeconds;
        session.idle_timeout = timeoutSeconds;
        return session;
    }

    createRequestMessage(method, url) {
        const message = Soup.Message.new(method, url);
        message.request_headers.append('Connection', 'close');
        message.request_headers.append('Accept', 'application/json');
        return message;
    }

    async getThemeInfo(themeId) {
        const settings = this.getSettings();
        const serverUrl = this.getServerAddress(settings);
        if (!themeId || !serverUrl) return null;
        return this.fetchThemeById(serverUrl, themeId).catch(() => null);
    }

    fetchThemes({page = 1, pageSize = this.defaultPageSize} = {}) {
        const settings = this.getSettings();
        const serverUrl = this.getServerAddress(settings);
        const cachedData = this.themeCacheService.loadFromCache(serverUrl);

        const themes = Array.isArray(cachedData?.themes) ? cachedData.themes : [];
        const hasValidCache = cachedData && themes.length > 0 && page === 1;

        if (!hasValidCache) {
            return {items: [], pagination: createEmptyPagination(page, pageSize)};
        }

        if (cachedData.needsBackgroundUpdate) {
            setTimeout(() => this.updateThemesInBackground(serverUrl, themes), 100);
        }

        const pagination = normalizeCachedPagination(cachedData, themes);
        return {items: themes, pagination};
    }

    async fetchThemesAsync() {
        let serverUrl = this.getServerAddress(this.getSettings()),
            cached = this.themeCacheService.loadFromCache(serverUrl);
        if (cached) {
            cached.needsBackgroundUpdate && this.updateThemesInBackground(serverUrl,
                [...(Array.isArray(cached.themes) ? cached.themes : [])]);
            return Array.isArray(cached.themes) ? cached.themes : [];
        }
        let response = await this.loadThemesFromServer(serverUrl, {page: 1, pageSize: this.defaultPageSize});
        this.lastPagination = response?.pagination ?? null;
        return Array.isArray(response?.items) ? response.items : [];
    }

    parseThemesResponse(responseText, serverUrl, page, pageSize) {
        let parsed = tryOrNull('NetworkThemeService.parseThemesResponse', () => JSON.parse(responseText));
        let rawThemes = (Array.isArray(parsed) && parsed)
            || (isObjectLike(parsed) && Array.isArray(parsed?.items) && parsed.items)
            || null;

        if (!rawThemes) {
            this.warn('NetworkThemeService invalid themes payload', {serverUrl, page, pageSize});
            return {items: [], pagination: createEmptyPagination(page, pageSize)};
        }

        return {
            items: this.processThemes(rawThemes, serverUrl),
            pagination: normalizeParsedPagination(parsed, page, pageSize, rawThemes.length) || createEmptyPagination(page, pageSize)
        };
    }

    processThemes(rawThemes, serverUrl) {
        const cleanServer = this.standardizeServerUrl(serverUrl);
        const toServerUrl = toServerUrlFactory(cleanServer);

        return ensureArray(rawThemes)
            .filter(isThemeRecord)
            .map((theme) => buildProcessedTheme(theme, toServerUrl, serverUrl))
            .filter(Boolean);
    }

    decodeResponse(response) {
        return typeof response === 'string' ? response : new TextDecoder('utf-8').decode(response);
    }

    async getThemeByName(themeName) {
        const themes = await this.fetchThemesAsync();
        return themes.find(theme => theme.name === themeName) || null;
    }

    fetchThemeById(serverUrl, themeId) {
        return new Promise((done, fail) => {
            const settings = this.getSettings(),
                fullUrl = `${this.standardizeServerUrl(serverUrl)}/themes/${themeId}`,
                requestTimeoutSeconds = this.getRequestTimeoutSeconds(settings),
                session = this.createSession(requestTimeoutSeconds),
                message = this.createRequestMessage('GET', fullUrl);

            let completed = false;
            let timeoutId = 0;

            let complete = (error, result) => {
                if (completed) return;
                completed = true;
                timeoutId && (GLib.source_remove(timeoutId), timeoutId = 0);
                error ? fail(error) : done(result);
            };

            timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, requestTimeoutSeconds * 1000, () => {
                session.abort?.(message);
                complete(new Error(`Request timed out after ${requestTimeoutSeconds}s`), null);
                return GLib.SOURCE_REMOVE;
            });

            session.queue_message(message, (_sess, msg) => {
                let status = msg?.status_code ?? 0,
                    body = msg?.response_body ? msg.response_body.data : null;

                if (status < 200 || status >= 300) {
                    this.warn('NetworkThemeService theme-by-id HTTP error', {
                        serverUrl, themeId, status, reason: msg?.reason_phrase || ''
                    });
                    complete(new Error(msg?.reason_phrase || `HTTP ${status}`), null);
                    return;
                }

                let text = typeof body === 'string' ? body : this.decodeResponse(body),
                    parsed = tryOrNull('NetworkThemeService.fetchThemeById.parse', () => JSON.parse(text));

                if (!parsed) {
                    this.warn('NetworkThemeService theme-by-id parse error', {serverUrl, themeId});
                    complete(new Error('Invalid theme payload'), null);
                    return;
                }

                let processed = this.processThemes([parsed], serverUrl);
                complete(null, processed.length > 0 ? processed[0] : null);
            });
        });
    }

    loadThemesFromServerWithCallback(serverUrl, options = {}, callback) {
        callback = typeof callback === 'function' ? callback : () => {};

        let completed = false;
        let timeoutId = 0;
        const invokeCallback = (error, result) => {
            if (completed) return;
            completed = true;
            if (timeoutId) {
                GLib.source_remove(timeoutId);
                timeoutId = 0;
            }
            callback(error, result);
        };

        const settings = this.getSettings();
        const page = toPositiveNumber(options?.page, 1);
        const pageSize = toPositiveNumber(options?.pageSize, this.defaultPageSize);
        const fullUrl = settings.useOldRequests
            ? `${serverUrl}/themes-linx`
            : `${serverUrl}/themes?page=${page}&pageSize=${pageSize}`;
        const requestTimeoutSeconds = this.getRequestTimeoutSeconds(settings);

        const session = this.createSession(requestTimeoutSeconds);
        const message = this.createRequestMessage('GET', fullUrl);

        session.queue_message(message, (_sess, msg) => {
            const status = msg?.status_code ?? 0;
            const body = msg?.response_body?.data;

            if (status < 200 || status >= 300) {
                this.warn('NetworkThemeService list HTTP error', {
                    url: fullUrl,
                    status,
                    reason: msg?.reason_phrase || ''
                });
                invokeCallback(new Error(msg?.reason_phrase || `HTTP ${status}`), null);
                return;
            }

            const text = typeof body === 'string' ? body : this.decodeResponse(body);
            const result = this.parseThemesResponse(text, serverUrl, page, pageSize);
            if (page === 1) {
                this.themeCacheService.writeCache(result.items, serverUrl, result.pagination);
            }
            this.lastPagination = result.pagination;
            invokeCallback(null, result);
        });

        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, requestTimeoutSeconds * 1000, () => {
            session.abort?.(message);
            this.warn('NetworkThemeService timeout', {url: fullUrl, timeout: requestTimeoutSeconds});
            invokeCallback(new Error(`Request timed out after ${requestTimeoutSeconds}s`), null);
            return GLib.SOURCE_REMOVE;
        });
    }

    loadThemesFromServer(serverUrl, options = {}) {
        return new Promise((complete, fail) => {
            this.loadThemesFromServerWithCallback(serverUrl, options, (error, result) => {
                error ? fail(error) : complete(result);
            });
        });
    }

    async updateThemesInBackground(serverUrl, oldThemes) {
        const response = await this.loadThemesFromServer(serverUrl, {page: 1, pageSize: this.defaultPageSize})
            .catch((error) => {
                this.warn('updateThemesInBackground failed', {
                    url: serverUrl,
                    error: error?.message || error
                });
                return null;
            });

        if (!response || oldThemes.length === 0) return;

        const newThemes = Array.isArray(response.items) ? response.items : [],
            comparison = this.themeCacheService.compareThemes(oldThemes, newThemes);
        comparison.hasChanges && (
            this.onThemesUpdated?.(newThemes, comparison, response.pagination || null),
            await this.notifyThemeChanges(comparison));
    }

    async notifyThemeChanges(comparison) {
        let hasChanges = Boolean(comparison?.hasChanges);
        hasChanges && this.warn('NetworkThemeService detected theme changes', {
            added: Array.isArray(comparison.added) ? comparison.added.length : 0,
            removed: Array.isArray(comparison.removed) ? comparison.removed.length : 0,
            changed: Array.isArray(comparison.updated) ? comparison.updated.length : 0
        });
        return hasChanges;
    }
}
