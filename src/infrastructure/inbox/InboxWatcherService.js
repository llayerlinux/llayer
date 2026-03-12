import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { ThemeUnifier } from '../unifier/ThemeUnifier.js';
import { Events } from '../../app/eventBus.js';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

const DUPLICATE_NATIVE_EVENTS = new Set([
    Events.UNIFIER_LOG,
    Events.INBOX_IMPORT_STARTED,
    Events.INBOX_THEME_IMPORTED,
]);

export class InboxWatcherService {
    constructor(options = {}, auditLog = null) {
        this.logger = options.logger ?? null;
        this.eventBus = options.eventBus ?? null;
        this.notifier = options.notifier ?? null;
        this.themeRepository = options.themeRepository ?? null;
        this.settingsManager = options.settingsManager ?? null;
        this.parameterService = options.parameterService ?? null;
        this.commandWriter = options.commandWriter ?? null;
        this.workerScriptPath = options.workerScriptPath ?? null;
        this.useWorker = options.useWorker !== undefined ? options.useWorker : !!this.workerScriptPath;
        this.maxRetries = Number.isFinite(options.maxRetries) ? options.maxRetries : 5;
        this.stabilityRequiredChecks = Number.isFinite(options.stabilityRequiredChecks) ? options.stabilityRequiredChecks : 2;
        this.isSupporterActive = options.isSupporterActive ?? (() => true);
        this.getDisabledMessage = options.getDisabledMessage ?? null;
        this._inboxPath = GLib.build_filenamev([GLib.get_home_dir(), 'Downloads', 'llayer-inbox']);
        this._disabledMonitor = null;
        this._disabledSeen = new Map();
        this._disabledDebounceMs = 3000;

        this._unifier = new ThemeUnifier({
            logger: this.logger,
            eventBus: this.eventBus,
            settingsManager: this.settingsManager,
        });

        this._native = createAuditedNative(
            new LastlayerSupporter.InboxWatcherService({
                theme_unifier: this._unifier._native,
            }),
            'InboxWatcherService',
            auditLog
        );

        this.connectSignals();

        this.syncSettings();
    }

    connectSignals() {
        this._native.connect('log-message', (_obj, message) => {
            this.logger?.info?.(message);
        });

        this._native.connect('unifier-log', (_obj, message, level, source) => {
            this.eventBus?.emit?.(Events.UNIFIER_LOG, { message, level, source });
        });

        this._native.connect('theme-imported', (_obj, themeName, metadataJson) => {
            this.themeRepository?.invalidateCache?.();

            const data = metadataJson
                ? tryOrDefault('InboxWatcherService.themeImported.parse', () => ({ themeName, ...JSON.parse(metadataJson) }), { themeName })
                : { themeName };
            this.eventBus?.emit?.(Events.INBOX_THEME_IMPORTED, data);
        });

        this._native.connect('import-started', (_obj, filename, postUrl, repoUrl) => {
            this.eventBus?.emit?.(Events.INBOX_IMPORT_STARTED, { filename, postUrl, repoUrl });
        });

        this._native.connect('show-notification', (_obj, title, body) => {
            this.notifier?.show?.(title, body);
        });

        this._native.connect('write-command', (_obj, command) => {
            this.commandWriter?.(command);
        });

        this._native.connect('invalidate-theme-cache', () => {
            this.themeRepository?.invalidateCache?.();
            this.eventBus?.emit?.(Events.THEMES_LOCAL_UPDATED);
        });

        this._native.connect('event', (_obj, eventName, eventDataJson) => {
            if (DUPLICATE_NATIVE_EVENTS.has(eventName)) {
                return;
            }

            const data = eventDataJson
                ? tryOrDefault('InboxWatcherService.event.parse', () => JSON.parse(eventDataJson), eventDataJson)
                : null;
            if (eventName === 'apply_overrides_after_unify') {
                this.handleApplyOverridesAfterUnify(data);
            }
            this.eventBus?.emit?.(eventName, data);
        });
    }

    handleApplyOverridesAfterUnify(data) {
        const themePath = typeof data?.themePath === 'string' ? data.themePath : null;
        if (!themePath || !this.parameterService || !this.settingsManager) return;

        const refreshed = tryRun('InboxWatcherService.applyOverridesAfterUnify', () => {
            const settings = this.settingsManager.getAll?.() ?? {};
            if (typeof this.parameterService.processThemeAfterInstall === 'function') {
                this.parameterService.processThemeAfterInstall(themePath, settings);
                this.logger?.info?.(`[InboxWatcher] Overrides refreshed after unification: ${themePath}`);
                return;
            }

            if (typeof this.parameterService.applyOverridesToConfig === 'function') {
                this.parameterService.applyOverridesToConfig(themePath, settings);
                this.logger?.info?.(`[InboxWatcher] Overrides refreshed after unification: ${themePath}`);
                return;
            }
        });

        if (!refreshed) {
            const message = 'Overrides warning: failed to refresh after unification';
            this.eventBus?.emit?.(Events.UNIFIER_LOG, { message, level: 'warning', source: 'InboxWatcher' });
            this.logger?.warn?.(`[InboxWatcher] ${message}`);
        }
    }

