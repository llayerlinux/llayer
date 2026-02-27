import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {
    DEFAULT_DANGEROUS_PATTERNS,
    DEFAULT_SECURITY_EXCEPTIONS
} from '../proc/SecurityDefaults.js';
import { DEFAULT_BACKUP_FOLDERS } from '../constants/BackupDefaults.js';
import { DEFAULT_SERVER_ADDRESS } from '../constants/AppUrls.js';
import { TIMEOUTS } from '../constants/Timeouts.js';
import { filterOverrideInitiators, sanitizeHotkeyOverrideMap } from '../hyprland/HotkeyOverrideSanitizer.js';
import { tryOrNull } from '../utils/ErrorUtils.js';
import { readJsonFileSafe } from '../utils/Utils.js';

export class SettingsManagerClass {
    constructor({eventBus = null} = {}) {
        const configDir = GLib.get_home_dir() + '/.config/lastlayer';
        const persistentDir = GLib.get_home_dir() + '/.lastlayer_persistent';
        this.settingsPath = configDir + '/settings.json';
        this.persistentSettingsPath = persistentDir + '/settings.json';
        this.globalHyprlandPath = persistentDir + '/global_hyprland.json';
        this.globalHotkeysPath = persistentDir + '/global_hotkeys.json';
        this.settings = null;
        this.isWriting = false;
        this.lastWriteTime = 0;
        this.notificationShown = false;
        this.initialized = false;
        this.eventBus = eventBus;
        this.translator = null;

        this.defaults = {
            language: 'en',
            theme: null,
            gtkTheme: 'LastLayer',
            soundEnabled: true,
            debugMode: false,
            enableLogs: false,
            serverAddress: DEFAULT_SERVER_ADDRESS,

            showApplyTime: true,
            showInstallTime: true,
            sendPerformanceStats: false,
            applyImmediately: false,
            applyNetworkThemesImmediately: false,
            closePopupAfterApply: false,
            pinned: false,
            testDataMode: false,
            useOldRequests: false,
            tweaksApplyOverride: false,

            animationType: 'grow',
            animationFPS: 240,
            animationAngle: 135,
            wallpaperDuration: 1.3,
            intermediateDefaultTransition: false,

            localThemesPath: `${GLib.get_home_dir()}/.config/themes`,
            downloadsDir: '/tmp/lastlayer',

            enable_dependency_isolation: true,
            isolation_grouping_mode: 'hybrid',
            patch_postinstall_scripts: true,
            patcher_hold_terminal: false,
            show_install_terminal: false,
            show_after_install_terminal: false,
            auto_close_install_terminal: false,
            auto_close_after_install_terminal: false,
            force_hide_script_terminals: false,

            alt_bar: 'none',
            alt_timeout: 2.0,
            daemon_start_timeout: 0.3,
            post_install_delay: 0.3,
            post_reload_delay: 0.3,
            bar_check_interval: 0.1,
            terminal_poll_interval: 0.1,
            wallpaper_retry_delay: 0.5,
            daemon_poll_interval: 0.1,
            script_file_wait_interval: 0.2,
            window_operation_delay: 0.05,
            process_cleanup_delay: 0.05,
            default_theme_bar: 'none',
            default_bar_manual: false,
            restore_point_last_update: null,

            skip_install_theme_apps: [],
            per_rice_isolation_mode: {},
            ignoredUpdateVersions: [],
            customBars: [],
            backupFolders: [...DEFAULT_BACKUP_FOLDERS],
            excludedBackupFolders: [],
            dangerousPatterns: [...DEFAULT_DANGEROUS_PATTERNS],
            securityExceptions: [...DEFAULT_SECURITY_EXCEPTIONS],

            cacheTtlMinutes: 60,
            cacheTimeout: 5000,
            analyticsOptIn: false,
            allowInsecureUpload: false,

            hyprlandOverrides: {},
            hotkeyOverrides: {},
            autoDetectSystemParams: true,
            applyHyprlandOverridesRealtime: false
        };
    }

