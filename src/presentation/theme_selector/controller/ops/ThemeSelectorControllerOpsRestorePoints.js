import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import { Events } from '../../../../app/eventBus.js';
import { ScriptBuilder } from '../../../../infrastructure/scripts/ScriptBuilder.js';

class ThemeSelectorControllerOpsRestorePoints {
    normalizeRestorePointLimit(limit = 30) {
        return Number(limit) > 0 ? Number(limit) : 30;
    }

    getSessionRestorePoints() {
        if (!Array.isArray(this._sessionRestorePoints)) {
            this._sessionRestorePoints = [];
        }
        return this._sessionRestorePoints;
    }

    upsertSessionRestorePoint(point) {
        if (!point?.id) {
            return;
        }
        const current = this.getSessionRestorePoints().filter((item) => item?.id !== point.id);
        this._sessionRestorePoints = [point, ...current].slice(0, 200);
    }

    removeSessionRestorePoint(pointId) {
        const normalizedId = typeof pointId === 'string' ? pointId.trim() : '';
        if (!normalizedId) {
            return;
        }
        this._sessionRestorePoints = this.getSessionRestorePoints().filter((item) => item?.id !== normalizedId);
    }

    getRestorePointService() {
        const container = this.container;
        if (!container || typeof container.get !== 'function') {
            return null;
        }
        try {
            return container.get('restorePointService');
        } catch (_error) {
            return null;
        }
    }

    callService(method, args, fallback) {
        const service = this.getRestorePointService();
        if (!(service && typeof service[method] === 'function')) {
            return fallback;
        }
        return service[method](...args);
    }

    listRestorePoints(limit = 30) {
        try {
            const service = this.getRestorePointService();
            const servicePoints = (service && typeof service.listRestorePoints === 'function')
                ? service.listRestorePoints({limit: 1000})
                : [];
            const serviceIds = new Set(
                servicePoints.map((item) => item?.id).filter(Boolean));
            return [
                ...this.getSessionRestorePoints().filter(
                    (item) => item?.id && !serviceIds.has(item.id)),
                ...servicePoints
            ].slice(0, this.normalizeRestorePointLimit(limit));
        } catch (_error) {
            return this.getSessionRestorePoints()
                .slice(0, this.normalizeRestorePointLimit(limit));
        }
    }

    getActiveRestorePointId() {
        return this.callService('getActiveRestorePointId', [], null);
    }

    setActiveRestorePointId(pointId) {
        return this.callService('setActiveRestorePointId', [pointId], false);
    }

    getDefaultQuickRestorePoint() {
        const points = this.listRestorePoints(1000);
        const activeId = this.getActiveRestorePointId();
        const active = activeId ? points.find((point) => point.id === activeId) : null;
        return active || points[0] || null;
    }

    getDefaultQuickRestorePointId() {
        return this.getDefaultQuickRestorePoint()?.id || null;
    }

    async restoreDefaultFromPoint(pointId, options = {}) {
        const service = this.getRestorePointService();
        if (!service) return {success: false, error: 'restore-service-unavailable'};

        const point = service.restoreRestorePoint(pointId);
        if (!point) {
            return {success: false, error: 'restore-point-not-found'};
        }

        this.themeRepository?.clearCache?.();
        ScriptBuilder.clearTemplateCache();

        const shouldApplyTheme = options.applyTheme !== false;
        const targetTheme = (typeof options.applyThemeName === 'string' && options.applyThemeName.trim().length)
            ? options.applyThemeName.trim()
            : 'default';
        if (shouldApplyTheme) {
            await this.applyThemeUseCase?.execute?.(targetTheme, {
                source: 'restore_point',
                isReapplying: true
            });
        }

        if (options.notify !== false) {
            this.notifier?.success?.(
                this.translate('RESTORE_POINT_RESTORED_TITLE'),
                this.translate('RESTORE_POINT_RESTORED_MESSAGE', {timestamp: point.timestamp || this.translate('UNKNOWN')})
            );
        }

        return {success: true, point};
    }

    removeRestorePoint(pointId) {
        let service = this.getRestorePointService();
        if (!service) return {success: false, error: 'restore-service-unavailable'};

        let removed = service.deleteRestorePoint(pointId);
        removed && (
            this.removeSessionRestorePoint(pointId),
            this.notifier?.info?.(
                this.translate('RESTORE_POINT_DELETED_TITLE'),
                this.translate('RESTORE_POINT_DELETED_MESSAGE')
            )
        );
        return {success: removed, error: removed ? null : 'restore-point-not-found'};
    }

    getRestorePointDetails(pointId, options = {}) {
        return this.callService('getRestorePointDetails', [pointId, options], null);
    }

