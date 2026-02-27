import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=2.4';
import { DEFAULT_SERVER_ADDRESS } from '../../../infrastructure/constants/AppUrls.js';
import {
    assignNumberFields,
    decodeBytes,
    isObjectLike,
    parseId,
    parseServerAddress,
    normalizeThemeStats,
    toNonNegativeCount,
    toNonNegativeNumber
} from '../../../infrastructure/utils/Utils.js';
import { THEME_STATS_KEYS } from '../../../infrastructure/constants/ThemeStats.js';
import {
    extractThemeIdRecursive,
    extractThemeIdentifierFromCandidates,
    findFirstServerAddress
} from '../../common/ThemeStatsShared.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

export function applyThemeContextMenuControllerStats(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerStats.prototype);
}

class ThemeContextMenuControllerStats {
    getService(name) {
        return this.container?.get?.(name) ?? null;
    }

    fetchThemeStats(theme = {}, callback = null) {
        const snapshot = this.buildStatsSnapshot(theme);
        const respond = (result = snapshot) => callback?.(result);

        const identifier = this.extractThemeIdentifier(theme);
        const serverBase = this.getServerAddress(theme);
        if (!identifier || !serverBase) return respond();

        const endpoint = `${serverBase}/themes/${encodeURIComponent(identifier)}?cb=${Date.now()}`;

        const session = new Soup.Session();
        session.timeout = 10;

        const message = Soup.Message.new('GET', endpoint);
        if (!message) return respond();

        message.request_headers.replace('Accept', 'application/json');
        message.request_headers.replace('Cache-Control', 'no-cache, no-store, must-revalidate');

        session.queue_message(message, (_sess, msg) => {
            const isSuccessfulResponse = msg.status_code >= 200 && msg.status_code < 300;
            if (!(isSuccessfulResponse && msg.response_body?.data)) return respond();

            const text = decodeBytes(msg.response_body.data);
            const payload = text
                ? tryOrNull('ThemeContextMenuControllerStats.fetchThemeStats.parse', () => JSON.parse(text))
                : null;
            const normalized = this.standardizeStatsPayload(payload);
            if (!normalized) return respond();

            Object.assign(theme, normalized);
            this.currentMenuData?.theme?.name === theme?.name
                && Object.assign(this.currentMenuData.theme, normalized);

            theme?.name && this.updateThemeStats(theme.name, normalized);

            this.cachedNetworkTheme = payload;
            this.persistStatsToMetadata(theme, normalized);

            respond(normalized);
        });
    }

    standardizeStatsPayload(payload) {
        return isObjectLike(payload) ? normalizeThemeStats(payload) : null;
    }

    extractThemeId(theme = {}) {
        return extractThemeIdRecursive(theme, parseId);
    }

    extractThemeIdentifier(theme = {}) {
        return extractThemeIdentifierFromCandidates(
            theme,
            parseId,
            [
                theme?.metadata?.originalTheme?.name,
                theme?.name || theme?.title,
                theme?.originalTheme?.name
            ]
        );
    }

    getMetadataPath(theme) {
        const repositoryBase = this.themeRepository?.basePath || `${GLib.get_home_dir()}/.config/themes`;
        const fallbackThemePath = theme.name ? `${repositoryBase}/${theme.name}` : null;
        const themePath = theme.path || theme.localPath || fallbackThemePath;
        return theme.metadataPath || (themePath ? `${themePath}/lastlayer-metadata.json` : null);
    }

    loadMetadata(theme, metadataPath) {
        if (isObjectLike(theme.metadata)) return theme.metadata;
        const [ok, contents] = tryOrNull(
            'ThemeContextMenuControllerStats.loadMetadata.read',
            () => GLib.file_get_contents(metadataPath)
        ) || [];
        return ok
            ? tryOrNull(
                'ThemeContextMenuControllerStats.loadMetadata.parse',
                () => JSON.parse(typeof contents === 'string' ? contents : new TextDecoder('utf-8').decode(contents))
            )
            : null;
    }

    persistStatsToMetadata(theme, stats) {
        const metadataPath = this.getMetadataPath(theme);
        const metadata = metadataPath ? this.loadMetadata(theme, metadataPath) : null;
        if (!isObjectLike(theme) || !stats || !metadataPath || !isObjectLike(metadata)) return;

        const original = isObjectLike(metadata.originalTheme) ? metadata.originalTheme : (metadata.originalTheme = {});
        assignNumberFields(original, stats, THEME_STATS_KEYS);
        GLib.file_set_contents(metadataPath, JSON.stringify(metadata, null, 2));
    }

    getServerAddress(theme = {}) {
        return findFirstServerAddress([
            typeof theme?.serverUrl === 'string' ? theme.serverUrl : null,
            this.settingsService?.getServerAddress?.(),
            DEFAULT_SERVER_ADDRESS
        ].filter(Boolean), parseServerAddress);
    }

    buildStatsSnapshot(theme = {}) {
        return normalizeThemeStats(theme);
    }

