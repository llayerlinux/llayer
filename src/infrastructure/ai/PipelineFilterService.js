import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';

export const FilterMode = { ML: 'ml', PROGRAMMATIC: 'programmatic' };

export const ComparisonAlgorithm = {
    HISTOGRAM: 'histogram',
    AVERAGE_HASH: 'average_hash',
    DIFFERENCE_HASH: 'difference_hash',
    COLOR_MOMENTS: 'color_moments',
    BLOCK_HASH: 'block_hash',
    GRADIENT_HISTOGRAM: 'gradient_histogram',
    ZONE_HASH: 'zone_hash',
    RADIAL_VARIANCE: 'radial_variance'
};

export class PipelineFilterService {
    constructor(dependencies = {}) {
        const auditLog = dependencies.auditLog ?? null;
        this._native = createAuditedNative(new LastlayerSupporter.PipelineFilterService(), 'PipelineFilterService', auditLog);
        this.aiProviderService = dependencies.aiProviderService ?? null;
        this.settingsService = dependencies.settingsService ?? null;
        this.logger = dependencies.logger ?? null;

        if (this.aiProviderService?._native) {
            this._native.set_ai_provider(this.aiProviderService._native);
        }

        if (this.logger) {
            this._native.connect('log-message', (_o, msg) => this.logger.debug?.('PipelineFilterService', msg));
        }
    }

    isEnabled() { return this._native.is_enabled(); }
    setEnabled(enabled) { this._native.set_enabled(enabled); }

    getConfig() { return JSON.parse(this._native.get_config_json()); }
    updateConfig(updates) { this._native.update_config(JSON.stringify(updates)); }

    getStats() { return JSON.parse(this._native.get_stats_json()); }

    shouldFilter(screenshot, context = null) {
        const contextJson = context ? JSON.stringify({
            processName: context.processName ?? context.process ?? '',
            windowClass: context.windowClass ?? context.class ?? '',
            pid: context.pid ?? 0
        }) : '{}';
        return JSON.parse(this._native.should_filter(screenshot, contextJson));
    }

    addReferenceImage(filePath, name = null) {
        return JSON.parse(this._native.add_reference_image(filePath, name));
    }

    addReferenceFromPixbuf(pixbuf, name = 'Screenshot') {
        return JSON.parse(this._native.add_reference_from_pixbuf(pixbuf, name));
    }

    removeReferenceImage(id) {
        return JSON.parse(this._native.remove_reference_image(id));
    }

    getReferenceImages() {
        return JSON.parse(this._native.get_reference_images_json());
    }

    hasReferenceMatch(pixbuf) { return this._native.has_reference_match(pixbuf); }

    recalculateFeatures() { this._native.recalculate_features(); }

    get config() { return this.getConfig(); }
    get stats() { return this.getStats(); }

    log(level, message, data = null) { this.logger?.[level]?.('PipelineFilterService', message, data); }
    destroy() { this._native.cleanup(); }
}
