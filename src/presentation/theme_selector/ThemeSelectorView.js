import {applyThemeSelectorViewCore} from './view/ThemeSelectorViewCore.js';
import {applyThemeSelectorViewLifecycle} from './view/ThemeSelectorViewLifecycle.js';
import {applyThemeSelectorViewStore} from './view/ThemeSelectorViewStore.js';
import {applyThemeSelectorViewWindow} from './view/ThemeSelectorViewWindow.js';
import {applyThemeSelectorViewCurrentState} from './view/ThemeSelectorViewCurrentState.js';
import {applyThemeSelectorViewWindowRestorePointsTreeCore} from './view/ThemeSelectorViewWindowRestorePointsTreeCore.js';
import {applyThemeSelectorViewWindowRestorePointsDetails} from './view/ThemeSelectorViewWindowRestorePointsDetails.js';
import {applyThemeSelectorViewWindowRestorePointsList} from './view/ThemeSelectorViewWindowRestorePointsList.js';
import {applyThemeSelectorViewWindowRestorePointsMenu} from './view/ThemeSelectorViewWindowRestorePointsMenu.js';
import {applyThemeSelectorLocalization} from './ThemeSelectorLocalization.js';
import {ViewTabName} from '../common/Constants.js';

export class ThemeSelectorView {
    constructor(controller, logger = null) {
        const safeController = controller && typeof controller === 'object' ? controller : {};
        const container = safeController.container && typeof safeController.container.get === 'function'
            ? safeController.container
            : null;
        Object.assign(this, {
            controller: safeController,
            store: safeController.store,
            logger,
            window: null,
            isVisible: false,
            container,
            eventBus: safeController.eventBus,
            subscriptions: [],
            needsStoreSubscription: true,
            themes: [],
            currentTab: ViewTabName.INSTALLED,
            aboutView: null,
            moreSectionsView: null,
            updateNotificationView: null,
            pendingThemes: null,
            lastRenderedLocalCount: null,
            activeDownloadStates: new Map(),
            currentSettings: {},
            serverAddressOverride: null,
            currentUploadDialog: null,
            currentStateDialog: null,
            networkProgressPulseId: 0,
            localizedElements: [],
            localizationHandlers: null,
            localizationRetryId: null,
            themeClickStates: new Map(),
            recentlyAddedRestorePointId: null,
            recentlyAddedRestorePointTimestamp: null,
            recentlyAddedRestorePointUntil: 0
        });
        this.DI = this.container;
        const hasTranslator = this.container
            && typeof this.container.has === 'function'
            && this.container.has('translator')
            && typeof this.container.get === 'function';
        this.t = hasTranslator ? this.container.get('translator') : null;
        this.initializeManagers();
        this.setupThemeStyleUpdates();
        this.initializeAdditionalComponents();
        this.setupLocalizationListeners();
    }
}

const THEME_SELECTOR_VIEW_MIXINS = [
    applyThemeSelectorViewCore,
    applyThemeSelectorViewStore,
    applyThemeSelectorViewWindow,
    applyThemeSelectorViewCurrentState,
    applyThemeSelectorViewWindowRestorePointsTreeCore,
    applyThemeSelectorViewWindowRestorePointsDetails,
    applyThemeSelectorViewWindowRestorePointsList,
    applyThemeSelectorViewWindowRestorePointsMenu,
    applyThemeSelectorViewLifecycle,
    applyThemeSelectorLocalization
];

THEME_SELECTOR_VIEW_MIXINS.forEach((applyMixin) => applyMixin(ThemeSelectorView.prototype));