    ensureThemeSelectorStore() {
        !this.themeSelectorStore && (this.themeSelectorStore = this.getService('themeSelectorStore'));
        return this.themeSelectorStore;
    }

    updateThemeStats(themeName, stats = {}) {
        const store = this.ensureThemeSelectorStore();
        const sanitized = this.buildStatsSnapshot(stats);
        themeName && store && typeof store.updateTheme === 'function' && store.updateTheme({
            name: themeName,
            ...sanitized
        });
    }

    fetchFreshStatsFromServer(theme, isNetwork = false) {
        if (!theme?.name) return;
        const identifier = this.extractThemeIdentifier(theme) || theme.name,
              serverUrl = this.getServerAddress(theme);
        if (!serverUrl) return;

        let session = new Soup.Session(),
            message = Soup.Message.new('GET', `${serverUrl}/themes/${encodeURIComponent(identifier)}`);
        session.timeout = 10;
        message.request_headers.append('Accept', 'application/json');

        session.queue_message(message, (_session, msg) => {
            if (msg.status_code < 200 || msg.status_code >= 300) return;

            let responseText = decodeBytes(msg.response_body?.data),
                networkData = responseText && tryOrNull(
                      'ThemeContextMenuControllerStats.fetchFreshStatsFromServer.parse',
                      () => JSON.parse(responseText)
                  );
            if (!isObjectLike(networkData)) return;

            this.cachedNetworkTheme = networkData;
            if (this.currentMenuData?.theme?.name !== theme.name) return;

            let {downloadCount, installCount, applyCount, averageInstallMs, averageApplyMs} = networkData,
                stats = {downloadCount, installCount, applyCount, averageInstallMs, averageApplyMs},
                menuTheme = this.currentMenuData.theme,
                hasChanged = toNonNegativeCount(stats.downloadCount, 0) !== menuTheme.downloadCount
                      || toNonNegativeCount(stats.installCount, 0) !== menuTheme.installCount
                      || toNonNegativeCount(stats.applyCount, 0) !== menuTheme.applyCount
                      || toNonNegativeNumber(stats.averageInstallMs, null) !== menuTheme.averageInstallMs
                      || toNonNegativeNumber(stats.averageApplyMs, null) !== menuTheme.averageApplyMs;

            if (hasChanged) {
                this.currentMenuData = this.mergeNetworkDataIntoMenu(this.currentMenuData, networkData);
                this.view?.updateMenuData?.(this.currentMenuData);
                this.updateThemeStats(theme.name, stats);
            }

            !isNetwork && this.persistStatsToMetadata(theme, stats);
        });
    }

    fetchNetworkDataForLocalTheme(theme) {
        this.fetchFreshStatsFromServer(theme, false);
    }

    mergeNetworkDataIntoMenu(menuData, networkData) {
        const updated = JSON.parse(JSON.stringify(menuData)),
              theme = updated.theme;

        const STAT_FIELDS = [
            ['downloadCount', (v) => toNonNegativeCount(v, 0)],
            ['installCount', (v) => toNonNegativeCount(v, 0)],
            ['applyCount', (v) => toNonNegativeCount(v, 0)],
            ['averageInstallMs', (v) => toNonNegativeNumber(v, null)],
            ['averageApplyMs', (v) => toNonNegativeNumber(v, null)]
        ];
        for (const [key, standardize] of STAT_FIELDS) {
            if (networkData[key] !== undefined) theme[key] = standardize(networkData[key]);
        }

        typeof networkData.previewUrl === 'string'
            && (theme.preview = networkData.previewUrl, theme.networkPreview = networkData.previewUrl);
        Array.isArray(networkData.tags) && (theme.tags = networkData.tags);
        networkData.id && (theme.networkId = networkData.id);

        for (const [sourceKey, themeKey, repoMerge] of [
            ['repoUrl', 'repoUrl', {url: networkData.repoUrl, hasRepository: true}],
            ['published', 'published', {published: networkData.published}],
            ['youtubeLink', 'youtubeLink', {youtubeLink: networkData.youtubeLink}]
        ]) {
            if (!networkData[sourceKey]) continue;
            theme[themeKey] = networkData[sourceKey];
            updated.repository = {...updated.repository, ...repoMerge};
        }

        isObjectLike(networkData.author) && (
            theme.author = networkData.author,
            updated.author = this.getAuthorInfo({author: networkData.author}, true)
        );

        isObjectLike(networkData.adaptedBy) && (
            theme.adaptedBy = networkData.adaptedBy,
            updated.adaptedBy = this.getAdaptedInfo({adaptedBy: networkData.adaptedBy})
        );

        isObjectLike(networkData.properties) && (
            theme.properties = {...(isObjectLike(theme.properties) ? theme.properties : {}), ...networkData.properties},
            updated.properties = {...updated.properties, badges: theme.properties}
        );

        isObjectLike(networkData.includes) && (
            theme.includes = networkData.includes,
            updated.includes = networkData.includes
        );

        theme.networkDataLoaded = true;
        return updated;
    }
}
