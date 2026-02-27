import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../utils/ErrorUtils.js';

const CACHE_VERSION = '1.2';

const THEME_CACHE_UPDATE_FIELDS = [
    'version',
    'preview',
    'previewUrl',
    'archiveUrl',
    'lastModified',
    'published',
    'youtubeLink',
    'repoUrl',
    'includes'
];

export class ThemeCacheService {
    constructor(settingsService, logger = null) {
        this.settingsService = settingsService;
        this.logger = logger;
        this.cacheDir = `${GLib.get_user_cache_dir()}/lastlayer-themes`;
        this.cacheFile = `${this.cacheDir}/themes-cache.json`;

        const cacheSettings = (settingsService?.getCacheSettings?.()) ?? {};
        this.cacheTimeout = cacheSettings.timeout || 300000;
        this.maxCacheAge = cacheSettings.maxAge || 86400000;
        this.enabled = cacheSettings.enabled !== false;

        this.ensureCacheDir();
    }

    getThemeKey(theme, standardize = false) {
        const raw = theme?.name || theme?.title || '';
        return standardize ? raw.trim().toLowerCase() : raw;
    }

    ensureCacheDir() {
        const dir = Gio.File.new_for_path(this.cacheDir);
        dir.query_exists(null) || dir.make_directory_with_parents(null);
    }

    writeCache(themes, serverUrl, pagination = null) {
        if (!this.enabled) {
            return;
        }
        const cacheData = {
            timestamp: Date.now(),
            serverUrl,
            version: CACHE_VERSION,
            themes,
            themesById: this.createThemeIndex(themes),
            pagination
        };

        Gio.File.new_for_path(this.cacheFile).replace_contents(
            JSON.stringify(cacheData, null, 2),
            null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null
        );
    }

    loadFromCache(serverUrl) {
        if (!this.enabled) return null;

        let file = Gio.File.new_for_path(this.cacheFile),
            [success, content] = file.query_exists(null) ? file.load_contents(null) : [false, null],
            cacheData = success
                ? tryOrNull('ThemeCacheService.loadFromCache.decode', () => JSON.parse(new TextDecoder('utf-8').decode(content)))
                : null;
        if (!cacheData || typeof cacheData !== 'object') return null;

        let age = Date.now() - cacheData.timestamp,
            isValid = cacheData.serverUrl === serverUrl
                && cacheData.version === CACHE_VERSION
                && age <= this.maxCacheAge;

        return isValid ? {
            themes: cacheData.themes ?? [],
            themesById: cacheData.themesById ?? {},
            timestamp: cacheData.timestamp,
            needsBackgroundUpdate: age > this.cacheTimeout,
            age,
            pagination: cacheData.pagination || null
        } : null;
    }

    createThemeIndex(themes) {
        const byId = {}, byName = {};
        themes.forEach(theme => {
            theme?.id && (byId[theme.id] = theme);
            const key = this.getThemeKey(theme, true);
            key && (byName[key] = theme);
        });
        return {byId, byName};
    }

    compareThemes(oldThemes, newThemes) {
        const {byName: oldByName} = this.createThemeIndex(oldThemes),
            {byName: newByName} = this.createThemeIndex(newThemes),
            added = newThemes.filter(theme => !oldByName[this.getThemeKey(theme)]),
            removed = oldThemes.filter(theme => !newByName[this.getThemeKey(theme)]),
            updated = [];

        newThemes.forEach(newTheme => {
            const oldTheme = oldByName[this.getThemeKey(newTheme)];
            oldTheme && this.isThemeUpdated(oldTheme, newTheme) && updated.push({
                old: oldTheme,
                new: newTheme,
                name: this.getThemeKey(newTheme)
            });
        });

        return {
            added,
            removed,
            updated,
            hasChanges: added.length > 0 || removed.length > 0 || updated.length > 0
        };
    }

    isThemeUpdated(oldTheme, newTheme) {
        return THEME_CACHE_UPDATE_FIELDS.some(field => {
            const oldVal = oldTheme[field];
            const newVal = newTheme[field];
            return (typeof oldVal === 'object' || typeof newVal === 'object')
                ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
                : oldVal !== newVal;
        });
    }

    clearCache() {
        const file = Gio.File.new_for_path(this.cacheFile);
        file.query_exists(null) && file.delete(null);
    }
}
