import { Events } from '../../app/eventBus.js';

export class ResetAppSettings {
    constructor(container) {
        this.repo = container.get('appSettingsRepository');
        this.bus = container.get('eventBus');
    }

    emitReset(settings) {
        this.bus.emit(Events.APPSETTINGS_RESET, settings);
    }

    async execute() {
        const settings = await this.repo.reset();
        this.emitReset(settings);
        return settings;
    }
}
