import { applyHyprlandTabBuildCore } from './HyprlandTabBuildCore.js';
import { applyHyprlandTabBuildParameters } from './HyprlandTabBuildParameters.js';
import { applyHyprlandTabBuildUtils } from './HyprlandTabBuildUtils.js';
import { applyHyprlandTabHotkeysDialogsAdd } from './HyprlandTabHotkeysDialogsAdd.js';
import { applyHyprlandTabHotkeysDialogsEdit } from './HyprlandTabHotkeysDialogsEdit.js';
import { applyHyprlandTabHotkeysDialogsHelp } from './HyprlandTabHotkeysDialogsHelp.js';
import { applyHyprlandTabHotkeysDialogsMain } from './HyprlandTabHotkeysDialogsMain.js';
import { applyHyprlandTabHotkeysHelpers } from './HyprlandTabHotkeysHelpers.js';
import { applyHyprlandTabHotkeysList } from './HyprlandTabHotkeysList.js';
import { applyHyprlandTabParameters } from './HyprlandTabParameters.js';
import { applyHyprlandTabSystemDetect } from './HyprlandTabSystemDetect.js';

export const HYPRLAND_TAB_MIXINS = [
    applyHyprlandTabBuildUtils,
    applyHyprlandTabBuildCore,
    applyHyprlandTabBuildParameters,
    applyHyprlandTabParameters,
    applyHyprlandTabSystemDetect,
    applyHyprlandTabHotkeysHelpers,
    applyHyprlandTabHotkeysList,
    applyHyprlandTabHotkeysDialogsMain,
    applyHyprlandTabHotkeysDialogsAdd,
    applyHyprlandTabHotkeysDialogsEdit,
    applyHyprlandTabHotkeysDialogsHelp
];

