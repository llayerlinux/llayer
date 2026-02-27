import GLib from 'gi://GLib';
import { THEME_PROPERTY_FLAGS } from '../../infrastructure/constants/ThemeProperties.js';
import { TRUTHY_STRINGS } from '../../infrastructure/constants/BooleanValues.js';
import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';
import { standardizeStringArray } from '../../infrastructure/utils/Utils.js';

const OPTIONAL_PAYLOAD_KEYS = ['author', 'adaptedBy', 'repoUrl', 'themeId', 'originalName', 'newPassword'];

export function applyServerEditControllerPayload(targetPrototype) {
    targetPrototype.parseUpdatePayload = function(data) {
        function trimStr(value) {
            return (value == null ? '' : String(value)).trim();
        }

        function sanitizeLink(link) {
            let normalized = !link
                ? null
                : (typeof link === 'string'
                ? {label: trimStr(link), url: ''}
                : {
                    label: trimStr(link.label || link.name || link.title || ''),
                    url: trimStr(link.url || link.link || '')
                });
            return normalized && (normalized.label || normalized.url) ? normalized : null;
        }

        function parseProperties(raw) {
            if (!raw) return {};
            raw = typeof raw === 'string'
                ? (tryOrNull('ServerEditControllerPayload.parseProperties', () => JSON.parse(raw)) ?? {})
                : raw;
            if (Array.isArray(raw)) {
                let parsed = {};
                raw.forEach((entry) => {
                    typeof entry === 'string'
                        ? (trimStr(entry) && (parsed[trimStr(entry)] = true))
                        : Object.keys(entry ?? {}).forEach((key) => entry[key] && (parsed[key] = true));
                });
                raw = parsed;
            }

            let result = {};
            THEME_PROPERTY_FLAGS.forEach((flag) => {
                Object.prototype.hasOwnProperty.call(raw, flag) && (() => {
                    let value = raw[flag];
                    result[flag] = typeof value === 'string'
                        ? TRUTHY_STRINGS.includes(value.trim().toLowerCase())
                        : Boolean(value);
                })();
            });
            return result;
        }

        let baseProperties = {
            multiConfig: false,
            desktopPlus: false,
            familiar: false,
            widgets: false,
            unique: false
        },
        normalizedProperties = Object.assign(
            {},
            baseProperties,
            parseProperties(data?.properties ?? {})
        );

        let tagsString = standardizeStringArray(data?.tags).join(','),
            packageSupportString = standardizeStringArray(data?.packageSupport).join(',');

        let payload = {
            name: trimStr(data?.name) || trimStr(this.theme?.name),
            repoUrl: trimStr(data?.repoUrl),
            published: trimStr(data?.published),
            youtubeLink: trimStr(data?.youtubeLink),
            author: sanitizeLink(data?.author),
            adaptedBy: sanitizeLink(data?.adaptedBy),
            properties: normalizedProperties,
            tags: tagsString,
            packageSupport: packageSupportString,
            editPassword: trimStr(data?.editPassword),
            newPassword: trimStr(data?.newPassword) || null,
            originalName: trimStr(data?.originalName || this.theme?.name),
            themeId: this.theme?.id || null,
            archivePath: data?.archivePath || null,
            previewPath: data?.previewPath || null
        };

        OPTIONAL_PAYLOAD_KEYS.forEach(key => {
            payload[key] || delete payload[key];
        });

        return payload;
    };

    targetPrototype.buildAuthorizationHeader = function(login, password) {
        let user = this.trimString(login),
            secret = this.trimString(password);
        return (!user || !secret)
            ? null
            : `Basic ${GLib.base64_encode(new TextEncoder().encode(`${user}:${secret}`))}`;
    };

    targetPrototype.trimString = function(value) {
        return (value == null ? '' : String(value)).trim();
    };
}
