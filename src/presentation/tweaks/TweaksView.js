import {applyTweaksViewCore} from './view/TweaksViewCore.js';
import {applyTweaksViewLifecycle} from './view/TweaksViewLifecycle.js';
import {applyTweaksViewExec} from './view/TweaksViewExec.js';
import {applyTweaksViewWidgets} from './view/TweaksViewWidgets.js';
import {applyTweaksViewUIControls} from './view/TweaksViewUIControls.js';
import {applyTweaksViewUIBasic} from './view/TweaksViewUIBasic.js';
import {applyTweaksViewUIAdvanced} from './view/TweaksViewUIAdvanced.js';
import {applyTweaksViewApply} from './view/TweaksViewApply.js';
import {applyTweaksPlugins} from './TweaksPlugins.js';
import {PLUGIN_PARAMETERS} from './PluginParametersConfig.js';

export class TweaksView {
    constructor(container, controller) {
        this.container = container;
        this.controller = controller;
        this.store = container.get('tweaksStore');
        this.bus = container.get('eventBus');
        this.translator = container.has('translator') ? container.get('translator') : null;

        this.tweaksBoxGlobal = null;
        this.tweaksNotebookGlobal = null;
        this.basicOuterGlobal = null;
        this.advancedOuterGlobal = null;
        this.currentTweaks = {};
        this.tweaksLocked = false;
        this.tweaksEventHandlers = [];
        this.tweaksVersionLabel = null;

        this.roundingLabel = null;
        this.roundingScale = null;
        this.roundingEntry = null;
        this.blurLabel = null;
        this.blurScale = null;
        this.blurEntry = null;
        this.gapsInLabel = null;
        this.gapsInScale = null;
        this.gapsInEntry = null;
        this.gapsOutLabel = null;
        this.gapsOutScale = null;
        this.gapsOutEntry = null;
        this.blurPassesLabel = null;
        this.blurPassesScale = null;
        this.blurPassesEntry = null;
        this.blurOptimCheck = null;
        this.animationsLabel = null;
        this.animationsSwitch = null;

        this.dimInactiveLabel = null;
        this.dimInactiveSwitch = null;
        this.activeOpacityLabel = null;
        this.activeOpacityScale = null;
        this.activeOpacityEntry = null;
        this.inactiveOpacityLabel = null;
        this.inactiveOpacityScale = null;
        this.inactiveOpacityEntry = null;
        this.fullscreenOpacityLabel = null;
        this.fullscreenOpacityScale = null;
        this.fullscreenOpacityEntry = null;
        this.dimStrengthLabel = null;
        this.dimStrengthScale = null;
        this.dimStrengthEntry = null;
        this.mouseSensitivityLabel = null;
        this.mouseSensitivityScale = null;
        this.mouseSensitivityEntry = null;
        this.scrollFactorLabel = null;
        this.scrollFactorScale = null;
        this.scrollFactorEntry = null;
        this.followMouseCheck = null;
        this.forceNoAccelCheck = null;
        this.naturalScrollCheck = null;
        this.tilingModeLabel = null;
        this.tilingModeCombo = null;

        this.lastTweaksApplyTime = 0;
        this.TWEAKS_DEBOUNCE_DELAY = 100;
        this.applyTweaksIdleId = 0;

        this.tabState = 'tweaks';

        this.pluginsOuterGlobal = null;
        this.pluginParameters = {};
        this.customPluginParameters = {};

        this.PLUGIN_PARAMETERS = container?.has?.('pluginParameters')
            ? container.get('pluginParameters')
            : PLUGIN_PARAMETERS;

        this.loadPluginParametersFromFile();
        this.loadCustomPluginParameters();

        this.initRepositoriesData();
    }
}

const TWEAKS_VIEW_MIXINS = [
    applyTweaksViewCore,
    applyTweaksViewLifecycle,
    applyTweaksViewExec,
    applyTweaksViewWidgets,
    applyTweaksViewUIControls,
    applyTweaksViewUIBasic,
    applyTweaksViewUIAdvanced,
    applyTweaksViewApply,
    applyTweaksPlugins
];

TWEAKS_VIEW_MIXINS.forEach((applyMixin) => applyMixin(TweaksView.prototype));
