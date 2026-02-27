import { BarRegistry } from '../../infrastructure/bars/BarRegistry.js';
import { Events } from '../../app/eventBus.js';

export class LoadAppSettings {
    constructor(container) {
        this.repo = container.get('appSettingsRepository');
        this.bus = container.get('eventBus');
    }

    applyCustomBars(settings) {
        settings?.customBars && BarRegistry.setCustomBars(settings.customBars);
    }

    async execute() {
        const settings = await this.repo.load();

        this.applyCustomBars(settings);

        this.bus.emit(Events.APPSETTINGS_LOADED, settings);
        return settings;
    }
}
