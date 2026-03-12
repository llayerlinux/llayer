import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';

export const DecisionType = { SELECT_TAG: 'SELECT_TAG', DISAMBIGUATE_THEME: 'DISAMBIGUATE_THEME', ANALYZE_VISUAL: 'ANALYZE_VISUAL' };
export const AIDecisionError = { NO_PROVIDER: 'NO_AI_PROVIDER', NO_TAGS: 'NO_TAGS_AVAILABLE', NO_THEMES: 'NO_THEMES_AVAILABLE', AI_REQUEST_FAILED: 'AI_REQUEST_FAILED', PARSE_FAILED: 'PARSE_FAILED' };

export class AIDecisionService {
    constructor(aiProviderService = null, logger = null, auditLog = null) {
        this.logger = logger;
        this.aiProviderService = aiProviderService;
        this._auditLog = auditLog;
        const nativeProvider = aiProviderService?._native ?? null;
        if (nativeProvider) {
            this._native = createAuditedNative(new LastlayerSupporter.AIDecisionService({
                provider_service: nativeProvider,
            }), 'AIDecisionService', auditLog);
        } else {
            this._dummyProvider = new LastlayerSupporter.AIProviderService();
            this._native = createAuditedNative(new LastlayerSupporter.AIDecisionService({
                provider_service: this._dummyProvider,
            }), 'AIDecisionService', auditLog);
        }
        if (logger) {
            this._native.connect('log-message', (_o, msg) => logger.debug?.('AIDecisionService', msg));
            this._native.connect('warn-message', (_o, msg) => logger.warn?.('AIDecisionService', msg));
        }
    }

    setAIProvider(aiProviderService) {
        this.aiProviderService = aiProviderService;
        if (aiProviderService?._native) {
            if (this._dummyProvider) {
                this._dummyProvider.cleanup();
                this._dummyProvider = null;
            }
            this._native = createAuditedNative(new LastlayerSupporter.AIDecisionService({
                provider_service: aiProviderService._native,
            }), 'AIDecisionService', this._auditLog);
            if (this.logger) {
                this._native.connect('log-message', (_o, msg) => this.logger.debug?.('AIDecisionService', msg));
                this._native.connect('warn-message', (_o, msg) => this.logger.warn?.('AIDecisionService', msg));
            }
        }
    }

    isAIAvailable() { return this._native.is_ai_available(); }

    selectTag(screenshot, availableTags, options = {}) {
        this.syncSettings();
        const tagsJson = JSON.stringify(availableTags);
        const optsJson = JSON.stringify(options);
        const resultJson = this._native.select_tag(screenshot ?? null, tagsJson, optsJson);
        return JSON.parse(resultJson);
    }

    selectTagSync(screenshot, availableTags) {
        return { success: false, error: 'SYNC_NOT_SUPPORTED', value: null, confidence: 0 };
    }

    disambiguateTheme(screenshot, tag, themes) {
        this.syncSettings();
        const themesJson = JSON.stringify(themes);
        const resultJson = this._native.disambiguate_theme(screenshot ?? null, tag, themesJson);
        return JSON.parse(resultJson);
    }

    disambiguateThemeSync(screenshot, tag, themes) {
        return { success: false, error: 'SYNC_NOT_SUPPORTED', selectedTheme: null, confidence: 0 };
    }

    pixbufToOptimizedImage(pixbuf) {
        if (!pixbuf) return null;
        const json = this._native.pixbuf_to_optimized_image_json(pixbuf);
        return json ? JSON.parse(json) : null;
    }

    syncSettings() {
        const sm = this.aiProviderService?.settingsService?.settingsManager;
        if (!sm) return;
        this._native.configure(JSON.stringify({
            ai_filter_logs_only: sm.get?.('ai_filter_logs_only') === true,
            ai_image_max_side: sm.get?.('ai_image_max_side') ?? 1024,
            ai_image_quality: sm.get?.('ai_image_quality') ?? 80,
            ai_image_format: sm.get?.('ai_image_format') ?? 'jpeg',
            ai_send_temperature: sm.get?.('ai_send_temperature') === true,
            ai_temperature: sm.get?.('ai_temperature') ?? 0.2,
            ai_override_max_tokens: sm.get?.('ai_override_max_tokens') === true,
            ai_max_tokens: sm.get?.('ai_max_tokens') ?? 256
        }));
    }

    log(level, message, data = null) { this.logger?.[level]?.('AIDecisionService', message, data); }
    destroy() {
        this._native.cleanup();
        if (this._dummyProvider) {
            this._dummyProvider.cleanup();
            this._dummyProvider = null;
        }
    }
}
