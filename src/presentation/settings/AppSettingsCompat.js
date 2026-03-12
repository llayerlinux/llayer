import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {
    DEFAULT_DANGEROUS_PATTERNS,
    DEFAULT_SECURITY_EXCEPTIONS
} from '../../infrastructure/proc/SecurityDefaults.js';
import { DEFAULT_SERVER_ADDRESS } from '../../infrastructure/constants/AppUrls.js';

function clonePlainObject(source, seen = new WeakMap()) {
    if (!(source && typeof source === 'object') || seen.has(source)) return seen.get(source) ?? {};
    let target = Array.isArray(source) ? [] : {};
    seen.set(source, target);

    function cloneValue(value) {
        return typeof value === 'function' ? undefined
            : Array.isArray(value) ? value.map((item) =>
                (item && typeof item === 'object') ? clonePlainObject(item, seen) : item)
            : value && typeof value === 'object' ? clonePlainObject(value, seen) : value;
    }

    Object.keys(source).forEach((key) => {
        let cloned = cloneValue(source[key]);
        cloned !== undefined && (target[key] = cloned);
    });
    return target;
}

export class AppSettingsCompat {
    constructor(options = {}) {
        this.legacyStorage = options.legacyStorage || null;
        this.container = options.container || null;
    }

    static clone(value) {
        return clonePlainObject(value);
    }

    composeSnapshot(currentSettings = {}) {
        const source = currentSettings ?? {};

        Gtk.IconSize ||= {
            INVALID: 0,
            MENU: 1,
            SMALL_TOOLBAR: 2,
            LARGE_TOOLBAR: 3,
            BUTTON: 4,
            DND: 5,
            DIALOG: 6
        };

        const readSetting = (keys, defaultValue) => {
            const lookupKeys = Array.isArray(keys) ? keys : [keys];
            const existingKey = lookupKeys.find((key) => source && Object.prototype.hasOwnProperty.call(source, key));
            return existingKey !== undefined ? source[existingKey] : defaultValue;
        };

        const defaults = {
            language: 'en',
            applyImmediately: false,
            applyNetworkThemesImmediately: false,
            closePopupAfterApply: false,
            animationType: 'grow',
            animationFPS: 240,
            animationAngle: 135,
            wallpaperDuration: 1.3,
            intermediateDefaultTransition: false,
            theme: null,
            restore_point_last_update: null,
            hyprlandOverrides: {},
            hotkeyOverrides: {},
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
            skip_install_theme_apps: [],
            showApplyTime: false,
            showInstallTime: false,
            sendPerformanceStats: false,
            testDataMode: false,
            serverAddress: DEFAULT_SERVER_ADDRESS,
            localThemesPath: `${GLib.get_home_dir()}/.config/themes`,
            gtkTheme: 'LastLayer',
            pinned: false,
            useOldRequests: false,
            tweaksApplyOverride: false,
            soundEnabled: true,
            enable_dependency_isolation: true,
            isolation_grouping_mode: 'hybrid',
            per_rice_isolation_mode: {},
            patch_postinstall_scripts: true,
            patcher_hold_terminal: false,
            ignoredUpdateVersions: [],
            show_install_terminal: false,
            show_after_install_terminal: false,
            auto_close_install_terminal: false,
            auto_close_after_install_terminal: false,
            force_hide_script_terminals: false,
            dangerousPatterns: [...DEFAULT_DANGEROUS_PATTERNS],
            securityExceptions: [...DEFAULT_SECURITY_EXCEPTIONS],
            debugMode: false,
            enableLogs: false,
            customBars: [],
            backupFolders: [],
            excludedBackupFolders: [],
            previewSource: 'auto',
            importLogDisabled: false,
            importLogAutoHide: true,
            autoApplyAfterImport: false,
            autoDetectSystemParams: true,
            applyHyprlandOverridesRealtime: false,
            autoConvertLegacyParams: true,
            legacySettings: {
                autoMigrate: true,
                globalEnabledLegacy: [],
                globalRevertedConversions: [],
                globalEnabledFuture: [],
                globalRevertedFutureConversions: []
            },
            xterm_dock_to_window: true,
            xterm_width: 80,
            xterm_height: 24,
            xterm_pixel_width: 650,
            xterm_pixel_height: 450,
            xterm_bg: '#2e3440',
            xterm_fg: '#d8dee9',
            xterm_font: 'Monospace',
            xterm_font_size: 11,
            xterm_color_preset: null,
            xterm_from_rice: false,
            hyprpanel_adaptive_isolation: false,
            hyprpanel_adaptive_scale_enabled: false,
            hyprpanel_adaptive_scale_value: 68,
            quickshell_adaptive_isolation: true,
            swayToHyprlandConvert: true,
            swayConvertFixFonts: true,
            swayConvertFixActive: true,
            hideWifiNameOnImport: false,
            executeImageInstructions: true,
            autoGenerateTagsOnImport: false,
            autoGenerateTagsProviderId: null,
            lastAddLocalThemeDir: '~/.config',
            flyParallelApply: true,
            flySkipHeavyPhases: false,
            flyPreloadWallpaper: true,
            flyWarmBarProcess: false,
            flyPregenScript: false,
            flySkipInstallScript: false,
            flyEarlyOverrides: true,
            flySeamlessMode: false,
            flyDisableExternalNotifications: false,
            gitUrlMode: 'https',
            timeouts: {
                flyDebounceDelay: 150,
                regularDebounceDelay: 500,
                stabilityCheckInterval: 150,
                stabilityMaxWait: 30000,
                retryDelayBase: 2000,
                flyApplyDelay: 500,
                regularApplyDelay: 1500,
                flyRetryDelay: 300,
                regularRetryDelay: 1000,
                commandListenerInterval: 100,
                rescanAfterImportDelay: 1000,
                startupScanDelay: 200
            }
        };

        const snapshot = Object.fromEntries(
            Object.entries(defaults).map(([key, def]) => [
                key,
                (source && Object.prototype.hasOwnProperty.call(source, key)) ? source[key] : def
            ])
        );

        snapshot.serverAddress = readSetting(['serverAddress', 'serverUrl'], defaults.serverAddress);
        snapshot.localThemesPath = readSetting('localThemesPath', defaults.localThemesPath);
        snapshot.gtkTheme = readSetting('gtkTheme', defaults.gtkTheme);

        snapshot.timeouts = snapshot.timeouts && typeof snapshot.timeouts === 'object' && !Array.isArray(snapshot.timeouts)
            ? {...defaults.timeouts, ...snapshot.timeouts}
            : {...defaults.timeouts};

        snapshot.legacySettings = snapshot.legacySettings && typeof snapshot.legacySettings === 'object' && !Array.isArray(snapshot.legacySettings)
            ? {...defaults.legacySettings, ...snapshot.legacySettings}
            : {...defaults.legacySettings};

        return snapshot;
    }

