import { applyOverrideTabBuild } from './override/OverrideTabBuild.js';
import { applyOverrideTabParameters } from './override/OverrideTabParameters.js';
import { applyOverrideTabExceptions } from './override/OverrideTabExceptions.js';
import { applyOverrideTabSystemDetect } from './override/OverrideTabSystemDetect.js';
import { applyOverrideTabWidgets } from './override/OverrideTabWidgets.js';
import { applyOverrideTabLegacy } from './override/OverrideTabLegacy.js';
import { applyOverrideTabHotkeys } from './override/OverrideTabHotkeys.js';

export class OverrideTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings || {};
        this.widgets = deps.widgets || {};
        this.styleSeparator = deps.styleSeparator || ((sep) => sep);

        this.parameterService = deps.parameterService || null;
        this.themeRepository = deps.themeRepository || null;
        this.settingsManager = deps.settingsManager || null;

        this.parentWindow = deps.parentWindow || null;

        this.onOverridesChanged = deps.onOverridesChanged || (() => {});

        this.parameterEntries = new Map();
        this.exceptionButtons = new Map();
        this.autoDetectLabels = new Map();
        this.autoDetectedParams = new Set();
        this.isScanning = false;
        this.currentOverrides = { ...(this.settings.hyprlandOverrides || {}) };
        this.realtimeApplyIdleId = 0;
        this.realtimeApplyQueue = new Map();
        this.realtimeApplyLast = 0;
        this.realtimeApplyDelayMs = 120;
        this.realtimeApplyOriginals = null;
        this.realtimeApplyThemeName = null;
    }
}

applyOverrideTabBuild(OverrideTab.prototype);
applyOverrideTabParameters(OverrideTab.prototype);
applyOverrideTabExceptions(OverrideTab.prototype);
applyOverrideTabSystemDetect(OverrideTab.prototype);
applyOverrideTabWidgets(OverrideTab.prototype);
applyOverrideTabLegacy(OverrideTab.prototype);
applyOverrideTabHotkeys(OverrideTab.prototype);
