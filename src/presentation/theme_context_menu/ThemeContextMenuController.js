import {applyThemeContextMenuControllerActions} from './controller/ThemeContextMenuControllerActions.js';
import {applyThemeContextMenuControllerLifecycle} from './controller/ThemeContextMenuControllerLifecycle.js';
import {applyThemeContextMenuControllerMenu} from './controller/ThemeContextMenuControllerMenu.js';
import {applyThemeContextMenuControllerThemeMetadata} from './controller/ThemeContextMenuControllerThemeMetadata.js';
import {applyThemeContextMenuControllerNotifications} from './controller/ThemeContextMenuControllerNotifications.js';
import {applyThemeContextMenuControllerStats} from './controller/ThemeContextMenuControllerStats.js';
import {applyThemeContextMenuControllerThemeData} from './controller/ThemeContextMenuControllerThemeData.js';

function getContainerService(container, name) {
    const canUseContainer = container && typeof container.get === 'function';
    const hasService = (typeof container.has !== 'function') || container.has(name);
    return canUseContainer && hasService ? container.get(name) : null;
}

export class ThemeContextMenuController {
    constructor(container, logger = null) {
        this.container = container;
        this.logger = logger;
        this.applyThemeUseCase = getContainerService(container, 'applyThemeUseCase');
        this.notifier = getContainerService(container, 'notifier');
        this.soundService = getContainerService(container, 'soundService');
        this.themeRepository = getContainerService(container, 'themeRepository');
        this.themeSelectorStore = getContainerService(container, 'themeSelectorStore');
        this.settingsService = getContainerService(container, 'settingsService');
        this.translator = getContainerService(container, 'translator');

        this.view = null;
        this.currentMenuData = null;
        this.currentWidget = null;
        this.cachedNetworkTheme = null;
    }
}

const THEME_CONTEXT_MENU_CONTROLLER_MIXINS = [
    applyThemeContextMenuControllerLifecycle,
    applyThemeContextMenuControllerNotifications,
    applyThemeContextMenuControllerThemeMetadata,
    applyThemeContextMenuControllerThemeData,
    applyThemeContextMenuControllerMenu,
    applyThemeContextMenuControllerActions,
    applyThemeContextMenuControllerStats
];

THEME_CONTEXT_MENU_CONTROLLER_MIXINS.forEach((applyMixin) => applyMixin(ThemeContextMenuController.prototype));
