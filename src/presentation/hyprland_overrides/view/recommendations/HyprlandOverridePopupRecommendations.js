import { applyHyprlandRecommendationsRules } from './HyprlandRecommendationsRules.js';
import { applyHyprlandRecommendationsRuleOps } from './HyprlandRecommendationsRuleOps.js';
import { applyHyprlandRecommendationsState } from './HyprlandRecommendationsState.js';
import { applyHyprlandRecommendationsStatus } from './HyprlandRecommendationsStatus.js';
import { applyHyprlandOverridePopupRecommendationsData } from './HyprlandOverridePopupRecommendationsData.js';
import { applyHyprlandOverridePopupRecommendationsOps } from './HyprlandOverridePopupRecommendationsOps.js';
import { applyHyprlandOverridePopupRecommendationsUI } from './HyprlandOverridePopupRecommendationsUI.js';

export function applyHyprlandOverridePopupRecommendations(prototype) {
    applyHyprlandRecommendationsRules(prototype);
    applyHyprlandRecommendationsState(prototype);
    applyHyprlandRecommendationsRuleOps(prototype);
    applyHyprlandRecommendationsStatus(prototype);
    applyHyprlandOverridePopupRecommendationsData(prototype);
    applyHyprlandOverridePopupRecommendationsOps(prototype);
    applyHyprlandOverridePopupRecommendationsUI(prototype);
}
