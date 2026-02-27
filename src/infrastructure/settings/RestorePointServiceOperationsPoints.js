import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../utils/ErrorUtils.js';

export function applyRestorePointServiceOperationsPoints(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, RestorePointServiceOperationsPoints.prototype);
}

class RestorePointServiceOperationsPoints {
    finalizeRestorePointSnapshot(point, emitter = 'RestorePointService.snapshot') {
        const safePoint = point || null;
        const timestamp = safePoint?.timestamp || this.getCurrentLocalTimestamp();
        safePoint && timestamp && (
            this.settingsService?.setRestorePointLastUpdate?.(timestamp),
            this.lastUpdateTimestamp = timestamp,
            this.emitRestorePointDisplay(timestamp, emitter)
        );
        safePoint && this.notifyThemeListChanged();
        return safePoint;
    }

    async createManualRestorePoint({folders = [], sourceTheme = 'default'} = {}) {
        const themeName = this.trimStr(sourceTheme, 'default');
        const selectedFolders = this.buildFolderSet(Array.isArray(folders) ? folders : [], {
            mergeWithConfigured: false
        });
        let refreshed = null;
        try {
            refreshed = await this.refreshRestorePoint({
                folders: selectedFolders,
                theme: themeName,
                keepCurrentTheme: true,
                snapshotType: 'manual',
                sourceTheme: themeName,
                mergeWithConfiguredFolders: false
            });
        } catch (_error) {
            refreshed = null;
        }

        const refreshedSnapshot = refreshed?.snapshot?.id ? refreshed.snapshot : null;
        return refreshedSnapshot || (() => {
            const resolveFallbackSnapshot = async () => {
                let detectedBar = refreshed?.detectedBar || 'none';
                detectedBar = detectedBar === 'none'
                    ? await this.detectRunningBar().catch(() => 'none')
                    : detectedBar;
                detectedBar = detectedBar === 'none' ? this.getConfiguredDefaultThemeBar() : detectedBar;

                const snapshot = this.createRestorePointSnapshot({
                    type: 'manual',
                    sourceTheme: themeName,
                    defaultThemeBar: detectedBar || 'none',
                    defaultBarManual: false,
                    timestamp: refreshed?.lastUpdate || this.getCurrentLocalTimestamp()
                });
                return snapshot?.id
                    ? (this.trimRestorePointConfigs(snapshot.id, selectedFolders),
                        this.finalizeRestorePointSnapshot(snapshot, 'RestorePointService.manual-fallback'))
                    : null;
            };
            return resolveFallbackSnapshot();
        })();
    }

