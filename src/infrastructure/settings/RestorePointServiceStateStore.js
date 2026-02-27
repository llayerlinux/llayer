import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../utils/ErrorUtils.js';

export function applyRestorePointServiceStateStore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, RestorePointServiceStateStore.prototype);
}

class RestorePointServiceStateStore {
    standardizeSnapshotEntry(entry = {}) {
        const id = this.trimStr(entry.id);
        if (!this.isTrustedRestorePointId(id)) return null;

        return {
            id,
            createdAt: this.normalizeSnapshotCreatedAt(entry.createdAt),
            timestamp: this.normalizeSnapshotTimestamp(entry.timestamp),
            sourceTheme: this.trimStr(entry.sourceTheme, 'default'),
            type: this.standardizeSnapshotType(entry.type),
            defaultThemeBar: this.trimStr(entry.defaultThemeBar, 'none'),
            defaultBarManual: entry.defaultBarManual === true,
            selectedFolders: Array.isArray(entry.selectedFolders)
                ? entry.selectedFolders.map((f) => String(f || '').trim()).filter(Boolean)
                : []
        };
    }

    readRestorePointsState() {
        let metaState = this.readRestorePointsMetaFromFile();
        let {points: pointsFromMeta} = metaState;

        if (!pointsFromMeta.length && !Gio.File.new_for_path(this.restorePointsMetaPath).query_exists(null)) {
            return {
                version: 1,
                activeId: null,
                points: this.listRestorePointIdsFromFilesystem()
                    .map((id) => this.buildFallbackRestorePointEntry(id))
                    .filter(Boolean)
            };
        }

        let pointsById = new Map(pointsFromMeta.map((entry) => [entry.id, entry]));
        let metaMillis = pointsFromMeta
            .map((entry) => this.extractRestorePointDateFromId(entry.id)?.getTime?.() || 0)
            .filter((value) => Number.isFinite(value) && value > 0);
        let [oldestMetaMillis, newestMetaMillis] = metaMillis.length
            ? [Math.min(...metaMillis), Math.max(...metaMillis)]
            : [0, 0];
        let metaLooksRecent = newestMetaMillis > 0
            && Math.abs(Date.now() - newestMetaMillis) <= (2 * 24 * 60 * 60 * 1000);
        let hasPointsInFile = pointsFromMeta.length > 0;

        let shouldRecoverFromFs = (id) => {
            if (!hasPointsInFile) return true;
            if (!oldestMetaMillis || !metaLooksRecent) return false;
            let createdMillis = this.extractRestorePointDateFromId(id)?.getTime?.() || 0;
            return Number.isFinite(createdMillis)
                && createdMillis >= (oldestMetaMillis - 1000)
                && createdMillis <= (Date.now() + 60000);
        };

        this.listRestorePointIdsFromFilesystem().forEach((id) => {
            if (pointsById.has(id) || !shouldRecoverFromFs(id)) return;
            let fallback = this.buildFallbackRestorePointEntry(id);
            fallback && pointsById.set(fallback.id, fallback);
        });

        return {version: 1, points: Array.from(pointsById.values()), activeId: metaState.activeId};
    }

    readRestorePointsMetaFromFile() {
        if (!Gio.File.new_for_path(this.restorePointsMetaPath).query_exists(null))
            return {version: 1, points: [], activeId: null};
        let raw = tryOrNull('RestorePointService.readRestorePointsMetaFromFile', () =>
            JSON.parse(new TextDecoder('utf-8').decode(GLib.file_get_contents(this.restorePointsMetaPath)[1])));
        if (!raw) return {version: 1, points: [], activeId: null};
        let points = ((p) => (Array.isArray(p) ? p : []).map((e) => this.standardizeSnapshotEntry(e)).filter(Boolean))(
            Array.isArray(raw) ? raw : raw.points),
            activeId = ((c) => points.some((e) => e.id === c) ? c : null)(
                this.trimStr(Array.isArray(raw) ? null : raw.activeId));
        return {version: 1, points, activeId};
    }

    _mergePoints(preserveExisting, incomingPoints, removeIds) {
        if (!preserveExisting) return incomingPoints;

        const currentMeta = this.readRestorePointsMetaFromFile(),
            pointsById = new Map();
        currentMeta.points.forEach((entry) => {
            !removeIds.has(entry.id) && pointsById.set(entry.id, entry);
        });
        incomingPoints.forEach((entry) => {
            !removeIds.has(entry.id) && pointsById.set(entry.id, entry);
        });
        return Array.from(pointsById.values());
    }

