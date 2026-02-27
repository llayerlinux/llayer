import Soup from 'gi://Soup?version=2.4';
import GLib from 'gi://GLib';
import { parseServerAddress, parseId } from '../utils/Utils.js';

const THEME_ID_FIELDS = ['id', 'themeId', 'theme_id'];

export class PerformanceStatsReporter {
    constructor(settingsService, logger = null, themeRepository = null) {
        this.settingsService = settingsService;
        this.logger = logger;
        this.themeRepository = themeRepository;
    }

    buildPayload(metrics) {
        const installMs = this.parseMetric(metrics.installMs);
        const applyMs = this.parseMetric(metrics.applyMs);
        return {
            payload: {
                ...(installMs !== null && {installMs}),
                ...(applyMs !== null && {applyMs})
            },
            installMs,
            applyMs
        };
    }

    send(theme, metrics = {}, attempt = 1) {
        const settings = this.getSettings();
        const {payload, installMs, applyMs} = this.buildPayload(metrics);

        const serverBase = parseServerAddress(this.settingsService.getServerAddress());
        const themeId = this.extractThemeId(theme);
        const identifier = serverBase ? this.extractThemeIdentifier(theme, themeId) : null;
        const canSend = settings.sendPerformanceStats
            && (installMs !== null || applyMs !== null)
            && serverBase
            && identifier
            && Object.keys(payload).length;

        if (!canSend) {
            return;
        }

        const endpoint = `${serverBase}/themes/${encodeURIComponent(identifier)}/performance`;

        const session = new Soup.Session();
        session.timeout = 10;
        const message = Soup.Message.new('POST', endpoint);
        message.request_headers.append('Content-Type', 'application/json');
        message.request_headers.append('Accept', 'application/json');

        const bodyString = JSON.stringify(payload);
        const hasModernAPI = typeof message.set_request_body_from_bytes === 'function';

        hasModernAPI
            ? message.set_request_body_from_bytes('application/json', GLib.Bytes.new(new TextEncoder().encode(bodyString)))
            : message.set_request('application/json', Soup.MemoryUse.COPY, bodyString);

        session.queue_message(message, (_sess, msg) => {
            const isSuccess = msg.status_code >= 200 && msg.status_code < 300;
            const isRetriable = msg.status_code === 404 && attempt === 1 && themeId != null;

            if (isSuccess || !isRetriable) {
                return;
            }

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.getThemeIdFromServer(theme, serverBase)
                    .then(updated => updated && this.send(theme, payload, attempt + 1));
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    getSettings() {
        return this.settingsService.getAll();
    }

    parseMetric(value) {
        return (typeof value === 'number' && Number.isFinite(value) && value >= 0)
            ? Math.round(value)
            : null;
    }

    extractThemeId(theme) {
        const direct = parseId(theme?.id);

        const candidates = [
            theme?.themeId,
            theme?.theme_id,
            theme?.metadata?.id,
            theme?.metadata?.originalTheme,
            theme?.originalTheme
        ];
        const nestedId = candidates
            .map((value) => (value && typeof value === 'object') ? this.extractThemeId(value) : parseId(value))
            .find((value) => value !== null);
        return direct !== null ? direct : (nestedId ?? null);
    }

    extractThemeIdentifier(theme, explicitId = null) {
        const candidates = [
            explicitId != null ? String(explicitId) : null,
            (() => {
                const id = this.extractThemeId(theme);
                return id != null ? String(id) : null;
            })(),
            (theme?.name || theme?.title || '').trim() || null,
            theme?.metadata?.originalTheme?.name?.trim() || null
        ];

        return candidates.find(v => v) ?? null;
    }

    async getThemeIdFromServer(theme, serverBase) {
        let repository = this.themeRepository;
        if (!repository || typeof repository.getNetworkThemeByName !== 'function') {
            return false;
        }

        let nameGetters = [
            theme?.name,
            theme?.title,
            theme?.metadata?.originalTheme?.name,
            theme?.metadata?.originalTheme?.title,
            theme?.originalTheme?.name
        ];

        let candidateNames = nameGetters
            .filter(v => typeof v === 'string' && v.trim())
            .map(v => v.trim());

        if (candidateNames.length === 0) {
            return false;
        }

        for (const themeName of candidateNames) {
            const remoteTheme = await repository.getNetworkThemeByName(themeName, serverBase);
            if (!remoteTheme?.id) {
                continue;
            }
            if (Number(remoteTheme.id) === Number(theme.id)) {
                return false;
            }

            THEME_ID_FIELDS.forEach(prop => theme[prop] = remoteTheme.id);

            theme.metadata ??= {};
            theme.metadata.originalTheme ??= {};
            theme.metadata.originalTheme.id = remoteTheme.id;

            this.persistUpdatedMetadata(theme);
            return true;
        }
        return false;
    }

    persistUpdatedMetadata(theme) {
        const metadataPath = theme?.metadataPath || (theme?.path && `${theme.path}/lastlayer-metadata.json`);
        metadataPath && GLib.file_set_contents(
            metadataPath,
            JSON.stringify((theme?.metadata && typeof theme.metadata === 'object') ? theme.metadata : {}, null, 2)
        );
    }
}
