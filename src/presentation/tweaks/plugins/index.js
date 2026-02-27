import { TweaksPluginsHyprpm } from './TweaksPluginsHyprpm.js';
import { TweaksPluginsI18n } from './TweaksPluginsI18n.js';
import { TweaksPluginsStorage } from './TweaksPluginsStorage.js';
import { TweaksPluginsTabCore } from './TweaksPluginsTabCore.js';
import { TweaksPluginsTabPluginsList } from './TweaksPluginsTabPluginsList.js';
import { TweaksPluginsTabRepositories } from './TweaksPluginsTabRepositories.js';
import { TweaksPluginsTabTerminal } from './TweaksPluginsTabTerminal.js';
import { TweaksPluginsTabView } from './TweaksPluginsTabView.js';
import { TweaksPluginsUIDialogs } from './TweaksPluginsUIDialogs.js';
import { TweaksPluginsUIBase } from './TweaksPluginsUIBase.js';
import { TweaksPluginsUIParams } from './TweaksPluginsUIParams.js';
import { TweaksPluginsUIPluginList } from './TweaksPluginsUIPluginList.js';
import { TweaksPluginsUIRepository } from './TweaksPluginsUIRepository.js';
import { TweaksPluginsWidgets } from './TweaksPluginsWidgets.js';

export const TWEAKS_PLUGINS_TAB_MODULES = [
    TweaksPluginsTabCore,
    TweaksPluginsTabTerminal,
    TweaksPluginsTabRepositories,
    TweaksPluginsTabPluginsList,
    TweaksPluginsTabView
];

export const TWEAKS_PLUGINS_UI_MODULES = [
    TweaksPluginsUIBase,
    TweaksPluginsUIRepository,
    TweaksPluginsUIPluginList,
    TweaksPluginsUIParams
];

export const TWEAKS_PLUGINS_MODULES = [
    TweaksPluginsI18n,
    Object.assign({}, ...TWEAKS_PLUGINS_TAB_MODULES),
    TweaksPluginsHyprpm,
    TweaksPluginsStorage,
    TweaksPluginsWidgets,
    Object.assign({}, ...TWEAKS_PLUGINS_UI_MODULES),
    TweaksPluginsUIDialogs
];

export const TWEAKS_PLUGINS = Object.assign({}, ...TWEAKS_PLUGINS_MODULES);

