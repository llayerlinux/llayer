import { HYPRLAND_TAB_MIXINS } from './hyprland/index.js';

export class HyprlandTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings ?? {};
        this.widgets = deps.widgets ?? {};
        this.styleSeparator = deps.styleSeparator || ((sep) => sep);

        this.parameterService = deps.parameterService || null;
        this.hotkeyService = deps.hotkeyService || null;
        this.themeRepository = deps.themeRepository || null;
        this.settingsManager = deps.settingsManager || null;
        this.logger = deps.logger || null;
        this.eventBus = deps.eventBus || null;

        this.parentWindow = deps.parentWindow || null;

        this.onOverridesChanged = deps.onOverridesChanged || (() => {});

        this.parameterEntries = new Map();
        this.autoDetectLabels = new Map();
        this.autoDetectedParams = new Set();
        this.isScanning = false;
        const globalHyprland = this.settingsManager?.readGlobalHyprland?.() ?? {};
        const globalHotkeys = this.settingsManager?.readGlobalHotkeys?.() ?? {};
        const legacyHyprland = (this.settingsManager?.get?.('hyprlandOverrides') || this.settings.hyprlandOverrides) ?? {};
        const legacyHotkeys = (this.settingsManager?.get?.('hotkeyOverrides') || this.settings.hotkeyOverrides) ?? {};
        this.currentOverrides = Object.keys(globalHyprland).length > 0 ? { ...globalHyprland } : { ...legacyHyprland };
        this.currentHotkeyOverrides = Object.keys(globalHotkeys).length > 0 ? { ...globalHotkeys } : { ...legacyHotkeys };
        this.realtimeApplyIdleId = 0;
        this.realtimeApplyQueue = new Map();
        this.realtimeApplyLast = 0;
        this.realtimeApplyDelayMs = 120;
        this.realtimeApplyOriginals = null;
        this.realtimeApplyThemeName = null;
    }
}

HYPRLAND_TAB_MIXINS.forEach((applyMixin) => applyMixin(HyprlandTab.prototype));
