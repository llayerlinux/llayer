export function applyThemeSelectorControllerNavigationActions(targetPrototype) {
    targetPrototype.applySelectedTheme = async function(options = {}) {
        const selectedTheme = this.store.get('selectedTheme');
        if (!selectedTheme) return {success: false, errors: [this.translate('THEME_NOT_SELECTED')]};

        let result = await this.applyThemeUseCase.execute(selectedTheme.name, options);
        if (result?.success) {
            this.store.updateTheme({...selectedTheme, status: 'active'});
            return result;
        }

        return result || {success: false, errors: ['applyFailed']};
    };

    targetPrototype.handleApplyTheme = async function(theme) {
        let result = await this.executeApplyTheme(theme.name);
        if (!result) return this.notifyInfo('THEME_APPLYING_TITLE', 'THEME_APPLYING_MESSAGE', {theme: theme.title || theme.name});

        result?.success === false && this.notifyError('THEME_APPLY_ERROR_TITLE',
            Array.isArray(result.errors) && result.errors.length ? result.errors.join('; ') : this.translate('UNKNOWN_ERROR'));
    };

    targetPrototype.handleDownloadTheme = async function(theme) {
        this.notifyInfo('THEME_DOWNLOAD_TITLE', 'THEME_DOWNLOAD_MESSAGE', {
            theme: theme.title || theme.name
        });
    };
}
