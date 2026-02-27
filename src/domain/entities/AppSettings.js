import GLib from 'gi://GLib';
import {
    DEFAULT_DANGEROUS_PATTERNS,
    DEFAULT_SECURITY_EXCEPTIONS
} from '../../infrastructure/proc/SecurityDefaults.js';
import { DEFAULT_SERVER_ADDRESS } from '../../infrastructure/constants/AppUrls.js';

export class AppSettings {

    static getDefaultThemesPath() {
        return `${GLib.get_home_dir()}/.config/themes`;
    }

    static assign(target, ...values) {
        return Object.assign(target, ...values);
    }

    constructor({
        serverUrl = DEFAULT_SERVER_ADDRESS,
        serverAddress = DEFAULT_SERVER_ADDRESS,
        cacheTtlMinutes = 60,
        cacheTimeout = 3600000,
        downloadsDir = '/tmp/lastlayer',
        enableLogs = false,
        analyticsOptIn = false,
        allowInsecureUpload = false,
        language = 'en',
        applyImmediately,
        applyNetworkThemesImmediately,
        closePopupAfterApply = false,
        animationType = 'grow',
        animationFPS = 240,
        animationAngle = 135,
        wallpaperDuration = 1.4,
        intermediateDefaultTransition = false,
        theme = null,
        restore_point_last_update = null,
        alt_bar = 'none',
        alt_timeout = 2.0,
        daemon_start_timeout = 0.3,
        post_install_delay = 0.3,
        post_reload_delay = 0.3,
        bar_check_interval = 0.1,
        terminal_poll_interval = 0.1,
        wallpaper_retry_delay = 0.5,
        daemon_poll_interval = 0.1,
        script_file_wait_interval = 0.2,
        window_operation_delay = 0.05,
        process_cleanup_delay = 0.05,
        default_theme_bar = 'none',
        default_bar_manual = false,
        skip_install_theme_apps = [],
        per_rice_isolation_mode = {},
        isolation_grouping_mode = 'hybrid',
        showApplyTime = false,
        sendPerformanceStats = false,
        testDataMode = false,
        localThemesPath = AppSettings.getDefaultThemesPath(),
        gtkTheme = 'LastLayer',
        pinned = false,
        useOldRequests = false,
        tweaksApplyOverride = false,
        soundEnabled = true,
        enable_dependency_isolation = true,
        patch_postinstall_scripts = true,
        patcher_hold_terminal = false,
        ignoredUpdateVersions = [],
        customBars = [],
        show_install_terminal = false,
        show_after_install_terminal = false,
        auto_close_install_terminal = false,
        auto_close_after_install_terminal = false,
        force_hide_script_terminals = false,
        dangerousPatterns = DEFAULT_DANGEROUS_PATTERNS,
        securityExceptions = DEFAULT_SECURITY_EXCEPTIONS,
        debugMode = false
    } = {}) {
        AppSettings.assign(this, {
            serverUrl,
            serverAddress,
            cacheTtlMinutes,
            cacheTimeout,
            downloadsDir,
            enableLogs,
            analyticsOptIn,
            allowInsecureUpload,
            language,
            applyImmediately,
            applyNetworkThemesImmediately,
            closePopupAfterApply,
            animationType,
            animationFPS,
            animationAngle,
            wallpaperDuration,
            intermediateDefaultTransition,
            theme,
            restore_point_last_update,
            alt_bar,
            alt_timeout,
            daemon_start_timeout,
            post_install_delay,
            post_reload_delay,
            bar_check_interval,
            terminal_poll_interval,
            wallpaper_retry_delay,
            daemon_poll_interval,
            script_file_wait_interval,
            window_operation_delay,
            process_cleanup_delay,
            default_theme_bar,
            default_bar_manual,
            skip_install_theme_apps,
            per_rice_isolation_mode,
            isolation_grouping_mode,
            showApplyTime,
            sendPerformanceStats,
            testDataMode,
            localThemesPath,
            gtkTheme,
            pinned,
            useOldRequests,
            tweaksApplyOverride,
            soundEnabled,
            enable_dependency_isolation,
            patch_postinstall_scripts,
            patcher_hold_terminal,
            ignoredUpdateVersions,
            customBars,
            show_install_terminal,
            show_after_install_terminal,
            auto_close_install_terminal,
            auto_close_after_install_terminal,
            force_hide_script_terminals,
            dangerousPatterns,
            securityExceptions,
            debugMode
        });
    }

    withPatch(patch = {}) {
        return AppSettings.assign(Object.create(AppSettings.prototype), this, patch);
    }
}
