import { Events } from '../../app/eventBus.js';

export class AppSettingsStore {
    constructor(container) {
        this.container = container;

        const get = (key) => container.has?.(key) ? container.get(key) : null;
        this.settingsManager = get('settingsManager') || get('SettingsManager');
        this.AppSettings = get('AppSettings');
        this.state = {loading: false, settings: this.createAppSettingsObject(this.settingsManager?.getAll() ?? {}), dirty: false, error: null};

        const bus = get('eventBus'),
            onSettings = (payload, dirty, opts = {}) => {
                this.setState({settings: this.createAppSettingsObject(this.extractSettings(payload)) || (opts.fallback ? this.state.settings : undefined), dirty, ...opts});
            };

        bus?.on(Events.APPSETTINGS_LOADED, (payload) => onSettings(payload, false));
        bus?.on(Events.APPSETTINGS_RESET, (payload) => onSettings(payload, true));
        bus?.on(Events.APPSETTINGS_CHANGED, (payload) => onSettings(payload, true));
        bus?.on(Events.APPSETTINGS_COMMITTED, (payload) => onSettings(payload, false, {fallback: true, preserveError: true, loading: this.state.loading}));
    }

    setState({settings, dirty, loading = false, error = null, preserveError = false}) {
        const nextError = preserveError ? this.state.error : error;
        this.state = {loading, settings, dirty, error: nextError};
    }

    extractSettings(payload) {
        if (!payload || typeof payload !== 'object') return {};
        return (payload.settings && typeof payload.settings === 'object') ? payload.settings : payload;
    }

    createAppSettingsObject(data) {
        const obj = this.AppSettings ? new this.AppSettings({}) : {};
        data && typeof data === 'object' && Object.assign(obj, data);

        obj.withPatch = function (patch = {}) {
            const newObj = Object.create(Object.getPrototypeOf(this));
            Object.assign(newObj, this, patch);
            newObj.withPatch = this.withPatch;
            return newObj;
        };
        return obj;
    }

    patch(patch) {
        this.settingsManager?.update(patch);
        const newSettings = this.state.settings.withPatch(patch);
        this.state = {...this.state, settings: newSettings, dirty: true};
        return newSettings;
    }

    get snapshot() {
        return this.state;
    }
}
