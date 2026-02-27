import { applyThemeAppsSectionActions } from './ThemeAppsSectionActions.js';
import { applyThemeAppsSectionData } from './ThemeAppsSectionData.js';
import { applyThemeAppsSectionList } from './ThemeAppsSectionList.js';
import { applyThemeAppsSectionUI } from './ThemeAppsSectionUI.js';

export class ThemeAppsSection {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings ?? {};
        this.widgets = deps.widgets ?? {};
        this.themeRepository = deps.themeRepository;
        this.onIsolationModesChanged = deps.onIsolationModesChanged;
        this.onSkipListChanged = deps.onSkipListChanged;

        this.listBox = null;
        this.stack = null;
        this.loadingLabel = null;
        this.scrolled = null;
        this.checkboxes = {};
        this.isolationCombos = {};
        this.savedIsolationModes = {};

        this.loaded = false;
        this.populating = false;
        this.updatingFromGlobal = false;
    }
}

[
    applyThemeAppsSectionUI,
    applyThemeAppsSectionData,
    applyThemeAppsSectionList,
    applyThemeAppsSectionActions
].forEach((applyMixin) => applyMixin(ThemeAppsSection.prototype));