    resolveRestorePointByDelta(service, knownIds = new Set(), knownFsIds = new Set(), sourceTheme = 'default') {
        if (!service) return null;

        const created = service.listRestorePoints({limit: 1000})
            .find((item) => item?.id && !knownIds.has(item.id));
        if (created?.id) return created;

        const createdFsId = service.listRestorePointIdsFromFilesystem()
            .find((id) => typeof id === 'string' && id.length && !knownFsIds.has(id));
        if (!createdFsId) {
            return null;
        }
        return service.buildFallbackRestorePointEntry(createdFsId) || {
            id: createdFsId,
            timestamp: service.getCurrentLocalTimestamp?.() || null,
            createdAt: new Date().toISOString(),
            sourceTheme,
            type: 'manual',
            defaultThemeBar: 'none',
            defaultBarManual: false
        };
    }

    emitRestorePointListRefresh(pointId = null) {
        const eventName = this.eventBus?.Events?.THEME_REPOSITORY_UPDATED || Events.THEME_REPOSITORY_UPDATED;
        this.eventBus?.emit?.(eventName, {
            emitter: 'ThemeSelectorControllerOpsRestorePoints.createRestorePoint',
            pointId: pointId || null
        });
    }

    async createRestorePoint(options = {}) {
        const service = this.getRestorePointService();
        if (!service) return {success: false, error: 'restore-service-unavailable'};
        try {
            const beforeIds = new Set(
                service.listRestorePoints({limit: 1000})
                    .map((item) => item?.id)
                    .filter((id) => typeof id === 'string' && id.length)
            );
            const beforeFsIds = new Set(
                service.listRestorePointIdsFromFilesystem()
                    .filter((id) => typeof id === 'string' && id.length)
            );
            const sourceTheme = this.settingsService?.getCurrentTheme?.()
                || this.store?.get?.('currentTheme')
                || 'default';
            const configuredFolders = this.settingsService?.settingsManager?.get?.('backupFolders');
            const folders = Array.isArray(options.folders)
                ? options.folders
                : (Array.isArray(configuredFolders) ? configuredFolders : []);
            let point = null;
            try {
                point = await service.createManualRestorePoint({folders, sourceTheme});
            } catch (_error) {
                point = null;
            }
            if (!point?.id) {
                point = this.resolveRestorePointByDelta(service, beforeIds, beforeFsIds, sourceTheme);
            }
            if (!point?.id) {
                const fallback = service.createRestorePointSnapshot({
                    type: 'manual',
                    sourceTheme,
                    timestamp: service.getCurrentLocalTimestamp?.()
                });
                if (fallback?.id) {
                    service.trimRestorePointConfigs(fallback.id, folders);
                    point = service.finalizeRestorePointSnapshot(fallback, 'ThemeSelectorController.manual-fallback');
                }
            }
            if (point?.id) {
                point = service.upsertRestorePoint(point) || point;
            }

            if (!point?.id) {
                return {success: false, error: 'restore-point-not-created'};
            }
            const persistedPoint = service.listRestorePoints({limit: 1000})
                .find((item) => item?.id === point.id) || point;

            this.upsertSessionRestorePoint(persistedPoint);
            this.setActiveRestorePointId(persistedPoint.id);
            this.emitRestorePointListRefresh(persistedPoint.id);

            this.notifier?.info?.(
                this.translate('RESTORE_POINT_ADDED_TITLE'),
                this.translate('RESTORE_POINT_ADDED_MESSAGE', {timestamp: persistedPoint.timestamp || this.translate('UNKNOWN')})
            );
            return {success: true, point: persistedPoint};
        } catch (error) {
            const message = (typeof error?.message === 'string' && error.message.trim().length)
                ? error.message.trim()
                : 'restore-point-create-exception';
            return {success: false, error: message};
        }
    }

    createRestorePointFolder(pointId, relativePath) {
        return this.callService('createRestorePointFolder', [pointId, relativePath], false);
    }

    loadRestorePointFileText(pointId, relativePath) {
        return this.callService('getRestorePointFileText', [pointId, relativePath], null);
    }

    saveRestorePointFileText(pointId, relativePath, content = '') {
        return this.callService('setRestorePointFileText', [pointId, relativePath, content], false);
    }

    importFileIntoRestorePoint(pointId, sourcePath, destinationRelativeDir = '') {
        return this.callService('importFileIntoRestorePoint', [pointId, sourcePath, destinationRelativeDir], null);
    }
}

export function applyThemeSelectorControllerOpsRestorePoints(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsRestorePoints.prototype);
}
