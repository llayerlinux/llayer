import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../constants/Commands.js';
import { ThemeSource } from '../../domain/entities/Theme.js';
import { fileExists, isDir } from '../utils/Utils.js';

export class ThemeInstallationService {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger;
        this.taskRunner = dependencies.taskRunner;
        this.securityManager = dependencies.securityManager;
        this.eventBus = dependencies.eventBus;
        this.notifier = dependencies.notifier;
        this.settingsService = dependencies.settingsService;
        this.Commands = dependencies.Commands || Commands;
        this.ThemeSource = dependencies.ThemeSource || ThemeSource;

        this.tempDir = '/tmp/lastlayer';
        this.backupDir = `${GLib.get_home_dir()}/.config/lastlayer/backups`;
        this.themesDir = `${GLib.get_home_dir()}/.config/themes`;
    }

    getHyprlandConfigDir() {
        return `${GLib.get_home_dir()}/.config/hypr`;
    }

    getThemePath(theme) {
        return theme?.path || (theme?.name ? `${this.themesDir}/${theme.name}` : null);
    }

    getScriptNameVariants(scriptName) {
        switch (scriptName) {
            case 'installThemeApps.sh':
            case 'install_theme_apps.sh':
                return ['installThemeApps.sh', 'install_theme_apps.sh'];
            case 'setAfterInstallActions.sh':
            case 'set_after_install_actions.sh':
                return ['setAfterInstallActions.sh', 'set_after_install_actions.sh'];
            default:
                return [scriptName];
        }
    }

    determineScriptPath(themePath, scriptName) {
        const scriptVariants = this.getScriptNameVariants(scriptName);
        for (const dir of ['start-scripts', 'scripts']) {
            for (const variant of scriptVariants) {
                const candidate = `${themePath}/${dir}/${variant}`;
                if (fileExists(candidate)) {
                    return candidate;
                }
            }
        }

        return null;
    }

    async applyTheme(theme, options = {}) {
        const startTime = Date.now();
        const validation = await this.validateTheme(theme);
        const fail = (message) => ({success: false, theme, duration: 0, backupPath: null, wasInSkipList: false, message});

        if (!validation.valid) {
            return fail(validation.message || 'Theme validation failed');
        }

        const settingsService = options.settingsService || this.settingsService;
        if (!settingsService) {
            return fail('SettingsService is not available to check skip list');
        }

        await this.ensureDirectories();

        const wasInSkipList = settingsService.isThemeInSkipList(theme.name);
        const backupPath = await this.createBackup();

        const result = !(theme.installScript || this.hasInstallationScripts(theme))
            ? await this.executeBasicThemeApplication(theme, {backupPath})
            : (wasInSkipList
                ? await this.executeSetAfterInstallActions(theme, {backupPath})
                : await this.executeInstallThemeApps(theme, {backupPath}));

        result.success && settingsService?.setCurrentTheme?.(theme.name);
        result.success && await this.reloadHyprland();

        const duration = Date.now() - startTime;

        return {
            success: result.success,
            theme,
            duration,
            backupPath,
            wasInSkipList,
            message: result.message || `Theme ${theme.title || theme.name} applied successfully`
        };
    }

    async validateTheme(theme) {
        if (!(theme && theme.name)) {
            return {valid: false, message: 'Invalid theme: missing name'};
        }
        let themePath = `${this.themesDir}/${theme.name}`;
        let isLocalSource = theme.source === this.ThemeSource.LOCAL
            || theme.source === this.ThemeSource.LOCAL_WITH_METADATA;
        if (isLocalSource && !isDir(themePath)) {
            return {valid: false, message: `Theme folder not found: ${themePath}`};
        }
        return {valid: true};
    }

    async ensureDirectories() {
        for (const dir of [this.tempDir, this.backupDir]) {
            !isDir(dir) && Gio.File.new_for_path(dir).make_directory_with_parents(null);
        }
    }

    async createBackup() {
        const backupPath = `${this.backupDir}/backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        isDir(this.getHyprlandConfigDir())
            && await this.copyDirectory(this.getHyprlandConfigDir(), `${backupPath}/hypr`);
        return backupPath;
    }

    async validateScript(scriptPath) {
        const [ok, content] = GLib.file_get_contents(scriptPath);
        return (this.securityManager && ok)
            ? (() => {
                const validation = this.securityManager.validateScript(new TextDecoder('utf-8').decode(content));
                return validation.safe ? {safe: true} : {safe: false, reason: validation.reason};
            })()
            : {safe: true};
    }

    async copyDirectory(source, destination) {
        this.taskRunner && await this.taskRunner.run(this.Commands.CP, ['-r', source, destination]);
    }

    async executeInstallThemeApps(theme, context = {}) {
        const themePath = this.getThemePath(theme);
        const installScript = this.determineScriptPath(themePath, 'installThemeApps.sh');
        const validation = installScript ? await this.validateScript(installScript) : {safe: true};
        if (!installScript) {
            return {success: true, message: 'Install script not found — skipping package installation'};
        }
        if (!validation.safe) {
            return {success: false, message: `Unsafe install script: ${validation.reason}`};
        }

        await this.taskRunner.run(this.Commands.BASH, [installScript], {
            critical: true,
            timeout: 300000,
            context: {theme: theme.name, type: 'installThemeApps', ...context}
        });

        return {success: true, message: 'Theme packages installed successfully'};
    }

    async executeSetAfterInstallActions(theme, context = {}) {
        const themePath = this.getThemePath(theme);
        const actionScript = this.determineScriptPath(themePath, 'setAfterInstallActions.sh');
        const validation = actionScript ? await this.validateScript(actionScript) : {safe: true};
        if (!actionScript) {
            return this.executeBasicThemeApplication(theme, context);
        }
        if (!validation.safe) {
            return {success: false, message: `Unsafe post-install script: ${validation.reason}`};
        }

        await this.taskRunner.run(this.Commands.BASH, [actionScript], {
            critical: true,
            timeout: 120000,
            context: {theme: theme.name, type: 'setAfterInstallActions', ...context}
        });

        return {success: true, message: 'Theme configuration applied successfully'};
    }

    async executeBasicThemeApplication(theme, context = {}) {
        const themePath = this.getThemePath(theme);
        const hyprConfig = this.getHyprlandConfigDir();

        for (const file of [
            {from: `${themePath}/hyprland.conf`, to: `${hyprConfig}/hyprland.conf`},
            {from: `${themePath}/wallpaper.jpg`, to: `${hyprConfig}/wallpaper.jpg`},
            {from: `${themePath}/wallpaper.png`, to: `${hyprConfig}/wallpaper.jpg`}
        ].filter((file) => this.taskRunner && fileExists(file.from))) {
            await this.taskRunner.run(this.Commands.CP, [file.from, file.to]);
        }

        const configsDir = `${themePath}/configs`;
        isDir(configsDir)
            && await this.taskRunner.run(this.Commands.CP, ['-r', `${configsDir}/.`, hyprConfig]);

        return {
            success: true,
            message: 'Basic theme application completed'
        };
    }

    async reloadHyprland() {
        await new Promise(done => setTimeout(done, 1000));
        await this.taskRunner.run(this.Commands.HYPRCTL, ['reload']);
    }

    hasInstallationScripts(theme) {
        const basePath = this.getThemePath(theme);
        return Boolean(
            basePath && ['installThemeApps.sh', 'setAfterInstallActions.sh']
                .some((scriptName) => this.determineScriptPath(basePath, scriptName))
        );
    }
}
