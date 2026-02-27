import { translateWithFallback, standardizeStringArray } from '../../infrastructure/utils/Utils.js';

export function applyUploadThemeUseCaseUtils(targetPrototype) {
    targetPrototype.log = function(level, message, data = null) {
        const normalized = (typeof level === 'string' ? level : 'info').toLowerCase();
        const loggerMethod = this.logger?.[normalized]?.bind(this.logger);
        loggerMethod
            ? loggerMethod('UploadTheme', message, data)
            : (normalized === 'error' && logError(new Error(`[UPLOAD-THEME] ${data ? `${message} ${JSON.stringify(data)}` : message}`)));
    };

    targetPrototype.trimValue = function(value) {
        return (value == null) ? '' : String(value).trim();
    };

    targetPrototype.standardizeArray = function(value) {
        return standardizeStringArray(value);
    };

    targetPrototype.parseLink = function(value) {
        const link = !value
            ? null
            : (typeof value === 'string'
            ? {label: this.trimValue(value), url: ''}
            : {
                label: this.trimValue([value.label, value.name, value.title].find(Boolean) || ''),
                url: this.trimValue([value.url, value.link].find(Boolean) || '')
            });
        return link && (link.label || link.url) ? link : null;
    };

    targetPrototype.parseMetadata = function(metadata) {
        const parseProperties = (props = {}) => ({
            multiConfig: !!props.multiConfig,
            desktopPlus: !!props.desktopPlus,
            familiar: !!props.familiar,
            widgets: !!props.widgets,
            unique: !!props.unique
        });

        const contest = metadata.contest && typeof metadata.contest === 'object'
            ? {
                participate: !!metadata.contest.participate,
                theme: this.trimValue(metadata.contest.theme || ''),
                redditUrl: this.trimValue(metadata.contest.redditUrl || '')
            }
            : null;

        return {
            name: this.trimValue(metadata.name),
            repoUrl: this.trimValue(metadata.repoUrl),
            published: this.trimValue(metadata.published),
            youtubeLink: this.trimValue(metadata.youtubeLink),
            author: this.parseLink(metadata.author),
            adaptedBy: this.parseLink(metadata.adaptedBy),
            properties: parseProperties(metadata.properties),
            tags: this.standardizeArray(metadata.tags),
            packageSupport: this.standardizeArray(metadata.packageSupport),
            editPassword: this.trimValue(metadata.editPassword),
            contest
        };
    };

    targetPrototype.translate = function(key, params = null) {
        return translateWithFallback(this.translator, key, params);
    };
}
