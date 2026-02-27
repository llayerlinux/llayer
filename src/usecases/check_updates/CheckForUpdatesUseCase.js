import GLib from 'gi://GLib';
import { Commands } from '../../infrastructure/constants/Commands.js';
import { DEFAULT_SERVER_ADDRESS } from '../../infrastructure/constants/AppUrls.js';
import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';

const DEFAULT_UPDATE_TITLE = 'New version available';
const LOCALIZED_SEGMENT_PATTERN = /\[([a-z]{2})\](.*?)(?=\[|$)/g;

export class CheckForUpdatesUseCase {

    constructor(settingsService, networkThemeService, currentVersion) {
        this.settingsService = settingsService;
        this.networkThemeService = networkThemeService;
        this.currentVersion = currentVersion;
    }

    parseLocalizedString(localizedString, language) {
        if (typeof localizedString !== 'string' || !localizedString.includes('[')) {
            return localizedString == null ? '' : String(localizedString);
        }

        const translations = {};
        for (const match of localizedString.matchAll(LOCALIZED_SEGMENT_PATTERN)) {
            match[1] && (translations[match[1]] = (match[2] || '').trim());
        }

        const [firstLang] = Object.keys(translations);
        return translations[language] || translations.en || (firstLang ? translations[firstLang] : localizedString);
    }

    decodeResponse(stdout) {
        return stdout ? new TextDecoder('utf-8').decode(stdout).trim() : '';
    }

    getCurrentLanguage() {
        return this.settingsService.getAll().language || 'en';
    }

    execute() {
        const currentVersion = this.getCurrentVersion();
        const serverAddress = this.settingsService.getServerAddress() || DEFAULT_SERVER_ADDRESS;
        const updateInfo = this.fetchUpdateInfo(serverAddress);

        const hasUpdate = updateInfo && this.isNewerVersion(currentVersion, updateInfo.version);
        return {hasUpdate: !!hasUpdate, update: hasUpdate ? updateInfo : null};
    }

    fetchUpdateInfo(serverAddress) {
        const [success, stdout, , exitStatus] = GLib.spawn_command_line_sync(`${Commands.CURL} -s "${serverAddress}/app/updates"`);
        return (success && exitStatus === 0 && stdout)
            ? this.parseUpdatePayload(this.decodeResponse(stdout), serverAddress)
            : null;
    }

    parseUpdatePayload(raw, serverAddress) {
        const data = tryOrNull('CheckForUpdatesUseCase.parseUpdate', () => JSON.parse(raw)),
            update = data?.hasUpdate ? data.update : null;
        if (!update) return null;

        const pick = (...values) => values.find(v => typeof v === 'string' && v.trim().length > 0) || null,
            language = this.getCurrentLanguage(),
            changelog = pick(update.changelog, update.changes);

        return {
            version: update.version,
            title: this.parseLocalizedString(pick(update.title, update.announcement) ?? DEFAULT_UPDATE_TITLE, language),
            url: pick(update.updateUrl, update.url, update.download_url) || `${serverAddress}/download`,
            changelog: changelog ? this.parseLocalizedString(changelog, language) : null,
            date: pick(update.date, update.release_date)
        };
    }

    getCurrentVersion() {
        return this.currentVersion;
    }

    isNewerVersion(current, remote) {
        let toParts = (v) => String(v ?? '')
            .replace(/[^0-9.]/g, '')
            .split('.')
            .map(n => parseInt(n, 10) || 0);

        let [currentParts, remoteParts] = [toParts(current), toParts(remote)];
        for (let i = 0, len = Math.max(currentParts.length, remoteParts.length, 3); i < len; i += 1) {
            if ((remoteParts[i] ?? 0) !== (currentParts[i] ?? 0))
                return (remoteParts[i] ?? 0) > (currentParts[i] ?? 0);
        }
        return false;
    }
}
