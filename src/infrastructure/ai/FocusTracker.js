import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export const FocusMode = {
    ANY_CURRENT_FOCUS: 'any_focus',
    SPECIFIC_WINDOW: 'specific_window',
    SPECIFIC_CLASS: 'specific_class'
};

const FOCUS_MODE_MAP = {
    [FocusMode.ANY_CURRENT_FOCUS]: LastlayerSupporter.FocusMode.ANY_CURRENT_FOCUS,
    [FocusMode.SPECIFIC_WINDOW]: LastlayerSupporter.FocusMode.SPECIFIC_WINDOW,
    [FocusMode.SPECIFIC_CLASS]: LastlayerSupporter.FocusMode.SPECIFIC_CLASS,
};

export class FocusTracker {
    constructor(logger = null, settingsService = null, auditLog = null) {
        this._native = createAuditedNative(new LastlayerSupporter.FocusTracker(), 'FocusTracker', auditLog);
        this.logger = logger;
        this.settingsService = settingsService;
        this.listeners = [];

        this._native.connect('focus-changed', (_obj, focusJson) => {
            const data = tryOrDefault('FocusTracker.focusChanged', () => JSON.parse(focusJson), null);
            if (!data) {
                return;
            }
            this.notifyListeners(data.event, data);
        });
    }

    logMessage(message) {
        const filterLogsOnly = this.settingsService?.settingsManager?.get?.('ai_filter_logs_only') === true;
        if (filterLogsOnly) return;
        print(message);
    }

    setMode(mode, options = {}) {
        const nativeMode = FOCUS_MODE_MAP[mode] ?? LastlayerSupporter.FocusMode.ANY_CURRENT_FOCUS;
        this._native.set_mode(nativeMode, JSON.stringify(options));
    }

    startTracking() {
        this._native.start_tracking();
    }

    stopTracking() {
        this._native.stop_tracking();
    }

    getCurrentFocus() {
        const json = this._native.get_current_focus_json();
        return json ? JSON.parse(json) : null;
    }

    getFocusDisplayString() {
        return this._native.get_focus_display_string();
    }

    hasFocusChangedRecently(windowMs = 1500) {
        return this._native.has_focus_changed_recently(windowMs);
    }

    takeSnapshot() {
        this._native.take_snapshot();
    }

    hasFocusChangedFromSnapshot() {
        return this._native.has_focus_changed_from_snapshot();
    }

    pollAndCheckFocusChanged() {
        return this._native.poll_and_check_focus_changed();
    }

    onFocusChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            tryRun('FocusTracker.notifyListeners', () => callback(event, data));
        });
    }

    async getAllWindows() {
        return tryOrDefault('FocusTracker.getAllWindows', () => {
            const json = this._native.get_all_windows();
            return json ? JSON.parse(json) : [];
        }, []);
    }

    get isTracking() {
        return this._native.is_tracking;
    }

    get currentFocus() {
        return this.getCurrentFocus();
    }

    get lastFocusChangeTime() {
        return 0;
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('FocusTracker', message, data);
    }

    destroy() {
        this.listeners = [];
        this._native.destroy();
    }
}
