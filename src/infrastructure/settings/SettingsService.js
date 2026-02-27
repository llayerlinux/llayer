import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { DEFAULT_SERVER_ADDRESS } from '../constants/AppUrls.js';

function requireSettingsManager(settingsManager) {
    return settingsManager ?? (() => {
        throw new Error('SettingsService requires settingsManager dependency');
    })();
}

export class SettingsService {
    constructor({settingsManager = null} = {}) {
        this.currentThemeFile = GLib.build_filenamev([
            GLib.get_home_dir(), '.config', 'lastlayer_pref', 'current_theme'
        ]);
        this.manager = requireSettingsManager(settingsManager);
        this.ensureDirectories();
    }

    getSettingsSnapshot() {
        return this.manager.getAll();
    }

    get settingsManager() {
        return this.manager;
    }

    get settings() {
        return this.getSettingsSnapshot();
    }

    ensureDirectories() {
        const ensureDir = (path) => {
            const dir = Gio.File.new_for_path(path);
            !dir.query_exists(null) && dir.make_directory_with_parents(null);
        };
        ensureDir(GLib.build_filenamev([GLib.get_home_dir(), '.config', 'lastlayer']));
        ensureDir(GLib.build_filenamev([GLib.get_home_dir(), '.config', 'lastlayer_pref']));
    }

    loadSettings() {
        !this.manager.isInitialized() && this.manager.load();
    }

    setCurrentTheme(themeName) {
        this.ensureDirectories();
        this.manager.set('theme', themeName);
        GLib.file_set_contents(this.currentThemeFile, themeName);
        this.manager.write(null, {silent: true});
        return true;
    }

    getCurrentTheme() {
        return this.manager.get('theme') || 'default';
    }

    isThemeInSkipList(themeName) {
        const list = this.manager.get('skip_install_theme_apps') ?? [];
        return Array.isArray(list) && list.includes(themeName);
    }

    addToSkipList(themeName) {
        const rawList = this.manager.get('skip_install_theme_apps') ?? [],
            list = Array.isArray(rawList) ? rawList : [],
            exists = list.includes(themeName);
        !exists && (
            list.push(themeName),
            this.manager.set('skip_install_theme_apps', list),
            this.manager.write(null, {silent: true})
        );
        return !exists;
    }

    getSkipList() {
        const list = this.manager.get('skip_install_theme_apps');
        return Array.isArray(list) ? [...list] : [];
    }

    getRestorePointLastUpdate() {
        const value = this.manager.get('restore_point_last_update');
        return (typeof value === 'string' && value.trim().length) ? value.trim() : null;
    }

    setRestorePointLastUpdate(timestamp) {
        const normalized = (typeof timestamp === 'string' && timestamp.trim().length) ? timestamp.trim() : null;
        this.manager.set('restore_point_last_update', normalized);
        this.manager.write(null, {silent: true});
        return normalized;
    }

    getServerAddress() {
        return this.manager.get('serverAddress') || DEFAULT_SERVER_ADDRESS;
    }

    getAll() {
        return this.getSettingsSnapshot();
    }

    getNetworkThemeSettings() {
        const settings = this.getSettingsSnapshot();
        return {
            serverAddress: this.getServerAddress(),
            allowInsecureUpload: !!settings.allowInsecureUpload,
            useOldRequests: settings.useOldRequests,
            cacheTimeout: settings.cacheTimeout,
            maxCacheAge: settings.maxCacheAge,
            applyImmediately: settings.applyNetworkThemesImmediately,
            showNotifications: settings.showNetworkThemeNotifications,
            connectionTimeout: settings.connectionTimeout
        };
    }

    getCacheSettings() {
        const s = this.getSettingsSnapshot();
        return {
            enabled: s.enableThemeCache,
            timeout: s.cacheTimeout,
            maxAge: s.maxCacheAge,
            cleanOnStartup: s.cleanCacheOnStartup
        };
    }

    async write(data) {
        const isValidData = data && typeof data === 'object';
        return isValidData
            ? (
                this.manager.update(data),
                [this.manager.write(null, {silent: true}), Date.now()]
            )
            : [false, Date.now()];
    }

}
