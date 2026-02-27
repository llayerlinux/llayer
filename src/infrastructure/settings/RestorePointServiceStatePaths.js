import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { DEFAULT_BACKUP_FOLDERS } from '../constants/BackupDefaults.js';
import { tryOrNull } from '../utils/ErrorUtils.js';
import { parseThemesPath } from '../utils/Utils.js';

export function applyRestorePointServiceStatePaths(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, RestorePointServiceStatePaths.prototype);
}

class RestorePointServiceStatePaths {
    loadBackupFoldersFromSettings() {
        const storedFolders = this.settingsService?.settingsManager?.get?.('backupFolders');
        return Array.isArray(storedFolders) && storedFolders.length
            ? [...storedFolders]
            : DEFAULT_BACKUP_FOLDERS;
    }

    ensureDir(path) {
        const dir = Gio.File.new_for_path(path);
        dir.query_exists(null) || dir.make_directory_with_parents(null);
    }

    trimStr(value, fallback = '') {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        return trimmed || fallback;
    }

    readFileText(path) {
        const [ok, content] = tryOrNull('RestorePointService.readFileText', () => GLib.file_get_contents(path)) || [];
        return ok ? new TextDecoder('utf-8').decode(content) : null;
    }

    parseThemesPath(path) {
        return parseThemesPath(path, this.homeDir);
    }

    getThemesBasePath() {
        const settings = this.settingsService?.getAll
            ? this.settingsService.getAll()
            : (this.settingsService && this.settingsService.settings)
                ? this.settingsService.settings
                : null;
        const localThemesPath = typeof settings?.localThemesPath === 'string'
            ? settings.localThemesPath.trim()
            : '';
        return this.parseThemesPath(localThemesPath || `${this.homeDir}/.config/themes`);
    }

    async exec(argv) {
        return this.execAsync ? this.execAsync(argv) : null;
    }

    getDefaultThemeDir(basePath = null) {
        const themesBase = basePath ? this.parseThemesPath(basePath) : this.getThemesBasePath();
        const defaultDir = `${themesBase}/default`;
        (this.defaultThemeDir && this.defaultThemeDir !== defaultDir) && (this.defaultThemeDir = defaultDir);
        return defaultDir;
    }

    getRestorePointsRootDir(basePath = null) {
        const themesBase = basePath ? this.parseThemesPath(basePath) : this.getThemesBasePath();
        return `${themesBase}/.restore_points`;
    }

    getCurrentLocalTimestamp() {
        const now = GLib.DateTime.new_now_local();
        return now ? now.format('%Y-%m-%d %H:%M:%S') : null;
    }

    padTimePart(value) {
        return String(value).padStart(2, '0');
    }

    formatTimestampFromDate(date) {
        return date instanceof Date && !Number.isNaN(date.getTime())
            ? [
                date.getFullYear(),
                this.padTimePart(date.getMonth() + 1),
                this.padTimePart(date.getDate())
            ].join('-') + ` ${
                this.padTimePart(date.getHours())
            }:${
                this.padTimePart(date.getMinutes())
            }:${
                this.padTimePart(date.getSeconds())
            }`
            : this.getCurrentLocalTimestamp();
    }

    parseSnapshotDate(value) {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw.length) return null;

