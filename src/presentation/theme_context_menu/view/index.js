import { applyThemeContextMenuViewPopup } from './ThemeContextMenuViewPopup.js';
import { applyThemeContextMenuViewMetadata } from './ThemeContextMenuViewMetadata.js';
import { applyThemeContextMenuViewPackages } from './ThemeContextMenuViewPackages.js';
import { applyThemeContextMenuViewActionsAvatars } from './actions/ThemeContextMenuViewActionsAvatars.js';
import { applyThemeContextMenuViewActionsStatsActions } from './actions/ThemeContextMenuViewActionsStatsActions.js';
import { applyThemeContextMenuViewActionsStatsCards } from './actions/ThemeContextMenuViewActionsStatsCards.js';
import { applyThemeContextMenuViewActionsStatsData } from './actions/ThemeContextMenuViewActionsStatsData.js';
import { applyThemeContextMenuViewActionsStatsMisc } from './actions/ThemeContextMenuViewActionsStatsMisc.js';

export const THEME_CONTEXT_MENU_VIEW_MIXINS = [
    applyThemeContextMenuViewPopup,
    applyThemeContextMenuViewMetadata,
    applyThemeContextMenuViewPackages,
    applyThemeContextMenuViewActionsStatsCards,
    applyThemeContextMenuViewActionsStatsData,
    applyThemeContextMenuViewActionsStatsActions,
    applyThemeContextMenuViewActionsStatsMisc,
    applyThemeContextMenuViewActionsAvatars
];
