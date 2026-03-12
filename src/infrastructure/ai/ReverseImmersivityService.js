import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export const PipelineState = {
    IDLE: 'idle', CAPTURING: 'capturing', ANALYZING: 'analyzing',
    SELECTING_TAG: 'selecting_tag', DISAMBIGUATING: 'disambiguating',
    APPLYING_THEME: 'applying_theme', COMPLETED: 'completed', ERROR: 'error'
};

export class ReverseImmersivityService {
    constructor(dependencies = {}) {
        const screenshotService = dependencies.screenshotService;
        const themeTagService = dependencies.themeTagService;
        const aiDecisionService = dependencies.aiDecisionService;
        this.applyThemeUseCase = dependencies.applyThemeUseCase ?? null;
        this.settingsService = dependencies.settingsService ?? null;
        this.logger = dependencies.logger ?? null;

        const pfs = dependencies.pipelineFilterService?._native ?? null;
        const auditLog = dependencies.auditLog ?? null;

        this._native = createAuditedNative(new LastlayerSupporter.ReverseImmersivityService({
            screenshot_service: screenshotService._native,
            theme_tag_service: themeTagService._native,
            ai_decision_service: aiDecisionService._native,
            pipeline_filter_service: pfs,
        }), 'ReverseImmersivityService', auditLog);

        this._eventListeners = [];

        this._native.connect('apply-theme-requested', (_o, themeName, optsJson) => {
            if (!this.applyThemeUseCase) {
                return;
            }

            const opts = tryOrDefault('ReverseImmersivityService.applyThemeRequested.parse', () => JSON.parse(optsJson), {});
            tryRun('ReverseImmersivityService.applyThemeRequested.execute', () => {
                this.applyThemeUseCase.execute?.(themeName, opts);
            }) || this.log('error', 'Failed to apply requested theme');
        });

        this._native.connect('pipeline-event', (_o, eventName, eventDataJson) => {
            const data = tryOrDefault('ReverseImmersivityService.pipelineEvent.parse', () => JSON.parse(eventDataJson), {});
            this.notifyEventListeners(eventName, data);
        });

        if (this.logger) {
            this._native.connect('log-message', (_o, msg) => this.logger.debug?.('ReverseImmersivity', msg));
            this._native.connect('warn-message', (_o, msg) => this.logger.warn?.('ReverseImmersivity', msg));
        }
    }

    syncSettings() {
        const sm = this.settingsService?.settingsManager;
        if (!sm) return;

        const installedThemes = sm.get?.('ai_skip_list') ?? [];
        const currentTheme = sm.get?.('currentTheme') ?? sm.get?.('current_theme') ?? '';

        this._native.configure(JSON.stringify({
            installedThemes,
            currentTheme,
            ai_enable_frame_buffering: sm.get?.('ai_enable_frame_buffering') === true,
            ai_filter_logs_only: sm.get?.('ai_filter_logs_only') === true
        }));
    }

    execute(options = {}) {
        this.syncSettings();
        const screenshot = options.screenshot ?? null;
        const optsClean = { ...options };
        delete optsClean.screenshot;
        const resultJson = this._native.execute(JSON.stringify(optsClean), screenshot);
        const result = JSON.parse(resultJson);
        if (result.success && screenshot) result.screenshot = screenshot;
        return result;
    }

    reset() { this._native.reset(); }
    getState() { return this._native.get_state().value_nick ?? 'idle'; }
    getStats() { return JSON.parse(this._native.get_stats_json()); }
    getLastResult() {
        const json = this._native.get_last_result_json();
        return json ? JSON.parse(json) : null;
    }
    isAIAvailable() { return this._native.is_ai_available(); }
    setMinInterval(ms) { this._native.set_min_interval(ms); }
    clearPendingFrame() { this._native.clear_pending_frame(); }
    isFrameBufferingEnabled() { return this._native.is_frame_buffering_enabled(); }
    hasPendingFrame() { return this._native.has_pending_frame(); }

    onEvent(callback) {
        this._eventListeners.push(callback);
        return () => { this._eventListeners = this._eventListeners.filter(l => l !== callback); };
    }

    notifyEventListeners(eventName, data) {
        this._eventListeners.forEach((callback) => {
            tryRun('ReverseImmersivityService.pipelineEvent.notify', () => callback(eventName, data));
        });
    }

    get state() { return this.getState(); }
    get isRunning() { return false; }
    get lastResult() { return this.getLastResult(); }
    get minIntervalMs() { return 5000; }
    get stats() { return this.getStats(); }

    log(level, message, data = null) { this.logger?.[level]?.('ReverseImmersivityService', message, data); }
    destroy() {
        this._eventListeners = [];
        this._native.cleanup();
    }
}
