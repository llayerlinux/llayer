import GLib from 'gi://GLib';
import { BarRegistry } from '../bars/BarRegistry.js';
import {
    applyTemplate,
    createTemplatePath,
    getCachedTemplate
} from './ScriptTemplateStore.js';

const BAR_TEMPLATES = {
    startCases: BarRegistry.generateBashStartCases(),
    array: BarRegistry.bashArray(),
    list: BarRegistry.bashList()
};

const TEMPLATE_PATHS = {
    themeDownload: createTemplatePath('theme_download.sh'),
    applyThemeSwitch: createTemplatePath('apply_theme_switch.sh'),
    findAndBackupHyprland: createTemplatePath('find_and_backup_hyprland.sh'),
    startPointUpdate: createTemplatePath('start_point_update.sh')
};
const TEMPLATE_CACHE = new Map();

export class ScriptBuilder {

    static clearTemplateCache() {
        TEMPLATE_CACHE.clear();
    }

    static buildThemeDownloadScript({zipPath, url, cacheDir, themeName}) {
        const template = (!zipPath || !url || !cacheDir || !themeName)
            ? null
            : getCachedTemplate(TEMPLATE_PATHS.themeDownload, TEMPLATE_CACHE);
        return template
            ? applyTemplate(template, {
                ZIP_PATH: zipPath,
                URL: url,
                CACHE_DIR: cacheDir,
                THEME_NAME: themeName
            })
            : '';
    }

    static buildApplyThemeSwitchScript(theme, settings = {}, homeDir = GLib.get_home_dir(), options = {}) {
        const themeName = theme?.name || 'default';
        const boolToString = (value) => (value ? 'true' : 'false');
        const template = getCachedTemplate(TEMPLATE_PATHS.applyThemeSwitch, TEMPLATE_CACHE);
        return template
            ? applyTemplate(template, {
                THEME_NAME: themeName,
                VARIANT: options.variant || '',
                ANIMATION_TYPE: settings.animationType || 'grow',
                ANIMATION_FPS: settings.animationFPS || 240,
                ANIMATION_ANGLE: settings.animationAngle || 0,
                TRANSITION_DURATION: settings.wallpaperDuration || 1.3,
                INTERMEDIATE_DEFAULT: settings.intermediateDefaultTransition ? '1' : '0',
                SHOW_INSTALL_TERMINAL: boolToString(settings.show_install_terminal),
                AUTO_CLOSE_INSTALL_TERMINAL: boolToString(settings.auto_close_install_terminal),
                SHOW_AFTER_INSTALL_TERMINAL: boolToString(settings.show_after_install_terminal),
                AUTO_CLOSE_AFTER_INSTALL_TERMINAL: boolToString(settings.auto_close_after_install_terminal),
                DAEMON_START_TIMEOUT: settings.daemon_start_timeout || 0.3,
                POST_INSTALL_DELAY: settings.post_install_delay || 0.3,
                POST_RELOAD_DELAY: settings.post_reload_delay || 0.3,
                BAR_CHECK_INTERVAL: settings.bar_check_interval || 0.1,
                TERMINAL_POLL_INTERVAL: settings.terminal_poll_interval || 0.1,
                WALLPAPER_RETRY_DELAY: settings.wallpaper_retry_delay || 0.5,
                DAEMON_POLL_INTERVAL: settings.daemon_poll_interval || 0.1,
                SCRIPT_FILE_WAIT_INTERVAL: settings.script_file_wait_interval || 0.2,
                WINDOW_OPERATION_DELAY: settings.window_operation_delay || 0.05,
                PROCESS_CLEANUP_DELAY: settings.process_cleanup_delay || 0.05,
                ISOLATION_SECTION: settings.enable_dependency_isolation
                    ? this.buildIsolationPathSection(themeName, settings.isolation_grouping_mode || 'hybrid', homeDir)
                    : '',
                HOME_DIR: homeDir,
                BAR_ARRAY: BAR_TEMPLATES.array,
                BAR_START_CASES: BAR_TEMPLATES.startCases,
                BAR_LIST: BAR_TEMPLATES.list
            })
            : '';
    }

    static buildIsolationPathSection(themeName, mode, homeDir) {
        const basePath = `${homeDir}/.local/share/lastlayer/programs`;
        let pathAdditions = '';

        switch (mode) {
            case 'per-rice':
                pathAdditions = `
__LL_ISOLATION_PREFIX="${basePath}/rices/${themeName}"
__LL_VENV_PATH="$__LL_ISOLATION_PREFIX/venv"
if [ -d "$__LL_ISOLATION_PREFIX/bin" ]; then
    export PATH="$__LL_ISOLATION_PREFIX/bin:$PATH"
fi
if [ -d "$__LL_ISOLATION_PREFIX/lib" ]; then
    export LD_LIBRARY_PATH="$__LL_ISOLATION_PREFIX/lib:\${LD_LIBRARY_PATH:-}"
fi
if [ -f "$__LL_VENV_PATH/bin/activate" ]; then
    source "$__LL_VENV_PATH/bin/activate"
fi
`;
                break;

            case 'per-program':
                pathAdditions = `
__LL_ISOLATION_BASE="${basePath}"
for prog_dir in "$__LL_ISOLATION_BASE"; do
    for ver_dir in "\${prog_dir}"*/; do
        [ -d "\${ver_dir}bin" ] && export PATH="\${ver_dir}bin:$PATH"
        [ -d "\${ver_dir}lib" ] && export LD_LIBRARY_PATH="\${ver_dir}lib:\${LD_LIBRARY_PATH:-}"
    done
done

if [ -d "$__LL_ISOLATION_RICE/bin" ]; then
    export PATH="$__LL_ISOLATION_RICE/bin:$PATH"
fi
if [ -d "$__LL_ISOLATION_RICE/lib" ]; then
    export LD_LIBRARY_PATH="$__LL_ISOLATION_RICE/lib:\${LD_LIBRARY_PATH:-}"
fi
if [ -f "$__LL_VENV_PATH/bin/activate" ]; then
    source "$__LL_VENV_PATH/bin/activate"
fi
`;
                break;
        }

        return pathAdditions;
    }

    static buildFindAndBackupHyprlandScript(defaultBackupDir = '$HOME/.config/themes/default/default_wallpapers') {
        const template = getCachedTemplate(TEMPLATE_PATHS.findAndBackupHyprland, TEMPLATE_CACHE);
        return template ? applyTemplate(template, { DEFAULT_BACKUP_DIR: defaultBackupDir }) : '';
    }

    static buildStartPointUpdateScript() {
        return getCachedTemplate(TEMPLATE_PATHS.startPointUpdate, TEMPLATE_CACHE) || '';
    }
}
