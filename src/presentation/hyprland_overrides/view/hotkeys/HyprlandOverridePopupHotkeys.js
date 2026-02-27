import { HYPRLAND_OVERRIDE_POPUP_HOTKEYS_MIXINS } from './index.js';

export function applyHyprlandOverridePopupHotkeys(prototype) {
    HYPRLAND_OVERRIDE_POPUP_HOTKEYS_MIXINS.forEach((applyMixin) => applyMixin(prototype));
}
