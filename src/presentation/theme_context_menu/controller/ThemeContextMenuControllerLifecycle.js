import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
export function applyThemeContextMenuControllerLifecycle(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerLifecycle.prototype);
}

class ThemeContextMenuControllerLifecycle {
    setView(view) {
        this.view = view;
    }

    resetState() {
        this.view = null;
        this.currentMenuData = null;
        this.currentWidget = null;
        this.container = null;
        this.logger = null;
    }

    destroy() {
        this.view?.destroy?.();
        this.resetState();
    }
}
