export function applyServerEditControllerRequests(targetPrototype) {
    targetPrototype.submitThemeDeleteCallback = function(themeId, password, callback) {
        let serverUrl = this.getServerBaseUrl(),
            allowInsecure = !!this.settings?.allowInsecureUpload;

        if (!serverUrl || !themeId) return callback(new Error(this.t('THEME_ID_MISSING')), null);

        this.sendHttpJsonCallback('POST', `${serverUrl}/themes/${themeId}/delete`, {password}, {allowInsecure}, callback);
    };

    targetPrototype.submitThemeUpdateCallback = function(updateData, login, password, callback) {
        let serverUrl = this.getServerBaseUrl(),
            allowInsecure = !!this.settings?.allowInsecureUpload,
            normalizedPayload = this.parseUpdatePayload(updateData),
            authorizationHeader = this.buildAuthorizationHeader(login, password),
            themeId = this.theme?.id;

        if (!serverUrl || !themeId) return callback(new Error(this.t('THEME_ID_MISSING')), null);

        this.tryEndpoints([{
            method: 'POST',
            url: `${serverUrl}/themes/${themeId}/update`,
            payload: normalizedPayload
        }], 0, allowInsecure, authorizationHeader, callback);
    };

    targetPrototype.tryEndpoints = function(endpoints, index, allowInsecure, authorizationHeader, callback) {
        if (index >= endpoints.length) return callback(new Error(this.t('SERVER_EDIT_UPDATE_FAILED')), null);

        let endpoint = endpoints[index],
            hasFiles = endpoint.payload.archivePath || endpoint.payload.previewPath;

        let handleResponse = (error, response) => (
            error
                ? this.tryEndpoints(endpoints, index + 1, allowInsecure, authorizationHeader, callback)
                : callback(null, response)
        );
        hasFiles
            ? this.sendHttpMultipartCallback(endpoint.method, endpoint.url, endpoint.payload, {
                allowInsecure,
                authorizationHeader
            }, handleResponse)
            : this.sendHttpJsonCallback(endpoint.method, endpoint.url, endpoint.payload, {
                allowInsecure,
                authorizationHeader
            }, handleResponse);
    };

    targetPrototype.notify = function(message) {
        this.notifier?.notify?.(message);
    };
}
