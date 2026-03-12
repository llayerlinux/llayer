import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { tryRun } from '../utils/ErrorUtils.js';

export const ChangeAlgorithm = { MORE_1: 'more1', MORE_2: 'more2' };

const ALGO_MAP = {
    [ChangeAlgorithm.MORE_1]: LastlayerSupporter.ChangeAlgorithm.MORE_1,
    [ChangeAlgorithm.MORE_2]: LastlayerSupporter.ChangeAlgorithm.MORE_2,
};

export class ChangeDetectionService {
    constructor(screenshotService, logger = null, auditLog = null) {
        this._native = createAuditedNative(new LastlayerSupporter.ChangeDetectionService({
            screenshot_service: screenshotService._native,
        }), 'ChangeDetectionService', auditLog);
        this.logger = logger;
        this.listeners = [];

        this._native.connect('change-detected', (_obj, percent) => {
            this.notifyListeners(percent);
        });
    }

    notifyListeners(percent) {
        this.listeners.forEach((callback) => {
            tryRun('ChangeDetectionService.changeDetected', () => callback(percent));
        });
    }

    setAlgorithm(algorithm) {
        const native = ALGO_MAP[algorithm] ?? LastlayerSupporter.ChangeAlgorithm.MORE_1;
        this._native.set_algorithm(native);
    }

    setCaptureMode(captureMode) {
        this._native.set_capture_mode(captureMode);
    }

    start(captureMode = 'active_window') {
        this._native.start(captureMode);
    }

    stop() {
        this._native.stop();
    }

    getLastChangePercent() {
        return this._native.get_last_change_percent();
    }

    onChangeDetected(callback) {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    get isRunning() { return this._native.is_running; }
    get lastChangePercent() { return this._native.get_last_change_percent(); }

    log(level, message, data = null) { this.logger?.[level]?.('ChangeDetectionService', message, data); }
    destroy() {
        this.listeners = [];
        this._native.destroy();
    }
}
