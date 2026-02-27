import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=2.4';
import { DEFAULT_SERVER_ADDRESS } from '../../../infrastructure/constants/AppUrls.js';
import {
    isPlainObject,
    parseId,
    parseServerAddress,
    toNonNegativeCount,
    toNonNegativeNumber
} from '../../../infrastructure/utils/Utils.js';
import { THEME_STATS_KEYS } from '../../../infrastructure/constants/ThemeStats.js';
import { tryOrNull, tryOrNullAsync } from '../../../infrastructure/utils/ErrorUtils.js';
import {
    collectLowercaseThemeNames,
    extractThemeIdRecursive,
    extractThemeIdentifierFromCandidates,
    findFirstServerAddress
} from '../../common/ThemeStatsShared.js';

class ThemeSelectorControllerNetworkStats {
    getServerAddressForStats() {
        const ss = this.settingsService,
              ns = ss?.getNetworkThemeSettings?.(),
              secondaryNs = this.networkThemeService?.settingsService?.getNetworkThemeSettings?.();

        const candidates = [
            ss?.getServerAddress?.(),
            ns?.serverAddress,
            ns?.serverUrl,
            secondaryNs?.serverAddress,
            DEFAULT_SERVER_ADDRESS
        ].filter(Boolean);

        return findFirstServerAddress(candidates, parseServerAddress);
    }

    extractThemeIdForStats(theme = {}) {
        return extractThemeIdRecursive(theme, parseId);
    }

    extractThemeIdentifierForStats(theme = {}) {
        return extractThemeIdentifierFromCandidates(
            theme,
            parseId,
            [
                theme?.metadata?.originalTheme?.name,
                theme?.originalTheme?.name,
                theme?.name,
                theme?.title,
                theme?.metadata?.originalTheme?.title
            ]
        );
    }

    parseStatsPayload(payload = {}) {
        const parseCount = (v) => toNonNegativeCount(v, undefined);
        const parseDuration = (v) => toNonNegativeNumber(v, undefined);

        return {
            downloadCount: parseCount(payload.downloadCount),
            installCount: parseCount(payload.installCount),
            applyCount: parseCount(payload.applyCount),
            averageInstallMs: parseDuration(payload.averageInstallMs),
            averageApplyMs: parseDuration(payload.averageApplyMs)
        };
    }

    updateThemeMetadataWithStats(theme, stats) {
        let metadataPath = theme?.metadataPath || (theme?.path ? `${theme.path}/lastlayer-metadata.json` : null);
        let metadata = (theme?.metadata && typeof theme.metadata === 'object') ? theme.metadata : null;
        if (!(stats && metadataPath && metadata)) return;

        let original = metadata.originalTheme && typeof metadata.originalTheme === 'object'
            ? metadata.originalTheme
            : (metadata.originalTheme = {});

        THEME_STATS_KEYS.forEach((key) => {
            stats[key] !== undefined && (original[key] = stats[key]);
        });

        GLib.file_set_contents(metadataPath, JSON.stringify(metadata, null, 2));
    }

    applyStatsToTheme(theme, stats) {
        if (!theme || !stats) return null;

        let normalized = this.parseStatsPayload(stats),
            updated = {...theme};
        let changed = false;

        let updateNumericField = (key, value) => {
            if (value !== undefined && updated[key] !== value) {
                updated[key] = value;
                changed = true;
            }
        };

        THEME_STATS_KEYS.forEach(key => updateNumericField(key, normalized[key]));
        if (!changed) return null;

        updated.metadata = isPlainObject(theme.metadata)
            ? {
                ...theme.metadata,
                originalTheme: {
                    ...(isPlainObject(theme.metadata.originalTheme) ? theme.metadata.originalTheme : {})
                }
            }
            : updated.metadata;
        this.updateThemeMetadataWithStats(updated, normalized);
        return updated;
    }