    getSettingsManager() {
        return this.container?.get?.('settingsManager') || null;
    }

    syncGlobals(snapshot) {
        const manager = this.getSettingsManager();
        if (!(manager && snapshot && typeof snapshot === 'object')) return;

        const updates = Object.fromEntries(Object.entries(snapshot).filter(([, v]) => v !== undefined));
        Object.keys(updates).length > 0 && manager.update(updates);
    }

    captureState() {
        const manager = this.getSettingsManager();
        return {
            settings: manager ? clonePlainObject(manager.getAll()) : {}
        };
    }

    restoreState(snapshot) {
        snapshot?.settings && this.syncGlobals(snapshot.settings);
    }

    legacyPaths() {
        const home = GLib.get_home_dir();
        return this.legacyStorage
            ? this.legacyStorage.getPaths()
            : {
            prefDir: `${home}/.config/lastlayer_pref`,
            settingsFilePath: `${home}/.config/lastlayer_pref/theme_selector_settings.json`
        };
    }

    setupLegacyEnvironment({viewInstance, settings}) {
        const clone = clonePlainObject;
        const legacyStorage = this.legacyStorage;

        let settingsSupportBox, settingsSupportTabLabel, settingsSupportTabPageIndex;

        const loadSettingsFromFile = (options = {}) => {
            const forceLegacy = options === true || options.forceLegacy === true;
            const manager = this.getSettingsManager();
            const allowLegacyRead = forceLegacy || options.allowLegacyRead === true;

            const applySettings = (latestCompat) => {
                this.syncGlobals(latestCompat);
                viewInstance?.applySettingsToUI?.(latestCompat);
                return clone(latestCompat);
            };

            const loaded = (allowLegacyRead && legacyStorage) ? legacyStorage.read() : null;
            const runtimeSnapshot = !forceLegacy && manager
                ? this.composeSnapshot(manager.getAll())
                : (!forceLegacy && viewInstance?.store
                    ? this.composeSnapshot(viewInstance.store.snapshot.settings)
                    : null);
            if (runtimeSnapshot) return applySettings(runtimeSnapshot);
            if (loaded && typeof loaded === 'object') {
                const merged = clone(loaded);
                this.syncGlobals(merged);
                viewInstance?.applySettingsToUI?.(merged);
                return merged;
            }
            return {};
        };

        loadSettingsFromFile();

        const translationService = this.container?.get?.('translationService') || null;

        const translations = translationService?.getTranslations?.() ?? {};

        const baseTranslator = translationService?.getTranslator?.() || null;

        baseTranslator?.setLanguageOverride && settings?.language && baseTranslator.setLanguageOverride(settings.language);

        const translator = (key, paramsOrText = null, maybeParams = null) => {
            return baseTranslator
                ? baseTranslator(key, paramsOrText, maybeParams)
                : (paramsOrText && typeof paramsOrText === 'string')
                ? paramsOrText
                : ((paramsOrText && typeof paramsOrText === 'object' && !Array.isArray(paramsOrText))
                    ? String(key ?? '')
                    : (key ?? ''));
        };

        return {
            translator,
            translations,
            settingsSupportBox,
            settingsSupportTabLabel,
            settingsSupportTabPageIndex
        };
    }
}
