import { Events } from '../../app/eventBus.js';

export class StoreAppSettings {
    constructor(container) {
        this.repo = container.get('appSettingsRepository');
        this.bus = container.get('eventBus');
    }

    buildDiff(settings, baseline, override) {
        return {
            immediate: true,
            languageChanged: override?.languageChanged ?? (settings.language !== baseline.language),
            themeChanged: override?.themeChanged
                ?? (settings.theme !== baseline.theme || settings.gtkTheme !== baseline.gtkTheme)
        };
    }

    async execute(settings, context = {}) {
        const baseline = context.baseline || settings;
        const override = context.diffOverride;

        await this.repo.write(settings);

        const payload = {
            settings,
            diff: this.buildDiff(settings, baseline, override)
        };

        this.bus.emit(Events.APPSETTINGS_COMMITTED, payload);

        return payload;
    }
}