        const expanded = (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw).replace(/\s+/, ' ');
        return [expanded, expanded.replace(' ', 'T')]
            .map(c => new Date(c))
            .find(d => !Number.isNaN(d.getTime())) || null;
    }

    normalizeSnapshotTimestamp(value) {
        return this.formatTimestampFromDate(this.parseSnapshotDate(value) || new Date());
    }

    normalizeSnapshotCreatedAt(value) {
        const parsed = this.parseSnapshotDate(value);
        return parsed ? parsed.toISOString() : new Date().toISOString();
    }

    standardizeSnapshotType(type) {
        const normalized = (typeof type === 'string' ? type.trim().toLowerCase() : '');
        return [
            'automatic',
            'auto',
            'install',
            'post_install',
            'after_install'
        ].includes(normalized)
            ? 'automatic'
            : 'manual';
    }

    isTrustedRestorePointId(id) {
        return typeof id === 'string' && /^rp-\d{13}-[a-z0-9]{6}$/.test(id);
    }

    buildRestorePointId() {
        return `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    getRestorePointPath(id) {
        return `${this.getRestorePointsRootDir()}/${id}`;
    }

    extractRestorePointDateFromId(id) {
        const match = /^rp-(\d{13})-[a-z0-9]{6}$/.exec(this.trimStr(id));
        if (!match) return null;

        const parsed = new Date(Number(match[1]));
        return Number.isFinite(parsed.getTime()) ? parsed : null;
    }

    buildFallbackRestorePointEntry(id) {
        if (!this.isTrustedRestorePointId(id)) {
            return null;
        }
        const date = this.extractRestorePointDateFromId(id) || new Date();
        return this.standardizeSnapshotEntry({
            id,
            createdAt: date.toISOString(),
            timestamp: this.formatTimestampFromDate(date),
            sourceTheme: 'default',
            type: 'manual',
            defaultThemeBar: 'none',
            defaultBarManual: false
        });
    }

    listRestorePointIdsFromFilesystem() {
        const rootPath = this.getRestorePointsRootDir(),
            root = Gio.File.new_for_path(rootPath);
        if (!root.query_exists(null)) return [];

        let enumerator = tryOrNull(
            'RestorePointService.listRestorePointIdsFromFilesystem.enumerate',
            () => root.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            )
        );
        if (!enumerator) return [];

        let ids = [], info;
        while ((info = tryOrNull('RestorePointService.listRestorePointIdsFromFilesystem.next', () => enumerator.next_file(null))) !== null) {
            if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;
            let name = info.get_name();
            this.isTrustedRestorePointId(name) && ids.push(name);
        }
        tryOrNull('RestorePointService.listRestorePointIdsFromFilesystem.close', () => enumerator.close(null));
        return ids;
    }

    inferRestorePointBar(pointPath) {
        let root = this.trimStr(pointPath);
        if (!root) return 'none';

        let hasConfigDir = (name) => {
            const dir = Gio.File.new_for_path(`${root}/configs/${name}`);
            return dir.query_exists(null)
                && dir.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY;
        };

        let folderHints = [
            ['hyprpanel', ['hyprpanel']],
            ['waybar', ['waybar']],
            ['eww', ['eww']],
            ['ags', ['ags']],
            ['agsv1', ['agsv1']],
            ['polybar', ['polybar']],
            ['yambar', ['yambar']],
            ['quickshell', ['quickshell']],
            ['fabric', ['fabric']],
            ['ignis', ['ignis']],
            ['nwg-dock-hyprland', ['nwg-dock-hyprland']]
        ];
        for (const [barId, folders] of folderHints) {
            if (folders.some((folder) => hasConfigDir(folder))) {
                return barId;
            }
        }

        let hyprCandidates = [
            `${root}/hyprland.conf`,
            `${root}/hyprland/hyprland.conf`,
            `${root}/configs/hypr/hyprland.conf`
        ];
        let escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let files = hyprCandidates
            .map((path) => this.readFileText(path))
            .filter((text) => typeof text === 'string' && text.length > 0);

        for (const barId of BarRegistry.getIds()) {
            const pattern = new RegExp(
                `^[ \\t]*(exec|exec-once)\\s*=.*\\b${escapeRegex(barId)}\\b`,
                'm'
            );
            if (files.some((text) => pattern.test(text))) {
                return barId;
            }
        }

        return 'none';
    }

    getConfiguredDefaultThemeBar() {
        const readCandidate = (value) => {
            const normalized = typeof value === 'string' ? value.trim() : '';
            return normalized.length ? normalized : null;
        };

        return [
            this.settingsService?.settingsManager?.get?.('default_theme_bar'),
            this.settingsService?.getAll?.()?.default_theme_bar,
            this.readThemeSelectorSettings?.().default_theme_bar
        ].map((value) => readCandidate(value)).find(Boolean) || 'none';
    }

    isPathInDirectory(path, dirPath) {
        const resolvedPath = Gio.File.new_for_path(path).get_path();
        const resolvedDir = Gio.File.new_for_path(dirPath).get_path();
        if (!resolvedPath || !resolvedDir) return false;
        return resolvedPath === resolvedDir || resolvedPath.startsWith(`${resolvedDir}/`);
    }

}
