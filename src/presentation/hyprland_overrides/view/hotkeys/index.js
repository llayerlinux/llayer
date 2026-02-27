import { applyHotkeyDuplicateSupport } from './HotkeyDuplicateSupport.js';
import { applyHotkeyMainModSupport } from './HotkeyMainModSupport.js';
import { applyHotkeyMultiActionSupport } from './HotkeyMultiActionSupport.js';
import { applyHyprlandOverridePopupHotkeysActions } from './HyprlandOverridePopupHotkeysActions.js';
import { applyHyprlandOverridePopupHotkeysCore } from './HyprlandOverridePopupHotkeysCore.js';
import { applyHyprlandOverridePopupHotkeysDialogsAdd } from './HyprlandOverridePopupHotkeysDialogsAdd.js';
import { applyHyprlandOverridePopupHotkeysDialogsHelp } from './HyprlandOverridePopupHotkeysDialogsHelp.js';
import { applyHyprlandOverridePopupHotkeysDialogsSave } from './HyprlandOverridePopupHotkeysDialogsSave.js';
import { applyHyprlandOverridePopupHotkeysFormat } from './HyprlandOverridePopupHotkeysFormat.js';
import { applyHyprlandOverridePopupHotkeysLoad } from './HyprlandOverridePopupHotkeysLoad.js';
import { applyHyprlandOverridePopupHotkeysMenuDetect } from './HyprlandOverridePopupHotkeysMenuDetect.js';
import { applyHyprlandOverridePopupHotkeysMenuKeyEntry } from './HyprlandOverridePopupHotkeysMenuKeyEntry.js';
import { applyHyprlandOverridePopupHotkeysMenuOverrides } from './HyprlandOverridePopupHotkeysMenuOverrides.js';
import { applyHyprlandOverridePopupHotkeysMenuUI } from './HyprlandOverridePopupHotkeysMenuUI.js';
import { applyHyprlandOverridePopupHotkeysSearch } from './HyprlandOverridePopupHotkeysSearch.js';
import { applyHyprlandOverridePopupHotkeysUIGroups } from './HyprlandOverridePopupHotkeysUIGroups.js';
import { applyHyprlandOverridePopupHotkeysUIRows } from './HyprlandOverridePopupHotkeysUIRows.js';
import { applyHyprlandOverridePopupHotkeysUITab } from './HyprlandOverridePopupHotkeysUITab.js';

export const HYPRLAND_OVERRIDE_POPUP_HOTKEYS_MIXINS = [
    applyHotkeyMultiActionSupport,
    applyHotkeyMainModSupport,
    applyHotkeyDuplicateSupport,
    applyHyprlandOverridePopupHotkeysCore,
    applyHyprlandOverridePopupHotkeysUITab,
    applyHyprlandOverridePopupHotkeysUIGroups,
    applyHyprlandOverridePopupHotkeysUIRows,
    applyHyprlandOverridePopupHotkeysSearch,
    applyHyprlandOverridePopupHotkeysLoad,
    applyHyprlandOverridePopupHotkeysFormat,
    applyHyprlandOverridePopupHotkeysMenuKeyEntry,
    applyHyprlandOverridePopupHotkeysMenuOverrides,
    applyHyprlandOverridePopupHotkeysMenuDetect,
    applyHyprlandOverridePopupHotkeysMenuUI,
    applyHyprlandOverridePopupHotkeysActions,
    applyHyprlandOverridePopupHotkeysDialogsAdd,
    applyHyprlandOverridePopupHotkeysDialogsSave,
    applyHyprlandOverridePopupHotkeysDialogsHelp
];