    writeRestorePointsState(state = {}, options = {}) {
        const removeIds = new Set(
            (Array.isArray(options?.removeIds) ? options.removeIds : [])
                .map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean));
        const normalized = Array.isArray(state) ? {points: state, activeId: null} : (state || {});
        const points = this._mergePoints(options?.preserveExisting === true,
            (Array.isArray(normalized.points) ? normalized.points : [])
                .map((e) => this.standardizeSnapshotEntry(e)).filter(Boolean), removeIds);
        const activeId = ((c) => points.some((e) => e.id === c) ? c : (points[0]?.id || null))(
            this.trimStr(normalized.activeId));
        this.ensureDir(this.prefDir);
        ((tp) => {
            GLib.file_set_contents(tp, JSON.stringify({version: 1, points, activeId}, null, 2));
            Gio.File.new_for_path(tp).move(
                Gio.File.new_for_path(this.restorePointsMetaPath), Gio.FileCopyFlags.OVERWRITE, null, null);
        })(`${this.restorePointsMetaPath}.tmp-${Date.now()}`);
    }

    upsertRestorePoint(entry) {
        let point = this.standardizeSnapshotEntry(entry);
        if (!point) return null;
        let state = this.readRestorePointsState(),
            merged = [point, ...(state.points || []).filter((item) => item.id !== point.id)];
        this.writeRestorePointsState({points: merged,
            activeId: merged.some((i) => i.id === state.activeId) ? state.activeId : (merged[0]?.id || null)
        }, {preserveExisting: true});
        return point;
    }

    copyTree(sourcePath, targetPath) {
        let source = Gio.File.new_for_path(sourcePath);
        if (!source.query_exists(null)) return false;

        let target = Gio.File.new_for_path(targetPath);
        target.query_exists(null) || tryOrNull('RestorePointService.copyTree.mkdir', () => target.make_directory_with_parents(null));
        let targetReady = target.query_exists(null);
        if (!targetReady) {
            return false;
        }

        const enumerator = tryOrNull(
            'RestorePointService.copyTree.enumerate',
            () => source.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            )
        );
        if (!enumerator) {
            return false;
        }

        let info;
        while ((info = tryOrNull('RestorePointService.copyTree.next', () => enumerator.next_file(null))) !== null) {
            const sourceChild = source.get_child(info.get_name());
            const targetChild = target.get_child(info.get_name());
            const sourceType = info.get_file_type();

            switch (sourceType) {
                case Gio.FileType.DIRECTORY:
                    this.copyTree(sourceChild.get_path(), targetChild.get_path());
                    break;
                case Gio.FileType.SYMBOLIC_LINK:
                    break;
                default:
                    tryOrNull(
                        'RestorePointService.copyTree.copy',
                        () => sourceChild.copy(targetChild, Gio.FileCopyFlags.OVERWRITE, null, null)
                    );
                    break;
            }
        }
        tryOrNull('RestorePointService.copyTree.close', () => enumerator.close(null));
        return true;
    }

    removeTree(path) {
        let file = Gio.File.new_for_path(path);
        if (!file.query_exists(null)) return true;

        let fileType = file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        if (fileType === Gio.FileType.DIRECTORY) {
            let enumerator = file.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            ), info;
            while ((info = enumerator.next_file(null)) !== null) {
                let child = file.get_child(info.get_name());
                this.removeTree(child.get_path());
            }
            enumerator.close(null);
        }

        file.delete(null);
        return true;
    }

    listRestorePoints({limit = 30} = {}) {
        const snapshot = this.readRestorePointsState();
        const maxItems = Number(limit) > 0 ? Number(limit) : 30;
        const toMillis = (value) => this.parseSnapshotDate(value)?.getTime?.() || 0;
        return [...snapshot.points]
            .sort((left, right) =>
                (toMillis(right.createdAt) - toMillis(left.createdAt))
                || (toMillis(right.timestamp) - toMillis(left.timestamp))
                || String(right.id || '').localeCompare(String(left.id || '')))
            .slice(0, maxItems);
    }

    getActiveRestorePointId() {
        const snapshot = this.readRestorePointsState();
        return snapshot.activeId || null;
    }

    setActiveRestorePointId(pointId) {
        const normalizedId = this.trimStr(pointId);
        if (!this.isTrustedRestorePointId(normalizedId)) return false;
        const snapshot = this.readRestorePointsState();
        if (!snapshot.points.some((point) => point.id === normalizedId)) return false;
        if (snapshot.activeId === normalizedId) return true;
        this.writeRestorePointsState({points: snapshot.points, activeId: normalizedId}, {preserveExisting: true});
        return true;
    }

    createRestorePointSnapshot({
        type = 'manual',
        sourceTheme = 'default',
        timestamp = null,
        defaultThemeBar = 'none',
        defaultBarManual = false,
        selectedFolders = []
    } = {}) {

        const defaultDir = this.getDefaultThemeDir();
        this.ensureDir(defaultDir);
        if (!Gio.File.new_for_path(defaultDir).query_exists(null)) return null;

        this.ensureDir(this.getRestorePointsRootDir());
        const id = this.buildRestorePointId();
        const targetPath = this.getRestorePointPath(id);
        this.copyTree(defaultDir, targetPath) || this.ensureDir(targetPath);
        if (!Gio.File.new_for_path(targetPath).query_exists(null)) return null;
        const effectiveBar = ((nb, cb) => nb !== 'none' ? nb : (cb !== 'none' ? cb : this.inferRestorePointBar(targetPath)))(
            this.trimStr(defaultThemeBar, 'none'), this.getConfiguredDefaultThemeBar());
        const point = this.standardizeSnapshotEntry({
            id, type, sourceTheme, defaultThemeBar: effectiveBar || 'none',
            defaultBarManual, selectedFolders, timestamp, createdAt: new Date().toISOString()
        });
        return point ? this.upsertRestorePoint(point) : null;
    }
}
