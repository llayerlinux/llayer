import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../../infrastructure/constants/Commands.js';
import { BarRegistry } from '../../infrastructure/bars/BarRegistry.js';
import {
    copyIfExists,
    existsDir,
    existsFile,
    removeMissingEntries,
    removePath
} from '../../infrastructure/utils/FileExecUtils.js';
const COMMANDS = Commands;

export class UpdateHyprlandCheckpointUseCase {
    constructor({
                    execAsync = null,
                    runEmbeddedFindAndBackupHyprland = null,
                    updateBackupScript = null,
                    restorePointService = null,
                    logger = null
                } = {}) {
        this.execAsync = execAsync || null;
        this.runEmbeddedFindAndBackupHyprland = runEmbeddedFindAndBackupHyprland || null;
        this.updateBackupScript = updateBackupScript || null;
        this.restorePointService = restorePointService || null;
        this.logger = logger || null;
        this.homeDir = GLib.get_home_dir();
    }

    decodeOutput(stdout) {
        return stdout ? new TextDecoder('utf-8').decode(stdout).trim() : '';
    }

    currentTimestamp() {
        const now = GLib.DateTime.new_now_local();
        return now ? now.format('%Y-%m-%d %H:%M:%S') : null;
    }

    async exec(argv) {
        return this.execAsync ? this.execAsync(argv) : null;
    }

    async execute({folders = [], theme = null} = {}) {
        const selectedFolders = new Set(Array.isArray(folders) ? folders : []);
        selectedFolders.add('default_wallpapers');

        const service = this.restorePointService;
        const sourceTheme = (typeof theme === 'string' && theme.trim()) ? theme.trim() : null;

        if (service && typeof service.createManualRestorePoint === 'function') {
            let snapshot = null;
            try {
                snapshot = await service.createManualRestorePoint({
                    folders: [...selectedFolders],
                    sourceTheme: sourceTheme || 'default'
                });
            } catch (_error) {
                snapshot = null;
            }
            return {
                detectedBar: snapshot?.defaultThemeBar || 'none',
                snapshot: snapshot || null,
                lastUpdate: snapshot?.timestamp || this.currentTimestamp()
            };
        }

        return service?.refreshRestorePoint
            ? await (async () => {
                let refreshed = null;
                try {
                    refreshed = await service.refreshRestorePoint.call(service, {
                        folders: [...selectedFolders],
                        theme: sourceTheme,
                        sourceTheme,
                        mergeWithConfiguredFolders: false
                    });
                } catch (_error) {
                    refreshed = null;
                }
                return {
                    detectedBar: refreshed?.detectedBar || 'none',
                    snapshot: refreshed?.snapshot || null,
                    lastUpdate: refreshed?.lastUpdate || this.currentTimestamp()
                };
            })()
            : (async () => {
                this.updateBackupScript?.([...selectedFolders]);

                const defaultThemeRoot = `${this.homeDir}/.config/themes/default`;
                await Promise.all([
                    removePath(this.exec.bind(this), `${defaultThemeRoot}/configs`),
                    removePath(this.exec.bind(this), `${defaultThemeRoot}/default_wallpapers`)
                ]);

                const defaultWallpapersDir = `${defaultThemeRoot}/default_wallpapers`;
                await this.runEmbeddedFindAndBackupHyprland?.(defaultWallpapersDir);

                const themeToBackup = await this.getThemeName(theme);
                const themeDir = `${this.homeDir}/.config/themes/${themeToBackup}`;

                themeToBackup !== 'default' && await this.copyHyprlandResources(themeDir, defaultThemeRoot);

                const hasConf = await this.existsFile(`${themeDir}/hyprland.conf`);
                const hasDir = await this.existsDir(`${themeDir}/hyprland`);

                await removeMissingEntries(this.exec.bind(this), [
                    {
                        present: hasConf,
                        path: `${defaultThemeRoot}/hyprland.conf`,
                        check: this.existsFile.bind(this)
                    },
                    {
                        present: hasDir,
                        path: `${defaultThemeRoot}/hyprland`,
                        check: this.existsDir.bind(this)
                    }
                ]);

                const detectedBar = await this.detectRunningBar();
                return {detectedBar, lastUpdate: this.currentTimestamp()};
            })();
    }

    async getThemeName(theme) {
        if (typeof theme === 'string' && theme.trim()) return theme.trim();

        const themeFilePath = `${this.homeDir}/.config/lastlayer_pref/current_theme`;
        if (!Gio.File.new_for_path(themeFilePath).query_exists(null)) return 'default';

        const [ok, content] = GLib.file_get_contents(themeFilePath);
        return (ok && content) ? this.decodeOutput(content) : 'default';
    }

    async copyHyprlandResources(themeDir, defaultThemeRoot) {
        const tasks = [
            {
                exists: () => this.existsFile(`${themeDir}/hyprland.conf`),
                args: [COMMANDS.CP, `${themeDir}/hyprland.conf`, defaultThemeRoot]
            },
            {
                exists: () => this.existsDir(`${themeDir}/hyprland`),
                args: [COMMANDS.CP, '-r', `${themeDir}/hyprland`, defaultThemeRoot]
            }
        ];

        await copyIfExists(this.exec.bind(this), tasks, defaultThemeRoot);
    }

    async existsFile(path) {
        return existsFile(this.exec.bind(this), path);
    }

    async existsDir(path) {
        return existsDir(this.exec.bind(this), path);
    }

    async detectRunningBar() {
        const bars = BarRegistry.getIds().filter(id => !BarRegistry.hasSpecialKill(id));
        const detected = bars.find((bar) => {
            const [success, stdout] = GLib.spawn_command_line_sync(`${COMMANDS.PGREP} ${bar}`);
            const output = (success && stdout) ? this.decodeOutput(stdout) : '';
            return !!output;
        });
        return detected || 'none';
    }
}
