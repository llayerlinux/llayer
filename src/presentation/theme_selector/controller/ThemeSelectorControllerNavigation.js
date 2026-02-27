import { applyThemeSelectorControllerNavigationActions } from './ThemeSelectorControllerNavigationActions.js';
import { applyThemeSelectorControllerNavigationNotify } from './ThemeSelectorControllerNavigationNotify.js';
import { applyThemeSelectorControllerNavigationTabs } from './ThemeSelectorControllerNavigationTabs.js';
import { applyThemeSelectorControllerNavigationThemeItem } from './ThemeSelectorControllerNavigationThemeItem.js';
import { applyThemeSelectorControllerNavigationUpload } from './ThemeSelectorControllerNavigationUpload.js';

export function applyThemeSelectorControllerNavigation(prototype) {
    [
        applyThemeSelectorControllerNavigationNotify,
        applyThemeSelectorControllerNavigationTabs,
        applyThemeSelectorControllerNavigationActions,
        applyThemeSelectorControllerNavigationUpload,
        applyThemeSelectorControllerNavigationThemeItem
    ].forEach((applyMixin) => applyMixin(prototype));
}
