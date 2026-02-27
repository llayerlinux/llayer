import { applyHyprlandParamPredicates } from '../../../common/HyprlandParamPredicates.js';
import { getHyprlandSliderRange } from '../../../common/HyprlandParamUiShared.js';

export function applyHyprlandOverridePopupRowsParams(prototype) {
    applyHyprlandParamPredicates(prototype);

    prototype.getSliderRange = function(param) {
        return getHyprlandSliderRange(param);
    };
}
