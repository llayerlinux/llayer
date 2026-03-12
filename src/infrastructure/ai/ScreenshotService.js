import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';

export const CaptureMode = {
    ACTIVE_WINDOW: 'active_window',
    FULL_SCREEN: 'full_screen',
    REGION: 'region',
    SPECIFIC_WINDOW: 'specific_window'
};

export class ScreenshotService {
    constructor(logger = null, auditLog = null) {
        this._native = createAuditedNative(new LastlayerSupporter.ScreenshotService(), 'ScreenshotService', auditLog);
        this.logger = logger;
        if (logger) {
            this._native.connect('log-message', (_obj, msg) => logger.debug?.('ScreenshotService', msg));
            this._native.connect('warn-message', (_obj, msg) => logger.warn?.('ScreenshotService', msg));
            this._native.connect('error-message', (_obj, msg) => logger.error?.('ScreenshotService', msg));
        }
    }

    capture(mode = CaptureMode.ACTIVE_WINDOW, options = {}) {
        const resultJson = this._native.capture(mode, JSON.stringify(options));
        const result = JSON.parse(resultJson);
        if (result.success) {
            result.pixbuf = this._native.last_screenshot;
        }
        return result;
    }

    getLastScreenshot() {
        return { pixbuf: this._native.last_screenshot };
    }

    scalePixbuf(pixbuf, maxWidth, maxHeight) {
        if (!pixbuf) return null;
        return this._native.scale_pixbuf(pixbuf, maxWidth, maxHeight);
    }

    destroy() {
        this._native.cleanup();
    }
}
