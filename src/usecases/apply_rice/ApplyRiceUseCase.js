import Gtk from 'gi://Gtk?version=3.0';

Gtk.init(null);
import {Events} from '../../app/eventBus.js';
import {ApplyThemeResult} from './apply/ApplyThemeResult.js';
import {applyApplyThemeCore} from './apply/ApplyThemeCore.js';
import {applyApplyThemeExecution} from './apply/ApplyThemeExecution.js';
import {applyApplyThemeScripts} from './apply/ApplyThemeScripts.js';
import {applyApplyThemeSecurity} from './apply/ApplyThemeSecurity.js';

export {ApplyThemeResult};

export class ApplyTheme {
    constructor(themeRepository, commandExecutor, logger, eventBus, notifier = null, settingsService = null, themeInstallationService = null, soundService = null, diContainer = null) {
        this.themeRepository = themeRepository;
        this.commandExecutor = commandExecutor;
        this.themeInstallationService = themeInstallationService;
        this.logger = logger;
        this.eventBus = eventBus;
        this.notifier = notifier;
        this.settingsService = settingsService;
        this.soundService = soundService;
        this.diContainer = diContainer;
        this.performanceReporter = null;

        this.approvedScripts = new Map();
        this.bindEventHandlers();

        this.t = this.getTranslator();
    }

    bindEventHandlers() {
        this.eventBus?.on?.(Events.APPSETTINGS_COMMITTED, (payload) => {
            const hasSecurityChanges = payload?.settings?.dangerousPatterns || payload?.settings?.securityExceptions;
            hasSecurityChanges && this.approvedScripts.clear();
        });
    }
}

applyApplyThemeCore(ApplyTheme.prototype);
applyApplyThemeExecution(ApplyTheme.prototype);
applyApplyThemeScripts(ApplyTheme.prototype);
applyApplyThemeSecurity(ApplyTheme.prototype);