    fetchThemeStatsFromServer(serverBase, identifier) {
        return new Promise((complete) => {
            const session = new Soup.Session(),
                message = Soup.Message.new('GET', `${serverBase}/themes/${encodeURIComponent(identifier)}/stats?cb=${Date.now()}`);
            session.timeout = 10;
            message.request_headers.replace('Cache-Control', 'no-cache');

            session.queue_message(message, (_sess, msg) => {
                const isSuccess = msg.status_code >= 200 && msg.status_code < 300,
                    bytes = msg.response_body?.flatten?.()?.get_data?.(),
                    text = isSuccess && bytes?.length ? new TextDecoder('utf-8').decode(bytes) : '';
                complete(isSuccess
                    ? (text && tryOrNull('ThemeSelectorControllerNetworkStats.fetchThemeStatsFromServer.parse', () => JSON.parse(text))) || {}
                    : null);
            });
        });
    }

    async refreshLocalThemeStats(options = {}) {
        const force = options.force === true;
        const now = Date.now();

        const shouldSkipRefresh = !force
            && (Boolean(this.localStatsRefreshPromise)
                || (now - this.lastLocalStatsRefresh < this.localStatsRefreshCooldownMs));
        if (shouldSkipRefresh) return this.localStatsRefreshPromise || null;

        const runner = tryOrNullAsync('refreshLocalThemeStats', async () => {
            const serverBase = this.getServerAddressForStats();
            const localThemes = Array.isArray(this.store?.get?.('localThemes')) ? this.store.get('localThemes') : [];
            const canRefresh = Boolean(serverBase && localThemes.length);
            if (!canRefresh) return undefined;

            const updatedThemes = [];
            for (const theme of localThemes) {
                const identifier = this.extractThemeIdentifierForStats(theme);
                const stats = identifier
                    ? await tryOrNullAsync('fetchThemeStats', () => this.fetchThemeStatsFromServer(serverBase, identifier))
                    : null;
                const updated = stats ? this.applyStatsToTheme(theme, stats) : null;
                if (updated) {
                    updatedThemes.push(updated);
                }
            }
            updatedThemes.forEach((theme) => this.store.updateTheme(theme));
        });

        this.localStatsRefreshPromise = runner.finally(() => {
            this.lastLocalStatsRefresh = Date.now();
            this.localStatsRefreshPromise = null;
        });

        return this.localStatsRefreshPromise;
    }

    synchronizeLocalThemesWithNetwork(networkThemes = []) {
        const networkList = Array.isArray(networkThemes) ? networkThemes : [],
              localThemes = Array.isArray(this.store?.get?.('localThemes')) ? this.store.get('localThemes') : [];
        if (!networkList.length || !localThemes.length) return;

        const byId = new Map(), byName = new Map();

        for (const theme of networkList.filter((item) => item && typeof item === 'object')) {
            Number.isFinite(Number(theme.id)) && byId.set(Number(theme.id), theme);
            [theme.name, theme.title].forEach((name) => {
                const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
                key.length && !byName.has(key) && byName.set(key, theme);
            });
        }

        const updates = [];
        for (const localTheme of localThemes.filter((item) => item && typeof item === 'object')) {
            const localId = this.extractThemeIdForStats(localTheme),
                  matched = (localId != null && byId.get(Number(localId)))
                || byName.get(collectLowercaseThemeNames([
                    localTheme?.metadata?.originalTheme?.name,
                    localTheme?.name,
                    localTheme?.title,
                    localTheme?.metadata?.originalTheme?.title,
                    localTheme?.originalTheme?.name
                ]).find((c) => byName.has(c)))
                || null,
                  updated = matched ? this.applyStatsToTheme(localTheme, matched) : null;
            updated && updates.push(updated);
        }

        updates.forEach((theme) => this.store.updateTheme(theme));
    }
}

export function applyThemeSelectorControllerNetworkStats(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerNetworkStats.prototype);
}
