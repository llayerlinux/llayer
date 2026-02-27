import { AppSettings } from '../../domain/entities/AppSettings.js';
export class AppSettingsRepository {
    constructor(container) {
        this.container = container;
        this.AppSettings = AppSettings;
        this.manager = container.get('settingsManager');
    }

    getManager() {
        return this.manager;
    }

    sanitizeAppSettings(appSettings) {
        return Object.fromEntries(
            Object.entries(appSettings ?? {}).filter(([_key, value]) => typeof value !== 'function')
        );
    }

    createSettingsShell() {
        return Object.create(this.AppSettings?.prototype ?? {});
    }

    assignSettings(target, source) {
        if (!target || !source || typeof source !== 'object') {
            return target;
        }
        Object.keys(source).forEach((key) => {
            target[key] = source[key];
        });
        return target;
    }

    createAppSettingsObject(data) {
        const obj = this.createSettingsShell();
        this.assignSettings(obj, data);

        obj.withPatch = function (patch = {}) {
            const newObj = Object.create(Object.getPrototypeOf(this));
            Object.keys(this).forEach(key => {
                newObj[key] = this[key];
            });
            Object.keys(patch).forEach(key => {
                newObj[key] = patch[key];
            });
            newObj.withPatch = this.withPatch;
            return newObj;
        };

        return obj;
    }

    async load() {
        const manager = this.getManager();
        if (!manager) {
            return this.createAppSettingsObject({});
        }

        const settings = manager.getAll();
        return this.createAppSettingsObject(settings);
    }

    async write(appSettings) {
        const manager = this.getManager();
        const valid = manager && appSettings && typeof appSettings === 'object';
        if (!valid) {
            return false;
        }

        const toSave = this.sanitizeAppSettings(appSettings);

        manager.update(toSave);
        return manager.write(null, {silent: true});
    }

    async reset() {
        const manager = this.getManager();
        if (!manager) {
            return this.createAppSettingsObject({});
        }

        manager.reset();
        const defaults = manager.getDefaults();
        return this.createAppSettingsObject(defaults);
    }
}