    trimRestorePointConfigs(pointId, selectedFolders = []) {
        const selected = new Set(
            (Array.isArray(selectedFolders) ? selectedFolders : [])
                .map((folder) => String(folder || '').trim())
                .filter(Boolean)
        );
        selected.delete('hypr');
        selected.delete('default_wallpapers');

        const pointPath = this.getRestorePointPath(pointId);
        const configsDir = Gio.File.new_for_path(`${pointPath}/configs`);
        const enumerator = configsDir.query_exists(null) && tryOrNull(
            'RestorePointService.trimRestorePointConfigs.enumerate',
            () => configsDir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            )
        );
        enumerator && (() => {
            let info;
            while ((info = tryOrNull('RestorePointService.trimRestorePointConfigs.next', () => enumerator.next_file(null))) !== null) {
                const folderName = info.get_name();
                selected.has(folderName) || this.removeTree(configsDir.get_child(folderName).get_path());
            }
            tryOrNull('RestorePointService.trimRestorePointConfigs.close', () => enumerator.close(null));
        })();
    }

    restoreRestorePoint(pointId) {
        const point = this.isTrustedRestorePointId(pointId)
            ? this.listRestorePoints({limit: 1000}).find((entry) => entry.id === pointId)
            : null;

        return point
            ? (() => {
                const sourcePath = this.getRestorePointPath(point.id);
                const defaultDir = this.getDefaultThemeDir();

                this.removeTree(defaultDir);
                this.copyTree(sourcePath, defaultDir);

                const timestamp = point.timestamp || this.getCurrentLocalTimestamp();
                timestamp && (
                    this.settingsService?.setRestorePointLastUpdate?.(timestamp),
                    this.emitRestorePointDisplay(timestamp, 'RestorePointService.restore')
                );

                let restoredBar = this.trimStr(point.defaultThemeBar, 'none');
                const inferredBar = this.inferRestorePointBar(sourcePath);
                restoredBar = inferredBar !== 'none' ? inferredBar : restoredBar;
                restoredBar = restoredBar === 'none'
                    ? (() => {
                        const configuredBar = this.getConfiguredDefaultThemeBar();
                        return configuredBar !== 'none' ? configuredBar : restoredBar;
                    })()
                    : restoredBar;
                const restoredBarManual = point.defaultBarManual === true;
                const selectorPatch = {
                    theme: 'default',
                    default_theme_bar: restoredBar,
                    default_bar_manual: restoredBarManual
                };

                this.setCurrentTheme('default');
                this.updateThemeSelectorSettings(selectorPatch);
                this.syncPrimarySettings(selectorPatch);

                Array.isArray(point.selectedFolders)
                    && point.selectedFolders.length
                    && this.settingsService?.settingsManager?.set?.('backupFolders', [...point.selectedFolders]);

                this.notifyThemeListChanged();
                return point;
            })()
            : null;
    }

    deleteRestorePoint(pointId) {
        const state = this.readRestorePointsState(),
            current = state.points || [],
            exists = current.some((point) => point.id === pointId),
            restoreRoot = this.getRestorePointsRootDir(),
            pointPath = this.getRestorePointPath(pointId),
            canDelete = this.isTrustedRestorePointId(pointId)
                && exists
                && this.isPathInDirectory(pointPath, restoreRoot);

        return canDelete
            ? (() => {
                this.removeTree(pointPath);
                const nextPoints = current.filter((point) => point.id !== pointId);
                const nextActiveId = nextPoints.some((point) => point.id === state.activeId)
                    ? state.activeId
                    : (nextPoints[0]?.id || null);
                this.writeRestorePointsState(
                    {points: nextPoints, activeId: nextActiveId},
                    {preserveExisting: true, removeIds: [pointId]}
                );
                this.notifyThemeListChanged();
                return true;
            })()
            : false;
    }

    resolveRestorePoint(pointId) {
        let point = this.isTrustedRestorePointId(pointId)
            ? this.listRestorePoints({limit: 1000}).find((entry) => entry.id === pointId)
            : null;
        if (!point) return null;
        let path = this.getRestorePointPath(point.id);
        return this.isPathInDirectory(path, this.getRestorePointsRootDir()) && Gio.File.new_for_path(path).query_exists(null)
            ? {point, path}
            : null;
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = Number(bytes) || 0;
        let idx = 0;
        while (value >= 1024 && idx < units.length - 1) {
            value /= 1024;
            idx += 1;
        }
        const rounded = idx === 0 ? Math.round(value) : Math.round(value * 10) / 10;
        return `${rounded} ${units[idx]}`;
    }

    buildRestorePointTreeNode(path, maxNodesState = null) {
        let file = Gio.File.new_for_path(path);
        let info = file.query_info(
            'standard::name,standard::type,standard::size',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            null
        );

        maxNodesState && (maxNodesState.current += 1);
        let exceededLimit = maxNodesState && maxNodesState.current > maxNodesState.max;
        if (exceededLimit) {
            return {
                name: '…',
                type: 'truncated',
                size: 0,
                sizeLabel: '0 B',
                children: []
            };
        }

        let type = info.get_file_type(),
            name = info.get_name() || file.get_basename() || '/';

        if (type !== Gio.FileType.DIRECTORY) {
            let fileSize = Number(info.get_size()) || 0;
            return {
                name,
                type: 'file',
                size: fileSize,
                sizeLabel: this.formatBytes(fileSize),
                children: []
            };
        }

        let children = [];
        let totalSize = 0;
        let enumerator = file.enumerate_children(
            'standard::name,standard::type,standard::size',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            null
        );
        let childInfo;
        while ((childInfo = enumerator.next_file(null)) !== null) {
            let childFile = file.get_child(childInfo.get_name());
            let childNode = this.buildRestorePointTreeNode(childFile.get_path(), maxNodesState);
            if (childNode) {
                children.push(childNode);
                totalSize += Number(childNode.size) || 0;
            }
        }
        enumerator.close(null);

        children.sort((left, right) => {
            if (left.type !== right.type) {
                return left.type === 'folder' ? -1 : 1;
            }
            return String(left.name).localeCompare(String(right.name));
        });

        return {
            name,
            type: 'folder',
            size: totalSize,
            sizeLabel: this.formatBytes(totalSize),
            children
        };
    }

    getRestorePointDetails(pointId, options = {}) {
        const resolved = this.resolveRestorePoint(pointId);
        if (!resolved) return null;

        const maxNodes = Number(options.maxNodes) > 0 ? Number(options.maxNodes) : 20000;
        const maxNodesState = {
            current: 0,
            max: maxNodes
        };
        const tree = this.buildRestorePointTreeNode(resolved.path, maxNodesState);
        const topFolders = Array.isArray(tree?.children)
            ? tree.children.map((child) => child.name)
            : [];

        return {
            point: resolved.point,
            path: resolved.path,
            totalSize: Number(tree?.size) || 0,
            totalSizeLabel: tree?.sizeLabel || this.formatBytes(0),
            topFolders,
            tree
        };
    }

    cleanRestorePointRelativePath(path, {allowEmpty = true} = {}) {
        const normalized = typeof path === 'string'
            ? path
            .replace(/\\/g, '/')
            .trim()
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            : '';
        const segments = normalized.split('/').map((segment) => segment.trim()).filter(Boolean);
        const isEmpty = normalized.length === 0 || segments.length === 0;
        const hasUnsafeSegments = segments.some((segment) => segment === '.' || segment === '..');
        return hasUnsafeSegments
            ? null
            : (isEmpty ? (allowEmpty ? '' : null) : segments.join('/'));
    }

    buildRestorePointTarget(pointId, relativePath = '', {allowRoot = true} = {}) {
        const resolved = this.resolveRestorePoint(pointId);
        if (!resolved) return null;
        const cleanRelativePath = this.cleanRestorePointRelativePath(relativePath, {allowEmpty: allowRoot});
        if (cleanRelativePath === null || (!allowRoot && !cleanRelativePath)) return null;
        const targetPath = cleanRelativePath ? `${resolved.path}/${cleanRelativePath}` : resolved.path;
        return this.isPathInDirectory(targetPath, resolved.path)
            ? {point: resolved.point, rootPath: resolved.path, relativePath: cleanRelativePath, targetPath}
            : null;
    }

    createRestorePointFolder(pointId, relativePath) {
        const target = this.buildRestorePointTarget(pointId, relativePath, {allowRoot: false});
        if (!target) return false;
        this.ensureDir(target.targetPath);
        return Gio.File.new_for_path(target.targetPath).query_exists(null);
    }

    getRestorePointFileText(pointId, relativePath) {
        let target = this.buildRestorePointTarget(pointId, relativePath, {allowRoot: false});
        if (!target) return null;
        let file = Gio.File.new_for_path(target.targetPath);
        if (!file.query_exists(null)
            || file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY) {
            return null;
        }
        let [ok, content] = GLib.file_get_contents(target.targetPath);
        return ok && content ? new TextDecoder('utf-8').decode(content) : null;
    }

    setRestorePointFileText(pointId, relativePath, content = '') {
        const target = this.buildRestorePointTarget(pointId, relativePath, {allowRoot: false});
        if (!target) return false;
        const parentDir = GLib.path_get_dirname(target.targetPath);
        parentDir && parentDir !== '.' && this.ensureDir(parentDir);
        GLib.file_set_contents(target.targetPath, String(content ?? ''));
        return true;
    }

    importFileIntoRestorePoint(pointId, sourcePath, destinationRelativeDir = '') {
        let source = this.trimStr(sourcePath),
            sourceFile = source && Gio.File.new_for_path(source);
        if (!source || !sourceFile.query_exists(null)
            || sourceFile.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY)
            return null;

        let targetDir = this.buildRestorePointTarget(pointId, destinationRelativeDir, {allowRoot: true});
        if (!targetDir) return null;

        this.ensureDir(targetDir.targetPath);
        let sourceName = sourceFile.get_basename() || `file-${Date.now()}`,
            relativeTargetPath = targetDir.relativePath
                ? `${targetDir.relativePath}/${sourceName}` : sourceName,
            targetFile = this.buildRestorePointTarget(pointId, relativeTargetPath, {allowRoot: false});
        if (!targetFile) return null;

        try {
            let destination = Gio.File.new_for_path(targetFile.targetPath);
            destination.query_exists(null) && destination.delete(null);
            sourceFile.copy(destination, Gio.FileCopyFlags.OVERWRITE, null, null);
            return relativeTargetPath;
        } catch (_error) {
            const [ok, content] = tryOrNull(
                'RestorePointService.importFileIntoRestorePoint.read',
                () => GLib.file_get_contents(source)
            ) || [];
            return (ok && content && tryOrNull(
                'RestorePointService.importFileIntoRestorePoint.write',
                () => GLib.file_set_contents(targetFile.targetPath, content)
            )) ? relativeTargetPath : null;
        }
    }
}
