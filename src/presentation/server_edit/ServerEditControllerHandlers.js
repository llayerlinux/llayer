import { Events } from '../../app/eventBus.js';

export function applyServerEditControllerHandlers(targetPrototype) {
    targetPrototype.handleCommitCallback = function(updateData) {
        this.editView.hideError();
        this.editView.setBusy(true);

        const requestData = {
            ...updateData,
            originalName: this.theme.name
        };

        this.submitThemeUpdateCallback(requestData, this.login, this.password, (error, response) => {
            this.editView.setBusy(false);
            if (error) {
                const errorMessage = `${this.t('CONFIG_WRITE_ERROR')}: ${error.message}`;
                this.editView.showError(errorMessage);
                return;
            }

            this.unsubscribeFromThemeSelected();
            this.notify(this.t('CONFIG_WRITE_OK'));
            this.eventBus.emit(Events.THEME_UPDATED, {
                theme: this.theme,
                updateData,
                response
            });
            this.editView.hideDialog();
        });
    };

    targetPrototype.handleClose = function() {
        this.unsubscribeFromThemeSelected();
    };

    targetPrototype.handleDeleteCallback = function(password) {
        if (!password) {
            this.editView.showError(this.t('ERROR_PASSWORD_REQUIRED'));
            return;
        }

        this.editView.hideError();
        this.editView.setBusy(true);

        const themeId = this.theme?.id;
        this.submitThemeDeleteCallback(themeId, password, (error, response) => {
            this.editView.setBusy(false);
            if (error) {
                const errorMessage = `${this.t('DELETE_ERROR')}: ${error.message}`;
                this.editView.showError(errorMessage);
                return;
            }

            this.unsubscribeFromThemeSelected();
            this.notify(this.t('DELETE_SUCCESS'));
            this.eventBus.emit(Events.THEME_DELETED, {
                theme: this.theme,
                response
            });
            this.editView.hideDialog();
        });
    };
}
