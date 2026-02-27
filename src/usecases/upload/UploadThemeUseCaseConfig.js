export function applyUploadThemeUseCaseConfig(targetPrototype) {
    targetPrototype.getServerConfig = function(serverAddressOverride) {
        const networkSettings = this.settingsService?.getNetworkThemeSettings?.() ?? {};
        const settings = this.settingsService?.settings ?? {};

        const serverAddress = serverAddressOverride
            || networkSettings.serverAddress
            || this.settingsService?.getServerAddress?.()
            || null;

        return {
            serverUrl: serverAddress ? serverAddress.replace(/\/$/, '') : null,
            allowInsecureUpload: Boolean(networkSettings.allowInsecureUpload || settings.allowInsecureUpload),
            useLegacyEndpoints: Boolean(networkSettings.useOldRequests)
        };
    };

    targetPrototype.buildUploadEndpoints = function(serverUrl, useLegacyEndpoints) {
        const endpoints = serverUrl ? [{url: `${serverUrl}/themes`, mode: 'themes'}] : [];
        serverUrl && useLegacyEndpoints && endpoints.push({url: `${serverUrl}/upload-themes-linx`, mode: 'legacy'});
        return endpoints;
    };

    targetPrototype.mapServerError = function(rawError, status) {
        const normalized = (rawError || '').toString().trim().toLowerCase();
        return status === 0
            ? (
                rawError && rawError.trim()
                    ? this.translate('UPLOAD_ERROR_SERVER', {reason: rawError})
                    : this.translate('UPLOAD_ERROR_NETWORK')
            )
            : (() => {
                const mapping = {
                    preview_missing: 'UPLOAD_ERROR_PREVIEW_MISSING',
                    archive_missing: 'UPLOAD_ERROR_ARCHIVE_MISSING',
                    wrong_password: 'UPLOAD_ERROR_INVALID_PASSWORD',
                    invalid_password: 'UPLOAD_ERROR_INVALID_PASSWORD',
                    duplicate: 'UPLOAD_ERROR_ALREADY_EXISTS',
                    'already exists': 'UPLOAD_ERROR_ALREADY_EXISTS',
                    metadata_missing: 'UPLOAD_ERROR_METADATA_MISSING',
                    metadata_invalid: 'UPLOAD_ERROR_METADATA_INVALID',
                    theme_exists: 'UPLOAD_ERROR_THEME_EXISTS',
                    author_missing: 'UPLOAD_ERROR_AUTHOR_MISSING',
                    password_missing: 'UPLOAD_ERROR_PASSWORD_MISSING',
                    filesystem: 'UPLOAD_ERROR_FILESYSTEM',
                    upload_failed: 'UPLOAD_ERROR_UPLOAD_FAILED'
                };

                const matchedKey = Object.keys(mapping).find((key) => normalized.includes(key));
                return matchedKey
                    ? this.translate(mapping[matchedKey])
                    : status >= 400
                    ? this.translate('UPLOAD_ERROR_SERVER', {reason: rawError || status})
                    : this.translate('UPLOAD_ERROR_UNKNOWN');
            })();
    };

    targetPrototype.buildServerThemePayload = function(normalized) {
        const ensureLink = (link, defaultLabel) => {
            return link
                ? (() => {
                    const label = ([link.label, link.name, link.title].find(Boolean) || '').trim();
                    const url = ([link.url, link.link].find(Boolean) || '').trim();
                    return {label: label || defaultLabel, url};
                })()
                : {label: defaultLabel, url: ''};
        };

        const normalizedTags = Array.isArray(normalized.tags) ? normalized.tags : [];
        const normalizedPackages = Array.isArray(normalized.packageSupport) ? normalized.packageSupport : [];

        const properties = normalized.properties ?? {};

        return {
            id: normalized.id ?? null,
            name: normalized.name,
            repoUrl: normalized.repoUrl || '',
            published: normalized.published || '',
            youtubeLink: normalized.youtubeLink || '',
            author: ensureLink(normalized.author, normalized.name),
            adaptedBy: normalized.adaptedBy ? ensureLink(normalized.adaptedBy, normalized.adaptedBy.label || '') : null,
            properties: {
                multiConfig: Boolean(properties.multiConfig),
                desktopPlus: Boolean(properties.desktopPlus),
                familiar: Boolean(properties.familiar),
                widgets: Boolean(properties.widgets),
                unique: Boolean(properties.unique)
            },
            tags: normalizedTags.join(','),
            packageSupport: normalizedPackages.join(','),
            editPassword: normalized.editPassword
        };
    };

    targetPrototype.validateRequest = function({archivePath, previewPath, normalized, serverConfig}) {
        const checks = [
            [!archivePath || !previewPath, {key: 'UPLOAD_ARCHIVE_AND_PREVIEW_REQUIRED'}],
            [!normalized.name, {key: 'UPLOAD_NAME_REQUIRED'}],
            [!normalized.editPassword, {key: 'UPLOAD_EDIT_PASSWORD_REQUIRED'}],
            [!serverConfig.serverUrl, {key: 'UPLOAD_SERVER_NOT_CONFIGURED'}],
            [
                serverConfig.serverUrl && !serverConfig.serverUrl.startsWith('https://') && !serverConfig.allowInsecureUpload,
                {key: 'UPLOAD_HTTPS_REQUIRED'}
            ]
        ];
        const failed = checks.find(([condition]) => condition);
        return failed ? failed[1] : null;
    };
}
