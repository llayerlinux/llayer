import { applyHotkeyServiceOverridesApply } from './HotkeyServiceOverridesApply.js';
import { applyHotkeyServiceOverridesMerge } from './HotkeyServiceOverridesMerge.js';
import { applyHotkeyServiceOverridesScripts } from './HotkeyServiceOverridesScripts.js';
import { applyHotkeyServiceOverridesStorage } from './HotkeyServiceOverridesStorage.js';
import { applyHotkeyServiceOverridesValidation } from './HotkeyServiceOverridesValidation.js';

export function applyHotkeyServiceOverrides(prototype) {
    [
        applyHotkeyServiceOverridesStorage,
        applyHotkeyServiceOverridesMerge,
        applyHotkeyServiceOverridesScripts,
        applyHotkeyServiceOverridesApply,
        applyHotkeyServiceOverridesValidation
    ].forEach((applyMixin) => applyMixin(prototype));
}
