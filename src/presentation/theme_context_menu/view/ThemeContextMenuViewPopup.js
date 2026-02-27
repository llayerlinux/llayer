import { applyThemeContextMenuViewPopupCore } from './ThemeContextMenuViewPopupCore.js';
import { applyThemeContextMenuViewPopupHeader } from './ThemeContextMenuViewPopupHeader.js';
import { applyThemeContextMenuViewPopupPublicated } from './ThemeContextMenuViewPopupPublicated.js';
import { applyThemeContextMenuViewPopupRepository } from './ThemeContextMenuViewPopupRepository.js';
import { applyThemeContextMenuViewPopupWindow } from './ThemeContextMenuViewPopupWindow.js';

export function applyThemeContextMenuViewPopup(prototype) {
    [
        applyThemeContextMenuViewPopupCore,
        applyThemeContextMenuViewPopupWindow,
        applyThemeContextMenuViewPopupHeader,
        applyThemeContextMenuViewPopupRepository,
        applyThemeContextMenuViewPopupPublicated
    ].forEach((applyMixin) => applyMixin(prototype));
}