    ensureDirForPath(path) {
        const dir = GLib.path_get_dirname(path);
        GLib.mkdir_with_parents(dir, parseInt('0755', 8));
    }

    readJsonFile(path) {
        return readJsonFileSafe(path);
    }

    standardizeSettings() {
        this.settings?.closePopupAfterApply === true
            && this.settings.sendPerformanceStats === true
            && (this.settings.closePopupAfterApply = false);
    }

    setTranslationFunction(translator) {
        this.translator = typeof translator === 'function' ? translator : null;
    }

    ensureSettingsDir() {
        this.ensureDirForPath(this.settingsPath);
    }

    ensurePersistentDir() {
        this.ensureDirForPath(this.persistentSettingsPath);
    }

    tryRestoreFromPersistent() {
        const persistentFile = Gio.File.new_for_path(this.persistentSettingsPath),
            exists = persistentFile.query_exists(null);
        exists && (() => {
            this.ensureSettingsDir();
            const targetFile = Gio.File.new_for_path(this.settingsPath);
            persistentFile.copy(targetFile, Gio.FileCopyFlags.OVERWRITE, null, null);
        })();
        return exists;
    }

    writeDefaultsIfMissing() {
        const file = Gio.File.new_for_path(this.settingsPath);
        !file.query_exists(null) && (() => {
            this.ensureSettingsDir();
            const json = JSON.stringify(this.defaults, null, 2);
            GLib.file_set_contents(this.settingsPath, json);
        })();
    }

