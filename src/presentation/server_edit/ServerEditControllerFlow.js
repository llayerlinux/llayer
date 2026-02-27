import { Events } from '../../app/eventBus.js';

export function applyServerEditControllerFlow(targetPrototype) {
    targetPrototype.setTranslationFunction = function(t) {
        this.t = t;
    };

    targetPrototype.getServerBaseUrl = function() {
        const serverUrlBase = this.trimString(this.settings?.serverAddress);
        return serverUrlBase ? serverUrlBase.replace(/\/$/, '') : null;
    };

    targetPrototype.showEditDialog = function(theme, login, password, settings) {
        this.theme = theme;
        this.login = login;
        this.password = password;
        this.settings = settings;

        this.subscribeToThemeSelected();

        this.editView.createDialog(theme, login, password, settings, this.t);
        this.editView.onCommitCallback((updateData) => {
            this.handleCommitCallback(updateData);
        });
        this.editView.onCloseCallback(() => {
            this.handleClose();
        });
        typeof this.editView.onDeleteCallback === 'function' && (
            this.editView.onDeleteCallback((passwordValue) => {
                this.handleDeleteCallback(passwordValue);
            })
        );
        this.editView.showDialog();
    };

    targetPrototype.subscribeToThemeSelected = function() {
        this.unsubscribeFromThemeSelected();
        this.eventBus?.on && (
            this.themeSelectedListenerId = this.eventBus.on(Events.THEME_SELECTED, (data) => {
                const selectedThemeName = data?.theme?.name;
                selectedThemeName && selectedThemeName !== this.theme?.name
                    && this.closeDialogSilently();
            })
        );
    };

    targetPrototype.unsubscribeFromThemeSelected = function() {
        this.themeSelectedListenerId && this.eventBus?.off && (
            this.eventBus.off(Events.THEME_SELECTED, this.themeSelectedListenerId),
            this.themeSelectedListenerId = null
        );
    };

    targetPrototype.closeDialogSilently = function() {
        this.unsubscribeFromThemeSelected();
        this.editView?.hideDialog?.();
    };
}
