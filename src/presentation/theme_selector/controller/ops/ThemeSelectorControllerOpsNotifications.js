import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';

class ThemeSelectorControllerOpsNotifications {
    notify(method, titleKey, messageKey, params = null) {
        this.notifier?.[method]?.(
            this.translate(titleKey),
            this.translate(messageKey, params || undefined)
        );
    }

    postInstallNotifications(theme, autoApplied) {
        const themeName = [theme?.title, theme?.displayName, theme?.name].find(Boolean) || this.translate('THEME');
        this.notify(
            autoApplied ? 'success' : 'info',
            autoApplied ? 'SUCCESS' : 'INSTALLATION_FINISHED_TITLE',
            autoApplied ? 'THEME_INSTALL_SUCCESS_MESSAGE' : 'INSTALLATION_FINISHED_MESSAGE',
            {theme: themeName}
        );

        if (!autoApplied) return;

        this.soundService?.playInstallSound?.();
        this.view?.updateFromStore && (
            this.view.updateFromStore(),
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
                this.view.updateFromStore();
                return GLib.SOURCE_REMOVE;
            })
        );
    }

    async handleDeleteTheme(theme) {
        const success = await this.themeRepository.removeTheme(theme.name);
        const [method, titleKey, msgKey, params] = success
            ? ['success', 'THEME_DELETE_SUCCESS_TITLE', 'THEME_DELETE_SUCCESS_MESSAGE', {theme: theme.title || theme.name}]
            : ['error', 'THEME_DELETE_ERROR_TITLE', 'THEME_DELETE_ERROR_MESSAGE', null];
        this.notify(method, titleKey, msgKey, params);

        success && (await this.loadLocalThemes(), this.scheduleNetworkReload(250));
    }

    handleOpenThemeFolder(theme) {
        this.notify('info', 'THEME_FOLDER_TITLE', 'THEME_FOLDER_MESSAGE', {
            theme: theme.name
        });
    }
}

export function applyThemeSelectorControllerOpsNotifications(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsNotifications.prototype);
}
