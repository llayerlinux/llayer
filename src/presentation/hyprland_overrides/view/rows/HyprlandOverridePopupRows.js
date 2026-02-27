import { applyHyprlandOverridePopupRowsBuild } from './HyprlandOverridePopupRowsBuild.js';
import { applyHyprlandOverridePopupRowsColors } from './HyprlandOverridePopupRowsColors.js';
import { applyHyprlandOverridePopupRowsHandlers } from './HyprlandOverridePopupRowsHandlers.js';
import { applyHyprlandOverridePopupRowsParams } from './HyprlandOverridePopupRowsParams.js';
import { applyHyprlandOverridePopupRowsValues } from './HyprlandOverridePopupRowsValues.js';
import { applyHyprlandOverridePopupRowsVisualState } from './HyprlandOverridePopupRowsVisualState.js';

export function applyHyprlandOverridePopupRows(prototype) {
    [
        applyHyprlandOverridePopupRowsParams,
        applyHyprlandOverridePopupRowsColors,
        applyHyprlandOverridePopupRowsValues,
        applyHyprlandOverridePopupRowsVisualState,
        applyHyprlandOverridePopupRowsHandlers,
        applyHyprlandOverridePopupRowsBuild
    ].forEach((applyMixin) => applyMixin(prototype));
}
