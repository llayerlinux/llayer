import { Events } from '../../../app/eventBus.js';

const EVENT_HANDLER_MAP = [
    [Events.THEMES_LOCAL_CHANGED, 'onLocalThemesChanged'],
    [Events.THEMES_NETWORK_CHANGED, 'onNetworkThemesChanged'],
    [Events.THEMES_LOADING_STATE, 'onLoadingStateChanged'],
    [Events.THEME_APPLIED, 'onThemeApplied'],
    [Events.THEME_DELETED, 'onThemeDeleted'],
    [Events.UI_REFRESH_REQUESTED, 'onRefreshRequested']
];

const STORE_CHANGE_MAP = [
    ['localThemes', 'onLocalThemesChanged'],
    ['networkThemes', 'onNetworkThemesChanged'],
    ['localLoadingState', 'onLocalLoadingStateChanged'],
    ['networkLoadingState', 'onNetworkLoadingStateChanged'],
    ['currentTheme', 'onCurrentThemeChanged'],
    ['selectedTheme', 'onSelectedThemeChanged'],
    ['activeTab', 'onActiveTabChanged'],
    ['settings', 'onSettingsChanged', true]
];

export class ThemeSelectorEvents {
    constructor(deps) {
        const safeDeps = deps && typeof deps === 'object' ? deps : {};
        this.eventBus = safeDeps.eventBus ?? null;
        this.store = safeDeps.store ?? null;
        this.handlers = safeDeps.handlers ?? {};
        this.subscriptions = [];
        this.storeUnsubscribe = null;
    }

    subscribe() {
        this.subscribeToEventBus();
        this.subscribeToStore();
    }

    subscribeToEventBus() {
        const bus = this.eventBus;
        (bus && typeof bus.on === 'function') && (() => {
            for (const [event, handlerKey] of EVENT_HANDLER_MAP) {
                const handler = this.handlers[handlerKey];
                handler && this.subscriptions.push({event, id: bus.on(event, handler)});
            }
        })();
    }

    subscribeToStore() {
        this.storeUnsubscribe = this.store.subscribe((state, prevState) => this.handleStoreChange(state, prevState));
    }

    invokeHandler(handlerKey, ...args) {
        const handler = this.handlers[handlerKey];
        typeof handler === 'function' && handler(...args);
    }

    handleStoreChange(state, prevState) {
        STORE_CHANGE_MAP.forEach(([field, handler, includePrev]) => {
            state[field] !== prevState[field] && (
                includePrev
                    ? this.invokeHandler(handler, state[field], prevState[field])
                    : this.invokeHandler(handler, state[field])
            );
        });
    }

    emit(event, data) {
        this.eventBus && typeof this.eventBus.emit === 'function' && this.eventBus.emit(event, data);
    }

    unsubscribe() {
        this.eventBus?.off && this.subscriptions.forEach(({event, id}) => this.eventBus.off(event, id));
        this.subscriptions = [];
        this.storeUnsubscribe && (this.storeUnsubscribe(), this.storeUnsubscribe = null);
    }

    updateHandlers(newHandlers) {
        this.handlers = {...this.handlers, ...newHandlers};
    }

    isSubscribed() {
        return this.subscriptions.length > 0 || this.storeUnsubscribe !== null;
    }

    destroy() {
        this.unsubscribe();
        this.eventBus = null;
        this.store = null;
        this.handlers = {};
    }
}
