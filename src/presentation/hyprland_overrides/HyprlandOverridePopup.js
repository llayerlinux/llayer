import { applyHyprlandOverridePopupWindow } from './view/HyprlandOverridePopupWindow.js';
import { applyHyprlandOverridePopupRows } from './view/rows/HyprlandOverridePopupRows.js';
import { applyHyprlandOverridePopupActions } from './view/HyprlandOverridePopupActions.js';
import { applyHyprlandOverridePopupHotkeys } from './view/hotkeys/HyprlandOverridePopupHotkeys.js';
import { applyHyprlandOverridePopupRecommendations } from './view/recommendations/HyprlandOverridePopupRecommendations.js';

export class HyprlandOverridePopup {
    constructor(options = {}) {
        this.t = options.t || ((key) => key);
        this.parameterService = options.parameterService || null;
        this.hotkeyService = options.hotkeyService || null;
        this.themeRepository = options.themeRepository || null;
        this.settingsManager = options.settingsManager || null;
        this.eventBus = options.eventBus || null;
        this.logger = options.logger || null;

        this.popup = null;
        this.currentTheme = null;
        this.parameterEntries = new Map();
        this.originalValues = {};
        this.currentOverrides = {};
        this.globalOverrides = {};
        this.globalOverrideInitiators = {};
        this.globalHotkeyInitiators = {};
    }

    log(msg, ...args) {
        this.logger?.info?.(`[HyprlandOverridePopup] ${msg}`, ...args);
    }
}

const HYPRLAND_OVERRIDE_POPUP_MIXINS = [
    applyHyprlandOverridePopupWindow,
    applyHyprlandOverridePopupRows,
    applyHyprlandOverridePopupActions,
    applyHyprlandOverridePopupHotkeys,
    applyHyprlandOverridePopupRecommendations
];

HYPRLAND_OVERRIDE_POPUP_MIXINS.forEach((applyMixin) => applyMixin(HyprlandOverridePopup.prototype));