    load() {
        const settingsFile = Gio.File.new_for_path(this.settingsPath);
        settingsFile.query_exists(null) || (this.tryRestoreFromPersistent(), this.writeDefaultsIfMissing());

        const data = this.readJsonFile(this.settingsPath);
        this.settings = (data && typeof data === 'object')
            ? {...this.defaults, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))}
            : {...this.defaults};
        this.standardizeSettings();
        this.initialized = true;
        return this.settings;
    }

    ensureInitialized() {
        this.initialized || this.load();
    }

    applyUpdates(updates) {
        const entries = (updates && typeof updates === 'object') ? Object.entries(updates) : [];
        entries.forEach(([key, value]) => {
            value !== undefined && (this.settings[key] = value);
        });
        this.standardizeSettings();
    }

    update(updates) {
        this.ensureInitialized();
        this.applyUpdates(updates);
        return this.settings;
    }

    write(updates = null, options = {}) {
        const now = Date.now();
        if (this.isWriting || (!options.force && (now - this.lastWriteTime < 300))) {
            return false;
        }

        this.isWriting = true;
        this.lastWriteTime = now;

        this.ensureInitialized();
        this.applyUpdates(updates);

        Object.keys(this.defaults).forEach((key) => {
            this.settings[key] ??= this.defaults[key];
        });

        this.ensureSettingsDir();

        const json = JSON.stringify(this.settings, null, 2);
        GLib.file_set_contents(this.settingsPath, json);
        this.ensurePersistentDir();
        GLib.file_set_contents(this.persistentSettingsPath, json);

        (!options.silent && !this.notificationShown) && this.showNotification();

        this.isWriting = false;
        return true;
    }

    get(key) {
        this.ensureInitialized();
        return this.settings.hasOwnProperty(key) ? this.settings[key] : this.defaults[key];
    }

    set(key, value) {
        this.ensureInitialized();
        this.settings[key] = value;
    }

    getAll() {
        this.ensureInitialized();
        return {...this.settings};
    }

    writeOnShutdown() {
        this.notificationShown = true;
        return this.write(null, {silent: true, force: true});
    }

    reset() {
        this.settings = {...this.defaults};
        return this.write(null, {silent: true, force: true});
    }

    getDefaults() {
        return {...this.defaults};
    }

    isInitialized() {
        return this.initialized;
    }

    showNotification() {
        if (this.notificationShown) {
            return;
        }

        this.notificationShown = true;

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_SHORT_MS, () => (this.notificationShown = false));
    }

    readGlobalParams(path, scope, options = {}) {
        const withMeta = options.withMeta === true;
        const file = Gio.File.new_for_path(path);
        const result = file.query_exists(null) ? (tryOrNull(`${scope}.read`, () => GLib.file_get_contents(path)) || []) : [];
        const [ok, contents] = result;
        const json = ok ? tryOrNull(`${scope}.parse`, () => JSON.parse(new TextDecoder().decode(contents))) : null;
        const params = (json?.params && typeof json.params === 'object') ? json.params : {};
        const initiators = (json?.initiators && typeof json.initiators === 'object') ? json.initiators : {};
        return withMeta ? { params, initiators } : params;
    }

    readGlobalHyprland() {
        return this.readGlobalParams(this.globalHyprlandPath, 'SettingsManager.readGlobalHyprland');
    }

    readGlobalHyprlandState() {
        return this.readGlobalParams(
            this.globalHyprlandPath,
            'SettingsManager.readGlobalHyprlandState',
            { withMeta: true }
        );
    }

    buildNextInitiators(previousState, nextParams, nextInitiators) {
        const buildSignature = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        };

        if (nextInitiators && typeof nextInitiators === 'object') {
            return Object.fromEntries(
                Object.entries(nextInitiators).filter(([key, value]) =>
                    Object.prototype.hasOwnProperty.call(nextParams, key)
                    && typeof value === 'string'
                    && value.trim().length > 0
                )
            );
        }

        let previousParams = previousState?.params ?? {},
            previousInitiators = previousState?.initiators ?? {},
            stableInitiators = {};
        for (const [key, value] of Object.entries(nextParams)) {
            previousInitiators[key] !== undefined
                && buildSignature(previousParams[key]) === buildSignature(value)
                && (stableInitiators[key] = previousInitiators[key]);
        }
        return stableInitiators;
    }

    writeGlobalHyprland(params, initiators = null) {
        this.ensurePersistentDir();
        const previousState = this.readGlobalHyprlandState(),
            nextParams = (params && typeof params === 'object') ? params : {},
            nextInitiators = this.buildNextInitiators(previousState, nextParams, initiators),
            content = JSON.stringify({
                version: 1,
                params: nextParams,
                initiators: nextInitiators,
                updatedAt: new Date().toISOString()
            }, null, 2);
        GLib.file_set_contents(this.globalHyprlandPath, content);
        return true;
    }

    readGlobalHotkeys() {
        const params = this.readGlobalParams(this.globalHotkeysPath, 'SettingsManager.readGlobalHotkeys');
        return sanitizeHotkeyOverrideMap(params).overrides;
    }

    readGlobalHotkeysState() {
        const state = this.readGlobalParams(
            this.globalHotkeysPath,
            'SettingsManager.readGlobalHotkeysState',
            { withMeta: true }
        );
        const params = sanitizeHotkeyOverrideMap(state?.params).overrides;
        return {
            params,
            initiators: filterOverrideInitiators(state?.initiators, params)
        };
    }

    writeGlobalHotkeys(params, initiators = null) {
        this.ensurePersistentDir();
        const previousState = this.readGlobalHotkeysState(),
            nextParams = sanitizeHotkeyOverrideMap(params).overrides,
            nextInitiators = this.buildNextInitiators(previousState, nextParams, initiators),
            content = JSON.stringify({
                version: 1,
                params: nextParams,
                initiators: nextInitiators,
                updatedAt: new Date().toISOString()
            }, null, 2);
        GLib.file_set_contents(this.globalHotkeysPath, content);
        this.initialized && this.settings && (this.settings.hotkeyOverrides = { ...nextParams });
        return true;
    }
}

export { SettingsManagerClass as SettingsManager };