    syncSettings() {
        const sm = this.settingsManager;
        const allSettings = sm?.getAll?.() ?? {};
        const timeouts = allSettings.timeouts ?? {};

        const settings = {
            workerScriptPath: this.workerScriptPath ?? '',
            useWorker: this.useWorker,
            maxRetries: this.maxRetries,
            stabilityRequiredChecks: this.stabilityRequiredChecks,

            flyDisableExternalNotifications: sm?.get?.('flyDisableExternalNotifications') === true,
            flySeamlessMode: allSettings.flySeamlessMode === true,
            flySkipHeavyPhases: sm?.get?.('flySkipHeavyPhases') === true,
            flyPregenScript: sm?.get?.('flyPregenScript') === true,
            flyPreloadWallpaper: sm?.get?.('flyPreloadWallpaper') !== false,
            flyWarmBarProcess: sm?.get?.('flyWarmBarProcess') === true,
            flyEarlyOverrides: sm?.get?.('flyEarlyOverrides') !== false,

            timeouts: {
                startupScanDelay: timeouts.startupScanDelay ?? 200,
                flyDebounceDelay: timeouts.flyDebounceDelay ?? 150,
                regularDebounceDelay: timeouts.regularDebounceDelay ?? 500,
                stabilityMaxWait: timeouts.stabilityMaxWait ?? 30000,
                stabilityCheckInterval: timeouts.stabilityCheckInterval ?? 150,
                retryDelayBase: timeouts.retryDelayBase ?? 2000,
            },

            hyprlandOverrides: allSettings.hyprlandOverrides ?? {},
        };

        this._native.configure(JSON.stringify(settings));
    }

    start() {
        this.stopDisabledMonitor();
        if (!this.isSupporterActive()) {
            const msg = this.getDisabledMessage?.() || 'Import via extension and unification requires Supporter mode';
            this.notifier?.show?.('Supporter', msg);
            this.logger?.info?.('[InboxWatcher] Not starting — supporter not active');
            this.startDisabledMonitor();
            return;
        }

        this.syncSettings();
        this._native.start();
    }

    stop() {
        this.stopDisabledMonitor();
        this._native.stop();
    }

    cleanup() {
        this.stopDisabledMonitor();
        this._native.cleanup();
    }

    startDisabledMonitor() {
        tryRun('InboxWatcherService.startDisabledMonitor', () => {
            GLib.mkdir_with_parents(this._inboxPath, 0o755);
            const dir = Gio.File.new_for_path(this._inboxPath);
            this._disabledMonitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._disabledMonitor.connect('changed', (_monitor, file, _otherFile, eventType) => {
                if (!file) return;
                if (!this.isImportEvent(eventType)) return;
                const path = file.get_path?.();
                if (!path || !this.isArchivePath(path)) return;
                this.handleDisabledImportAttempt(path);
            });
        }) || this.logger?.warn?.('[InboxWatcher] Failed to start disabled monitor');
    }

    stopDisabledMonitor() {
        if (this._disabledMonitor) {
            this._disabledMonitor.cancel();
            this._disabledMonitor = null;
        }
        this._disabledSeen.clear();
    }

    isImportEvent(eventType) {
        switch (eventType) {
            case Gio.FileMonitorEvent.CREATED:
            case Gio.FileMonitorEvent.MOVED_IN:
            case Gio.FileMonitorEvent.CHANGES_DONE_HINT:
                return true;
            default:
                return false;
        }
    }

    isArchivePath(path) {
        const lower = String(path || '').toLowerCase();
        return ['.zip', '.tar', '.tgz', '.tar.gz', '.tar.xz', '.txz', '.tar.bz2', '.tbz2', '.7z']
            .some(extension => lower.endsWith(extension));
    }

    handleDisabledImportAttempt(path) {
        const now = Date.now();
        const lastSeen = this._disabledSeen.get(path) || 0;
        if (now - lastSeen < this._disabledDebounceMs) return;
        this._disabledSeen.set(path, now);

        const msg = this.getDisabledMessage?.() || 'Import via extension and unification requires Supporter mode';
        const filename = GLib.path_get_basename(path) || 'theme';
        this.eventBus?.emit?.(Events.INBOX_IMPORT_STARTED, { filename, postUrl: '', repoUrl: '' });
        this.eventBus?.emit?.(Events.UNIFIER_LOG, { message: msg, level: 'warning', source: 'Supporter' });
        this.notifier?.show?.('Supporter', msg);
        this.logger?.info?.('[InboxWatcher] Import attempt blocked in non-supporter mode', path);
    }
}
