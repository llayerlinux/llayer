export const ThemeSource = {
    LOCAL: 'local',
    NETWORK: 'network',
    LOCAL_WITH_METADATA: 'local_with_metadata'
};

const ThemeStatus = {
    AVAILABLE: 'available',
    INSTALLED: 'installed',
    ACTIVE: 'active',
    DOWNLOADING: 'downloading',
    INSTALLING: 'installing',
    ERROR: 'error'
};

export class Theme {
    constructor(data = {}) {
        this.name = data.name || '';
        this.source = data.source || ThemeSource.LOCAL;
        this.status = data.status || ThemeStatus.AVAILABLE;
        this.title = data.title || data.name || '';
        this.description = data.description || '';
        this.icon = data.icon || '';
        this.previewUrl = data.previewUrl || '';
        this.id = data.id || null;
        this.published = data.published || '';
        this.youtubeLink = data.youtubeLink || '';
        this.author = data.author || null;
        this.adaptedBy = data.adaptedBy || null;
        this.repoUrl = data.repoUrl || '';
        this.downloadCount = data.downloadCount || 0;
        this.url = data.url || data.archiveUrl || '';
        this.archiveUrl = data.archiveUrl || data.url || '';
        this.downloadUrl = data.downloadUrl || this.url || this.archiveUrl || '';
        this.averageInstallMs = this.parseDuration(data.averageInstallMs);
        this.averageApplyMs = this.parseDuration(data.averageApplyMs);
        this.installCount = typeof data.installCount === 'number' ? data.installCount : 0;
        this.applyCount = typeof data.applyCount === 'number' ? data.applyCount : 0;
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        this.properties = data.properties ?? {};
        this.packageSupport = data.packageSupport ?? {};
        this.installScripts = data.installScripts ?? [];
        this.createdAt = data.createdAt || null;
        this.updatedAt = data.updatedAt || null;
        this.isLocalWithMetadata = data.isLocalWithMetadata || false;
        this.requiresReboot = data.requiresReboot || false;
        this.standardize();
    }

    standardize() {
        this.name = typeof this.name === 'string' ? this.name : '';
        this.source = Object.values(ThemeSource).includes(this.source) ? this.source : ThemeSource.LOCAL;
        this.status = Object.values(ThemeStatus).includes(this.status) ? this.status : ThemeStatus.AVAILABLE;
    }

    isNetwork() {
        return this.source === ThemeSource.NETWORK;
    }

    parseDuration(value) {
        const num = Number(value);
        return (Number.isFinite(num) && num >= 0) ? num : null;
    }
}
