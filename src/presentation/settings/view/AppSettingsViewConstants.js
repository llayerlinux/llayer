export class EventBindingsStub {
    constructor() {
        this.listenerIds = [];
    }

    on() {
        return null;
    }

    off() {
        return false;
    }

    cleanup() {
        this.listenerIds = [];
    }

    get count() {
        return 0;
    }
}

const makeKeys = (...keys) => keys;

export const TAB_CLASS_KEYS = makeKeys('SettingsTab', 'AdvancedTab', 'HyprlandTab', 'StartPointTab', 'HelpTab', 'AboutTab');
export const SECTION_CLASS_KEYS = makeKeys('ThemeAppsSection', 'SecuritySection');
export const CORE_DEP_KEYS = makeKeys('mainWindow', 'BarRegistry', 'makeRoundedPixbuf', 'loadStartupData', 'playSound');
export const WINDOW_HINT_METHODS = makeKeys('set_keep_above', 'set_skip_taskbar_hint', 'set_skip_pager_hint');
export const COMBO_WIDGET_KEYS = makeKeys('langCombo', 'gtkThemeCombo', 'animTypeCombo', 'altBarCombo', 'defaultBarCombo');
