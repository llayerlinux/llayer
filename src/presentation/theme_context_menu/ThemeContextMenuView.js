import GLib from 'gi://GLib';
import { THEME_CONTEXT_MENU_VIEW_MIXINS } from './view/index.js';

export class ThemeContextMenuView {
    constructor(controller, logger = null, translations = null) {
        this.controller = controller;
        this.logger = logger;
        const container = controller && typeof controller === 'object' ? controller.container : null;
        const canReadCurrentDir = container && typeof container.get === 'function'
            && (typeof container.has !== 'function' || container.has('currentDir'));
        const currentDir = canReadCurrentDir ? container.get('currentDir') : null;
        this.currentDir = (typeof currentDir === 'string' && currentDir.trim().length > 0)
            ? currentDir
            : GLib.get_current_dir();

        this.popup = null;
        this.menuData = null;
        this.isVisible = false;
        this.avatarCache = new Map();
        this.isMenuOpened = false;
        this.statsLabels = null;
        this.viewToggleButton = null;
        this.networkDataAvailable = false;
        this.localThemeAvailable = false;

        this.t = typeof translations === 'function' ? translations : ((key) => key);
    }
}

THEME_CONTEXT_MENU_VIEW_MIXINS.forEach((applyMixin) => applyMixin(ThemeContextMenuView.prototype));
