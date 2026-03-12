import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { tryRun } from '../utils/ErrorUtils.js';

export const ProtocolKind = {
    OPENAI_COMPAT: 'openai_compat_chat_completions',
    ANTHROPIC: 'anthropic_messages',
    OLLAMA: 'ollama_generate',
    CUSTOM_HTTP: 'custom_http'
};

export const ProviderType = { API: 'api', LOCAL: 'local' };

export class AIProviderService {
    constructor(settingsService, logger = null, auditLog = null) {
        this._native = createAuditedNative(new LastlayerSupporter.AIProviderService(), 'AIProviderService', auditLog);
        this.settingsService = settingsService;
        this.logger = logger;
        this._changeListeners = [];

        if (logger) {
            this._native.connect('log-message', (_o, msg) => logger.debug?.('AIProviderService', msg));
            this._native.connect('warn-message', (_o, msg) => logger.warn?.('AIProviderService', msg));
            this._native.connect('error-message', (_o, msg) => logger.error?.('AIProviderService', msg));
        }
        this._native.connect('providers-changed', () => {
            const providers = this.getProviders();
            const activeId = this.getActiveProviderId();
            this.notifyChangeListeners(providers, activeId);
        });

        this.syncSettings();
    }

    syncSettings() {
        const sm = this.settingsService?.settingsManager;
        if (!sm) return;
        this._native.configure(JSON.stringify({
            filter_logs_only: sm.get?.('ai_filter_logs_only') === true,
            force_reliable_provider: sm.get?.('ai_force_reliable_provider') === true,
            disable_save_screenshots: sm.get?.('ai_disable_save_screenshots') === true
        }));
    }

    addProvider(config) {
        const json = this._native.add_provider(JSON.stringify(config));
        return JSON.parse(json);
    }
    updateProvider(id, updates) {
        const json = this._native.update_provider(id, JSON.stringify(updates));
        return json ? JSON.parse(json) : null;
    }
    deleteProvider(id) { return this._native.delete_provider(id); }

    getProviders() { return JSON.parse(this._native.get_providers_json()); }
    getProvider(id) {
        const json = this._native.get_provider_json(id);
        return json ? JSON.parse(json) : null;
    }

    setActiveProvider(id) { return this._native.set_active_provider(id); }
    getActiveProvider() {
        const json = this._native.get_active_provider_json();
        return json ? JSON.parse(json) : null;
    }
    getActiveProviderId() { return this._native.get_active_provider_id(); }
    hasActiveProvider() { return this._native.has_active_provider(); }
    getProvidersForDropdown() { return JSON.parse(this._native.get_providers_for_dropdown()); }

    sendRequest(prompt, options = {}) {
        this.syncSettings();
        const json = this._native.send_request(prompt, JSON.stringify(options));
        return JSON.parse(json);
    }

    testConnectionSync(id) {
        const json = this._native.test_connection_sync(id);
        return JSON.parse(json);
    }
    async testConnection(id) { return this.testConnectionSync(id); }

    getProviderLogs(providerId) { return JSON.parse(this._native.get_provider_logs_json(providerId)); }
    clearProviderLogs(providerId) { this._native.clear_provider_logs(providerId); }

    getChatLogs(providerId) { return JSON.parse(this._native.get_chat_logs_json(providerId)); }
    clearChatLogs(providerId) { this._native.clear_chat_logs(providerId); }

    addProviderLog() { }

    notifyChangeListeners(providers, activeId) {
        this._changeListeners.forEach((callback) => {
            tryRun('AIProviderService.providersChanged', () => callback(providers, activeId));
        });
    }

    onProvidersChanged(callback) {
        this._changeListeners.push(callback);
        return () => { this._changeListeners = this._changeListeners.filter(l => l !== callback); };
    }

    createImageThumbnail(base64) { return this._native.create_image_thumbnail(base64); }

    log(level, message, data = null) { this.logger?.[level]?.('AIProviderService', message, data); }
    destroy() {
        this._changeListeners = [];
        this._native.cleanup();
    }
}
