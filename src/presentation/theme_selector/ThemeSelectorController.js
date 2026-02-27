import {TimerManager} from './controller/TimerManager.js';
import {applyThemeSelectorControllerCore} from './controller/ThemeSelectorControllerCore.js';
import {applyThemeSelectorControllerSettingsRefresh} from './controller/ThemeSelectorControllerSettingsRefresh.js';
import {applyThemeSelectorControllerLoading} from './controller/ThemeSelectorControllerLoading.js';
import {applyThemeSelectorControllerNetwork} from './controller/ThemeSelectorControllerNetwork.js';
import {applyThemeSelectorControllerNavigation} from './controller/ThemeSelectorControllerNavigation.js';
import {applyThemeSelectorControllerOpsApply} from './controller/ops/ThemeSelectorControllerOpsApply.js';
import {applyThemeSelectorControllerOpsNotifications} from './controller/ops/ThemeSelectorControllerOpsNotifications.js';
import {applyThemeSelectorControllerOpsLifecycle} from './controller/ops/ThemeSelectorControllerOpsLifecycle.js';
import {applyThemeSelectorControllerOpsLocalThemes} from './controller/ops/ThemeSelectorControllerOpsLocalThemes.js';
import {applyThemeSelectorControllerOpsDownloads} from './controller/ops/ThemeSelectorControllerOpsDownloads.js';
import {applyThemeSelectorControllerOpsI18n} from './controller/ops/ThemeSelectorControllerOpsI18n.js';
import {applyThemeSelectorControllerOpsRestorePoints} from './controller/ops/ThemeSelectorControllerOpsRestorePoints.js';
import { DEFAULT_NETWORK_PAGINATION } from './ThemeSelectorContracts.js';

export class ThemeSelectorController {
    constructor(store, dependencies = {}) {
        this.store = store;
        this.themeRepository = dependencies.themeRepository || null;
        this.applyThemeUseCase = dependencies.applyThemeUseCase || null;
        this.installThemeUseCase = dependencies.installThemeUseCase || null;
        this.checkForUpdatesUseCase = dependencies.checkForUpdatesUseCase || null;
        this.downloadRiceUseCase = dependencies.downloadRiceUseCase || null;
        this.loadNetworkThemesUseCase = dependencies.loadNetworkThemesUseCase || null;
        this.loadAppSettingsUseCase = dependencies.loadAppSettingsUseCase || null;
        this.networkThemeService = dependencies.networkThemeService || null;
        this.logger = dependencies.logger || null;
        this.eventBus = dependencies.eventBus || null;
        this.notifier = dependencies.notifier || null;
        this.settingsService = dependencies.settingsService || null;
        this.appSettingsService = dependencies.appSettingsService || null;
        this.soundService = dependencies.soundService || null;
        this.uploadThemeUseCase = dependencies.uploadThemeUseCase || null;
        this.container = dependencies.container || null;

        const translator = dependencies.translator || this.getTranslator(dependencies.container);
        this.translator = translator || ((key) => key);

        this.timers = new TimerManager();

        this.eventBusSubscribed = false;
        this.pendingSettingsRefresh = null;
        this.settingsRefreshOverride = null;
        this.lastKnownSettings = {};
        this.uploadInFlight = false;
        this.isLoadingNetworkThemes = false;
        this.view = null;
        this.isInitialized = false;

        const networkSettings = this.settingsService && typeof this.settingsService.getNetworkThemeSettings === 'function'
            ? this.settingsService.getNetworkThemeSettings()
            : {};
        const defaultPageSize = Number(networkSettings.pageSize) > 0 ? Number(networkSettings.pageSize) : 20;
        this.networkPagination = {
            ...DEFAULT_NETWORK_PAGINATION,
            pageSize: defaultPageSize
        };

        this.subscriptions = [];
        this.recentlyCompletedInstalls = new Map();
        this.activeProcesses = new Map();
        this.downloading = new Map();
        this.downloadLocalNameMap = new Map();
        this.autoApplyingThemes = new Set();
        this.pendingAutoApplyThemes = new Set();

        this.localStatsRefreshPromise = null;
        this.lastLocalStatsRefresh = 0;
        this.localStatsRefreshCooldownMs = 60000;

        this.eventBusListeners = [];
        this.trySubscribeToEventBus();
    }
}

const THEME_SELECTOR_CONTROLLER_MIXINS = [
    applyThemeSelectorControllerCore,
    applyThemeSelectorControllerSettingsRefresh,
    applyThemeSelectorControllerLoading,
    applyThemeSelectorControllerNetwork,
    applyThemeSelectorControllerNavigation,
    applyThemeSelectorControllerOpsApply,
    applyThemeSelectorControllerOpsNotifications,
    applyThemeSelectorControllerOpsLifecycle,
    applyThemeSelectorControllerOpsLocalThemes,
    applyThemeSelectorControllerOpsDownloads,
    applyThemeSelectorControllerOpsI18n,
    applyThemeSelectorControllerOpsRestorePoints
];

THEME_SELECTOR_CONTROLLER_MIXINS.forEach((applyMixin) => applyMixin(ThemeSelectorController.prototype));
