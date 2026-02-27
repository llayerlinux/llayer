import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import {ThemeSource} from '../../../common/Constants.js';

class ThemeSelectorControllerOpsApply {
    formatThemeDisplayName(theme) {
        return theme?.title || theme?.name || this.translate('THEME');
    }

    async applyThemeAfterDownload(theme, settings, options = {}) {
        const rawName = theme?.name || theme?.title;
        const normalizedName = typeof rawName === 'string' ? rawName.trim() : '';
        const canApply = this.isInitialized && normalizedName;
        if (!canApply) return null;

        const normalizedTheme = {...theme, name: normalizedName};
        const serviceSettings = this.settingsService && typeof this.settingsService.getAll === 'function'
            ? this.settingsService.getAll()
            : {};
        const effectiveSettings = (settings && typeof settings === 'object')
            ? settings
            : serviceSettings;
        const shouldAutoApplyNetwork = options?.force === true || this.shouldAutoApplyNetwork(effectiveSettings);

        const foundLocal = this.findLocalThemeByName(normalizedTheme.name);
        const themeToApply = (foundLocal && foundLocal.name)
            ? {...foundLocal, source: 'local', isNetwork: false}
            : {...normalizedTheme, source: 'local', isNetwork: false};
        const nameToApply = typeof themeToApply?.name === 'string' ? themeToApply.name.trim() : normalizedTheme.name;

        if (!shouldAutoApplyNetwork) {
            this.handleThemeSelectionWithoutApply(themeToApply);
            this.postInstallNotifications(themeToApply, false);
            return null;
        }

        const applyOptions = {
            source: 'theme_download_auto_apply',
            selectedInstallScript: null,
            onUIUpdate: (finalResult, appliedTheme, actualElapsedTime) => {
                this.handleApplyResult(finalResult, appliedTheme, effectiveSettings);
            }
        };

        const result = await this.applyThemeWithRetry(nameToApply, applyOptions, {
            maxAttempts: 3,
            onRetry: async (attempt, errorMessage) => {
                const backoff = 180 * (attempt + 1);
                await this.delay(backoff);
                await this.loadLocalThemes();
            }
        });

        if (result) {
            this.view?.updateFromStore?.();
        }
        return result;
    }

    delay(milliseconds = 100) {
        return new Promise((done) => {
            const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
                done();
                return GLib.SOURCE_REMOVE;
            });
            if (!timeoutId) {
                done();
            }
        });
    }

    async applyThemeWithRetry(themeName, options, {maxAttempts = 1, onRetry = null} = {}) {
        let attempt = 0;
        while (true) {
            const result = await this.executeApplyTheme(themeName, options);
            const message = 'applyTheme attempt failed';
            const themeMissing = message.toLowerCase().includes('not found');
            if (result !== undefined) {
                return result;
            }
            if (!themeMissing || attempt >= (maxAttempts - 1)) {
                return {success: false, errors: [message]};
            }
            await onRetry?.(attempt, message);
            attempt += 1;
        }
    }

    shouldAutoApplyNetwork(settings = {}) {
        if (!(settings && typeof settings === 'object')) return false;
        return !!('applyNetworkThemesImmediately' in settings
            ? settings.applyNetworkThemesImmediately
            : settings.applyImmediately);
    }

    handleThemeSelectionWithoutApply(theme) {
        this.store?.selectTheme?.(theme);
        this.store?.setApplyingTheme?.(false, null);
        this.onThemeSelected(theme);

        this.notifier?.info(
            this.translate('THEME_SELECTED_TITLE'),
            this.translate('THEME_READY_MESSAGE', {theme: this.formatThemeDisplayName(theme)})
        );

        this.view?.updateCurrentThemeStyles?.(theme.name);
    }

    isNetworkTheme(theme) {
        return !!theme && typeof theme === 'object' && (
            theme.source === ThemeSource.NETWORK || theme.isNetwork === true ||
            (typeof theme.downloadUrl === 'string' && theme.downloadUrl.startsWith('http')) ||
            (typeof theme.url === 'string' && theme.url.startsWith('http')));
    }

    findLocalThemeByName(name) {
        const list = name && typeof this.store?.get === 'function' && this.store.get('localThemes'),
            normalized = Array.isArray(list) && String(name).toLowerCase();
        return normalized
            ? list.find((item) =>
                (typeof item.name === 'string' && item.name.toLowerCase() === normalized)
                || (typeof item.title === 'string' && item.title.toLowerCase() === normalized)
            ) || null
            : null;
    }
}

export function applyThemeSelectorControllerOpsApply(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsApply.prototype);
}
