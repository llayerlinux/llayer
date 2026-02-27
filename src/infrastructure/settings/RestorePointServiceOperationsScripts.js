import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../constants/Commands.js';
import { Events } from '../../app/eventBus.js';
import { DEFAULT_BACKUP_FOLDERS } from '../constants/BackupDefaults.js';
export function applyRestorePointServiceOperationsScripts(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, RestorePointServiceOperationsScripts.prototype);
}

class RestorePointServiceOperationsScripts {
    ensureInitialAutomaticRestorePoint() {
        const existing = this.listRestorePoints({limit: 1000});
        const automaticPoint = existing.find((point) => point.type === 'automatic') || null;
        return automaticPoint
            ? {created: false, point: automaticPoint}
            : (
                GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 1500, () => {
                    this.spawnInitialAutomaticRestorePoint();
                    return GLib.SOURCE_REMOVE;
                }),
                {created: false, point: null, deferred: true}
            );
    }

    hasAutomaticRestorePoint() {
        return this.listRestorePoints({limit: 1000}).some((p) => p.type === 'automatic');
    }

    spawnInitialAutomaticRestorePoint() {
        if (this.hasAutomaticRestorePoint()) return;

        const rawTheme = this.settingsService?.getCurrentTheme?.()
            || this.readCurrentThemeFile()
            || 'default';
        const sourceTheme = (rawTheme === 'default')
            ? (this.detectActiveThemeFromHyprConf() || 'default')
            : rawTheme;
        const folderSet = new Set(this.loadBackupFoldersFromSettings());
        DEFAULT_BACKUP_FOLDERS.forEach((f) => folderSet.add(f));
        folderSet.delete('hypr');
        folderSet.add('default_wallpapers');

        this.updateBackupScript(Array.from(folderSet), {mergeWithConfigured: false});
        this.ensureUpdateScriptExists();
        this.ensureFindAndBackupScriptExists();

        const argv = [Commands.BASH, this.updateScriptPath, '--no-notify'];
        try {
            const [ok, pid] = GLib.spawn_async(
                GLib.get_home_dir(), argv, GLib.get_environ(),
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );
            if (!ok || !pid) {
                this.finishInitialAutomaticRestorePoint(sourceTheme, folderSet);
                return;
            }
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {
                this.finishInitialAutomaticRestorePoint(sourceTheme, folderSet);
            });
        } catch (_) {
            this.finishInitialAutomaticRestorePoint(sourceTheme, folderSet);
        }
    }

    finishInitialAutomaticRestorePoint(sourceTheme, folderSet) {
        this.hasAutomaticRestorePoint() || (() => {
            const defaultDir = this.getDefaultThemeDir();
            this.regenerateEffective?.(defaultDir);
            const detectedBar = this.getConfiguredDefaultThemeBar();
            const snapshot = this.createRestorePointSnapshot({
                type: 'automatic',
                sourceTheme,
                defaultThemeBar: detectedBar || 'none',
                defaultBarManual: false,
                selectedFolders: Array.from(folderSet),
                timestamp: this.getCurrentLocalTimestamp()
            });
            snapshot?.id && this.finalizeRestorePointSnapshot(snapshot, 'RestorePointService.initial-automatic');
        })();
    }

    createFindAndBackupHyprlandScript() {
        return this.scriptBuilder?.buildFindAndBackupHyprlandScript() ?? '';
    }

    loadBundledScriptContent() {
        const fromTemplate = this.scriptBuilder?.buildStartPointUpdateScript() ?? '';
        if (fromTemplate) return fromTemplate;

        const currentDir = GLib.get_current_dir();
        const candidates = [GLib.build_filenamev([currentDir, 'scripts', 'start_point_update.sh']), GLib.build_filenamev([currentDir, 'js', 'scripts', 'start_point_update.sh'])];
        return candidates
            .map((bundledPath) => Gio.File.new_for_path(bundledPath).query_exists(null) ? this.readFileText(bundledPath) : null)
            .find(Boolean) || '';
    }

    scriptLooksComplete() {
        const text = Gio.File.new_for_path(this.updateScriptPath).query_exists(null)
            && this.readFileText(this.updateScriptPath);
        return !!text && [
            'START_SCRIPTS_DIR="$DEFAULT_THEME_DIR/start-scripts"',
            'notifySafe',
            'rm -rf "$DEFAULT_THEME_DIR"',
            'THEME_CONFIG_DIR'
        ].every(marker => text.includes(marker));
    }

    async backupHyprland(targetDir = null) {
        let defaultDir = this.getDefaultThemeDir();
        let targetPath = (typeof targetDir === 'string' && targetDir.trim().length)
            ? this.parseThemesPath(targetDir)
            : `${defaultDir}/default_wallpapers`;

        this.ensureDir(defaultDir);
        this.ensureDir(targetPath);

        const scriptPath = `${GLib.get_tmp_dir()}/find_and_backup_hyprland_${Date.now()}.sh`;
        GLib.file_set_contents(scriptPath, this.createFindAndBackupHyprlandScript());
        await this.execAsync([Commands.CHMOD, '+x', scriptPath]);
        await this.execAsync([Commands.BASH, scriptPath, targetPath]);

        this.removeFile(scriptPath);
    }

    needsScriptWrite() {
        return !Gio.File.new_for_path(this.updateScriptPath).query_exists(null) || !this.scriptLooksComplete();
    }

    makeExecutable(path) {
        return this.execAsync
            ? this.execAsync([Commands.CHMOD, '+x', path])
            : (() => {
                let file = Gio.File.new_for_path(path);
                let info = file.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null);
                let mode = info.get_attribute_uint32('unix::mode');
                info.set_attribute_uint32('unix::mode', mode | 0o111);
                file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
                return undefined;
            })();
    }

    ensureUpdateScriptExists() {
        this.ensureDir(this.scriptDir);
        this.needsScriptWrite() && (
            GLib.file_set_contents(this.updateScriptPath, this.loadBundledScriptContent()),
            this.makeExecutable(this.updateScriptPath)
        );
    }

    ensureFindAndBackupScriptExists() {
        this.ensureDir(this.scriptDir);
        const scriptPath = `${this.scriptDir}/find_and_backup_hyprland.sh`;
        const scriptContent = this.createFindAndBackupHyprlandScript();
        scriptContent && scriptContent.length && (
            GLib.file_set_contents(scriptPath, scriptContent),
            this.makeExecutable(scriptPath)
        );
    }

    buildFolderSet(folders, {mergeWithConfigured = true} = {}) {
        const unique = new Set(mergeWithConfigured ? this.loadBackupFoldersFromSettings() : []);
        folders.filter(f => typeof f === 'string' && f.trim()).forEach(f => unique.add(f.trim()));
        unique.delete('hypr');
        unique.delete('default_wallpapers');
        const ordered = Array.from(unique);
        ordered.includes('default_wallpapers') || ordered.push('default_wallpapers');
        return ordered;
    }

    updateScriptFolderLine(scriptText, folders) {
        const newLine = `for dir in ${folders.join(' ')}; do`;
        return /^for dir in .*; do/m.test(scriptText)
            ? scriptText.replace(/^for dir in .*; do/m, newLine)
            : `${newLine}\n${scriptText}`;
    }

    updateBackupScript(folders = [], {mergeWithConfigured = true} = {}) {
        this.ensureUpdateScriptExists();
        const orderedFolders = this.buildFolderSet(folders, {mergeWithConfigured});
        const text = this.readFileText(this.updateScriptPath);
        return text
            ? (GLib.file_set_contents(this.updateScriptPath, this.updateScriptFolderLine(text, orderedFolders)), true)
            : false;
    }

    setCurrentTheme(themeName) {
        const trimmed = (typeof themeName === 'string') ? themeName.trim() : '';
        return trimmed.length > 0
            ? (
                this.settingsService?.setCurrentTheme(trimmed),
                this.eventBus?.emit?.(Events.THEME_UI_UPDATE_CURRENT, {themeName: trimmed, theme: {name: trimmed}}),
                true
            )
            : false;
    }

    notifyThemeListChanged() {
        const emit = this.eventBus?.emit?.bind(this.eventBus);
        emit && (
            emit(Events.THEME_REPOSITORY_UPDATED, {emitter: 'RestorePointService'}),
            emit(Events.APPSETTINGS_THEMEAPPS_REFRESH, {emitter: 'RestorePointService'})
        );
    }

    async refreshRestorePoint({
        folders = [],
        theme = null,
        keepCurrentTheme = false,
        snapshotType = 'manual',
        sourceTheme = null,
        mergeWithConfiguredFolders = true
    } = {}) {
        const folderSet = new Set(mergeWithConfiguredFolders ? this.loadBackupFoldersFromSettings() : []);
        (Array.isArray(folders) ? folders : []).forEach((folder) => {
            const normalized = typeof folder === 'string' ? folder.trim() : '';
            normalized && folderSet.add(normalized);
        });
        folderSet.delete('hypr');
        folderSet.add('default_wallpapers');

        this.updateBackupScript(Array.from(folderSet), {mergeWithConfigured: false});
        this.ensureUpdateScriptExists();

        const originalTheme = this.readCurrentThemeFile();
        const chosenTheme = (typeof theme === 'string' ? theme.trim() : '')
            || (originalTheme && originalTheme !== 'default' ? originalTheme : '')
            || this.settingsService?.getCurrentTheme?.()
            || originalTheme
            || 'default';

        const themesBaseDir = this.getThemesBasePath();
        this.ensureDir(themesBaseDir);
        const defaultDir = this.getDefaultThemeDir(themesBaseDir);

        chosenTheme && originalTheme !== chosenTheme && this.ensureCurrentThemeFile(chosenTheme);
        const provisionalNow = GLib.DateTime.new_now_local();
        const provisionalTimestamp = provisionalNow ? provisionalNow.format('%Y-%m-%d %H:%M:%S') : null;

        this.lastUpdateTimestamp = provisionalTimestamp || null;

        provisionalTimestamp && (
            this.settingsService?.setRestorePointLastUpdate?.(provisionalTimestamp),
            this.emitRestorePointDisplay(provisionalTimestamp, 'RestorePointService')
        );

        this.ensureUpdateScriptExists();
        this.ensureFindAndBackupScriptExists();

        const scriptArgs = [Commands.BASH, this.updateScriptPath, '--no-notify'];
        try {
            await this.exec(scriptArgs);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.debug(`[RestorePointService] update script failed: ${message}`);
        }

        const now = GLib.DateTime.new_now_local();
        const timestamp = now ? now.format('%Y-%m-%d %H:%M:%S') : provisionalTimestamp;
        const finalTimestamp = (timestamp && timestamp.trim().length) ? timestamp : provisionalTimestamp || null;

        finalTimestamp && (
            this.settingsService?.setRestorePointLastUpdate?.(finalTimestamp),
            this.lastUpdateTimestamp = finalTimestamp,
            this.emitRestorePointDisplay(finalTimestamp, 'RestorePointService')
        );

        this.ensureDir(defaultDir);
        this.regenerateEffective?.(defaultDir);
        const detectedBar = await this.detectRunningBar();
        const resolvedBar = detectedBar === 'none'
            ? this.getConfiguredDefaultThemeBar()
            : detectedBar;

        const selectorPatch = keepCurrentTheme
            ? {
                theme: chosenTheme || originalTheme || 'default',
                default_theme_bar: resolvedBar,
                default_bar_manual: false
            }
            : {
                theme: 'default',
                default_theme_bar: resolvedBar,
                default_bar_manual: false
            };

        const snapshot = this.createRestorePointSnapshot({
            type: snapshotType,
            sourceTheme: sourceTheme || chosenTheme || 'default',
            defaultThemeBar: resolvedBar || 'none',
            defaultBarManual: false,
            selectedFolders: Array.from(folderSet),
            timestamp: finalTimestamp
        });

        try {
            const applyThemeSelection = keepCurrentTheme && chosenTheme && chosenTheme !== 'default'
                ? () => {
                    this.ensureCurrentThemeFile(chosenTheme);
                    this.setCurrentTheme(chosenTheme);
                }
                : () => {
                    this.setCurrentTheme('default');
                };
            applyThemeSelection();
            this.updateThemeSelectorSettings(selectorPatch);
            this.syncPrimarySettings(selectorPatch);
        } catch (_error) {
        }
        this.notifyThemeListChanged();
        finalTimestamp && this.emitRestorePointDisplay(finalTimestamp, 'RestorePointService.snapshot');

        const lastUpdateFallbackNow = GLib.DateTime.new_now_local();
        const lastUpdate = this.lastUpdateTimestamp
            || (lastUpdateFallbackNow ? lastUpdateFallbackNow.format('%Y-%m-%d %H:%M:%S') : null);

        return {
            detectedBar: resolvedBar,
            snapshot,
            lastUpdate
        };
    }

}
