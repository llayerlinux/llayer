import { applyUploadThemeUseCaseConfig } from './UploadThemeUseCaseConfig.js';
import { applyUploadThemeUseCaseFiles } from './UploadThemeUseCaseFiles.js';
import { applyUploadThemeUseCaseUpload } from './UploadThemeUseCaseUpload.js';
import { applyUploadThemeUseCaseUtils } from './UploadThemeUseCaseUtils.js';

export class UploadThemeUseCase {
    constructor(settingsService, logger = null, notifier = null, translator = null) {
        this.settingsService = settingsService;
        this.logger = logger;
        this.notifier = notifier;
        this.translator = typeof translator === 'function' ? translator : (k) => k;
        this.soupVersion = undefined;
    }
}

[
    applyUploadThemeUseCaseUtils,
    applyUploadThemeUseCaseConfig,
    applyUploadThemeUseCaseFiles,
    applyUploadThemeUseCaseUpload
].forEach((applyMixin) => applyMixin(UploadThemeUseCase.prototype));
