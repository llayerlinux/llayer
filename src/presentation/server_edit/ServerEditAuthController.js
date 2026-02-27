import GLib from 'gi://GLib';
import { DEFAULT_SERVER_ADDRESS } from '../../infrastructure/constants/AppUrls.js';
import { ServerEditHttpService } from '../../infrastructure/network/ServerEditHttpService.js';
import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';

const AUTH_ERROR_MAPPINGS = [
    {patterns: ['theme_not_found'], key: 'AUTH_THEME_NOT_FOUND'},
    {patterns: ['invalid_author'], key: 'AUTH_INVALID_AUTHOR'},
    {patterns: ['invalid_password', 'wrong_password', 'http 403'], key: 'AUTH_INVALID_PASSWORD'},
    {patterns: ['credentials_required'], key: 'AUTH_CREDENTIALS_REQUIRED'},
    {patterns: ['missing_identifier'], key: 'AUTH_THEME_IDENTIFIER_MISSING'},
    {patterns: ['timeout'], key: 'AUTH_TIMEOUT'},
    {patterns: ['tls', 'ssl'], key: 'AUTH_TLS_ERROR'},
    {
        patterns: ['unable to connect', 'connection refused', 'host not found', 'network'],
        key: 'AUTH_NETWORK_ERROR'
    }
];

export class ServerEditAuthController {
    constructor(view, logger, httpService = null) {
        this.view = view;
        this.logger = logger;
        this.httpService = httpService;

        this.theme = null;
        this.settings = {};
        this.translator = (key) => key;

        this.activeRequest = null;
        this.busy = false;
        this.completion = null;
    }

    setTranslationFunction(translator) {
        this.translator = translator || ((key) => key);
    }

    promptAuthorization(theme, settings, callback) {
        this.theme = theme;
        this.settings = settings ?? {};

        this.disposeRequest();
        this.busy = false;
        this.completion = callback;

        this.view.open({
            theme,
            translator: this.translator,
            onSubmit: ({login, password}) => {
                this.onSubmit(login, password);
            },
            onCancel: () => {
                this.onCancel();
            }
        });
    }

    destroy() {
        this.disposeRequest();
        this.view?.destroy?.();
    }

    onSubmit(rawLogin, rawPassword) {
        if (this.busy) return;

        const [login, password] = [(rawLogin || '').trim(), (rawPassword || '').trim()];
        if (!login || !password) {
            this.view.showError(this.t('FILL_ALL_FIELDS'));
            this.view.setBusy(false);
            return;
        }

        const identifier = this.getThemeIdentifier();
        if (!identifier) {
            this.view.showError(this.t('AUTH_THEME_IDENTIFIER_MISSING'));
            this.view.setBusy(false);
            return;
        }

        this.busy = true;
        this.view.setBusy(true);
        this.view.hideError();

        this.performAuth(login, password, identifier, (error, result) => {
            (error && error?.reason !== 'cancelled') && (() => {
                const message = this.mapErrorMessage(error?.message);
                this.view?.setBusy(false);
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this.view?.showError(message);
                    return GLib.SOURCE_REMOVE;
                });
            })();
            !error && this.complete({login, password});

            this.disposeRequest();
            this.busy = false;
            this.view?.setBusy(false);
        });
    }

    onCancel() {
        this.activeRequest && this.view.setBusy(false);
        this.disposeRequest();
        this.busy = false;
        this.reject(this.cancelError());
    }

    performAuth(login, password, identifier, callback) {
        const endpoint = this.buildEndpoint(identifier),
            payload = {
                login: this.standardizeField(login),
                password: this.standardizeField(password)
            },
            allowInsecure = !!(this.settings?.allowInsecureUpload ?? this.settings?.allowInsecureRequests);

        const {status, responseText} = this.getHttpService().sendJsonSync({
            method: 'POST',
            url: endpoint,
            payload,
            timeout: 30,
            allowInsecure,
            userAgent: 'LastLayer/ServerEdit/Auth/2.0'
        });

        if (status >= 200 && status < 300) {
            callback(null, {status, body: responseText});
            return;
        }

        callback(new Error(this.extractErrorMessage(responseText) || `HTTP ${status}`), null);
    }

    disposeRequest() {
        this.activeRequest = null;
    }

    getHttpService() {
        this.httpService ||= new ServerEditHttpService();
        return this.httpService;
    }

    extractErrorMessage(responseText) {
        if (!responseText) return '';
        const parsed = tryOrNull('extractErrorMessage.parse', () => JSON.parse(responseText));
        if (parsed && typeof parsed === 'object') return parsed.message || parsed.error || '';
        if (responseText.includes('<title>')) {
            const match = responseText.match(/<title>([^<]+)<\/title>/i);
            return match ? match[1].trim() : responseText.substring(0, 100);
        }
        return responseText.substring(0, 100);
    }

    buildEndpoint(identifier) {
        const base = this.getServerAddress();
        return `${base}/themes/${encodeURIComponent(identifier)}/auth`;
    }

    getServerAddress() {
        return (this.standardizeField(this.settings?.serverAddress) || DEFAULT_SERVER_ADDRESS).replace(/\/+$/, '');
    }

    getThemeIdentifier() {
        for (const value of [
            this.theme?.id,
            this.theme?.metadata?.id,
            this.theme?.metadata?.originalTheme?.id,
            this.theme?.originalTheme?.id
        ].filter((v) => v !== undefined && v !== null)) {
            if (!Number.isNaN(Number(value)) && Number(value) > 0) return String(Number(value));
            if (typeof value === 'string' && value.trim()) return value.trim();
        }

        let name = this.theme?.metadata?.originalTheme?.name || this.theme?.name;
        return name && String(name).trim() ? String(name).trim() : null;
    }

    mapErrorMessage(message) {
        if (!message) return this.t('AUTH_FAILED');

        const lower = message.toLowerCase();
        const matched = AUTH_ERROR_MAPPINGS.find((mapping) =>
            mapping.patterns.some((pattern) => lower.includes(pattern))
        );
        return matched ? this.t(matched.key) : message;
    }

    standardizeField(value) {
        return value ? String(value).trim() : '';
    }

    t(key) {
        return this.translator(key);
    }

    finishRequest(error, payload) {
        const callback = this.completion;
        this.completion = null;

        this.view.setBusy(false);
        this.view.close();

        callback?.(error, payload);
    }

    complete(payload) {
        this.finishRequest(null, payload);
    }

    reject(error) {
        this.finishRequest(error, null);
    }

    cancelError() {
        const err = new Error('cancelled');
        err.reason = 'cancelled';
        return err;
    }
}
