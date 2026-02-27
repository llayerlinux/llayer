export class EventBusClass {
    constructor() {
        this.listeners = new Map();
        this.logger = null;
    }

    getEventListeners(eventName) {
        this.listeners.has(eventName) || this.listeners.set(eventName, new Map());
        return this.listeners.get(eventName);
    }

    createListenerId() {
        return Date.now() + Math.random();
    }

    setLogger(logger) {
        this.logger = logger;
        return this;
    }

    on(eventName, callback) {
        const listeners = this.getEventListeners(eventName);
        const listenerId = this.createListenerId();
        listeners.set(listenerId, callback);

        return listenerId;
    }

    off(eventName, listenerId) {
        const listeners = this.listeners.get(eventName);
        const removed = !!listeners?.delete(listenerId);
        removed && listeners.size === 0 && this.listeners.delete(eventName);
        return removed;
    }

    emit(eventName, data = null) {
        const listeners = this.listeners.get(eventName);
        listeners && [...listeners.values()].forEach((callback) => callback(data, eventName));
    }
}

export const Events = {
    APP_STARTED: 'app.started',

    THEME_APPLY_START: 'theme.apply.start',
    THEME_APPLY_SUCCESS: 'theme.apply.success',
    THEME_APPLY_ERROR: 'theme.apply.error',
    THEME_APPLY_COMPLETE: 'theme.apply.complete',
    THEME_SELECTED: 'theme.selected',
    THEME_UPDATED: 'theme-updated',

    THEME_DOWNLOAD_COMPLETE: 'theme.download.complete',
    THEME_DOWNLOAD_CANCELLED: 'theme.download.cancelled',
    THEME_REPOSITORY_UPDATED: 'theme.repository.updated',

    THEME_INSTALL_STOP: 'theme.install.stop',

    THEMES_LOCAL_UPDATED: 'themes.local.updated',
    THEMES_LOCAL_CHANGED: 'themes.local.changed',
    THEMES_NETWORK_CHANGED: 'themes.network.changed',
    THEMES_LOADING_STATE: 'themes.loading.state',

    UI_REFRESH_REQUESTED: 'ui.refresh.requested',

    THEME_UI_UPDATE_CURRENT: 'theme.ui.update_current',
    THEME_UI_REBUILD_GRID: 'theme.ui.rebuild_grid',

    APPSETTINGS_OPEN: 'appsettings:open',
    APPSETTINGS_LOADED: 'appsettings:loaded',
    APPSETTINGS_CHANGED: 'appsettings:changed',
    APPSETTINGS_COMMIT_REQUESTED: 'appsettings:commit:req',
    APPSETTINGS_COMMITTED: 'appsettings:committed',
    APPSETTINGS_RESET_REQUESTED: 'appsettings:reset:req',
    APPSETTINGS_RESET: 'appsettings:reset',
    APPSETTINGS_CLOSE_REQUESTED: 'appsettings:close:req',
    APPSETTINGS_RESTOREPOINT_DISPLAY: 'appsettings:restorepoint:display',
    APPSETTINGS_THEMEAPPS_REFRESH: 'appsettings:themeapps:refresh',

    HYPRLAND_GLOBAL_OVERRIDES_CHANGED: 'hyprland:global-overrides:changed',

    TWEAKS_OPEN: 'tweaks:open',
    TWEAKS_CLOSE: 'tweaks:close',
    TWEAKS_LOAD_REQUESTED: 'tweaks:load:req',
    TWEAKS_APPLY_REQUESTED: 'tweaks:apply:req',
    TWEAKS_RESET_REQUESTED: 'tweaks:reset:req',
    TWEAKS_LOCK_REQUESTED: 'tweaks:lock:req',
    TWEAKS_LOADING: 'tweaks:loading',
    TWEAKS_LOADED: 'tweaks:loaded',
    TWEAKS_LOAD_ERROR: 'tweaks:load-error',
    TWEAKS_CHANGED: 'tweaks:changed',
    TWEAKS_APPLIED: 'tweaks:applied',
    TWEAKS_APPLY_PARTIAL: 'tweaks:apply-partial',
    TWEAKS_LOCKED: 'tweaks:locked',
    TWEAKS_UNLOCKED: 'tweaks:unlocked',
    TWEAKS_TAB_CHANGED: 'tweaks:tab-changed',

    THEME_APPLIED: 'theme.applied',
    THEME_DELETED: 'theme.deleted'
};
