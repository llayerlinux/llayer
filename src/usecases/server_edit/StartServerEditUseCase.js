export class StartServerEditUseCase {
    constructor(
        serverEditAuthController,
        serverEditController,
        settingsService,
        logger,
        translator = null
    ) {
        this.serverEditAuthController = serverEditAuthController;
        this.serverEditController = serverEditController;
        this.settingsService = settingsService;
        this.logger = logger;
        this.translator = translator;
    }

    determineTranslator(settings) {
        return settings?.t ?? this.translator;
    }

    assignTranslator(settings, translator) {
        settings.t = translator;
        [this.serverEditAuthController, this.serverEditController]
            .forEach(controller => controller?.setTranslationFunction?.(translator));
    }

    execute(theme) {
        if (theme && this.serverEditAuthController && this.serverEditController) {
            const settings = this.loadSettings();
            const translator = this.determineTranslator(settings);
            this.assignTranslator(settings, translator);

            this.serverEditAuthController?.promptAuthorization?.(theme, settings, (error, credentials) => {
                error || this.serverEditController?.showEditDialog?.(theme, credentials.login, credentials.password, settings);
            });
        }
    }

    loadSettings() {
        this.settingsService?.loadSettings?.();
        return {...((this.settingsService?.getSettings?.() || this.settingsService?.settings) ?? {})};
    }

    destroy() {
        [this.serverEditAuthController, this.serverEditController].forEach(c => c?.destroy?.());
    }
}
