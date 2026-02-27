import {applyDownloadRiceUseCaseCore} from './download/DownloadRiceUseCaseCore.js';
import {applyDownloadRiceUseCaseDownload} from './download/DownloadRiceUseCaseDownload.js';
import {applyDownloadRiceUseCaseFs} from './download/DownloadRiceUseCaseFs.js';
import {applyDownloadRiceUseCaseInstall} from './download/DownloadRiceUseCaseInstall.js';

export class DownloadRiceUseCase {
    constructor(networkThemeService, settingsService, soundService, logger, eventBus = null, applyThemeUseCase = null, themeRepository = null, diContainer = null) {
        this.networkThemeService = networkThemeService;
        this.settingsService = settingsService;
        this.soundService = soundService;
        this.logger = logger;
        this.eventBus = eventBus;
        this.applyThemeUseCase = applyThemeUseCase;
        this.themeRepository = themeRepository;
        this.diContainer = diContainer;
        this.initState();
    }

    initState() {
        this.activeDownloads = new Map();
    }
}

applyDownloadRiceUseCaseCore(DownloadRiceUseCase.prototype);
applyDownloadRiceUseCaseDownload(DownloadRiceUseCase.prototype);
applyDownloadRiceUseCaseFs(DownloadRiceUseCase.prototype);
applyDownloadRiceUseCaseInstall(DownloadRiceUseCase.prototype);
