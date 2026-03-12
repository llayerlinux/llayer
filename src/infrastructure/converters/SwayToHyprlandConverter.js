import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';

export class SwayToHyprlandConverter {
    constructor(options = {}, auditLog = null) {
        this._native = createAuditedNative(
            new LastlayerSupporter.SwayToHyprlandConverter(),
            'SwayToHyprlandConverter',
            auditLog
        );
        this._logger = options.logger || null;
        if (this._logger) {
            this._native.connect('log-message', (_obj, msg) => this._logger.info?.(msg));
            this._native.connect('warn-message', (_obj, msg) => this._logger.warn?.(msg));
        }
    }

    static detectSway(extractedPath) {
        return LastlayerSupporter.SwayToHyprlandConverter.detect_sway(extractedPath);
    }

    async convert(extractedPath, options = {}) {
        if (options.fixWaybarFonts !== undefined) {
            this._native.fix_waybar_fonts = options.fixWaybarFonts;
        }
        if (options.fixWaybarActive !== undefined) {
            this._native.fix_waybar_active = options.fixWaybarActive;
        }
        return JSON.parse(this._native.convert(extractedPath));
    }
}

export default SwayToHyprlandConverter;
