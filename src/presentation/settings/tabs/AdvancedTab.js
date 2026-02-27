import {applyAdvancedTabBuild} from './advanced/AdvancedTabBuild.js';
import {applyAdvancedTabExecutionProperties} from './advanced/AdvancedTabExecutionProperties.js';
import {applyAdvancedTabDependencyIsolationUI} from './advanced/AdvancedTabDependencyIsolationUI.js';
import {applyAdvancedTabDependencyIsolationOps} from './advanced/AdvancedTabDependencyIsolationOps.js';
import {applyAdvancedTabBars} from './advanced/AdvancedTabBars.js';
import {applyAdvancedTabHelpers} from './advanced/AdvancedTabHelpers.js';

export class AdvancedTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings ?? {};
        this.widgets = deps.widgets ?? {};
        this.view = deps.view;
        this.dialog = deps.dialog;
        this.styleSeparator = deps.styleSeparator || ((sep) => sep);
        this.writeSettingsFile = deps.writeSettingsFile || (() => {});
        this.notify = deps.notify || (() => {
        });
        this.BarRegistry = deps.BarRegistry;
        this.themeAppsSection = deps.themeAppsSection;
        this.createBarEditorDialog = deps.createBarEditorDialog || null;

        this.defaultBarManualChanged = deps.defaultBarManualChanged || {value: false};
    }
}

const ADVANCED_TAB_MIXINS = [
    applyAdvancedTabBuild,
    applyAdvancedTabExecutionProperties,
    applyAdvancedTabDependencyIsolationUI,
    applyAdvancedTabDependencyIsolationOps,
    applyAdvancedTabBars,
    applyAdvancedTabHelpers
];

ADVANCED_TAB_MIXINS.forEach((applyMixin) => applyMixin(AdvancedTab.prototype));
