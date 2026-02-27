import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import {TabType, ThemeSource} from '../../../common/Constants.js';

class ThemeSelectorControllerOpsLifecycle {
    getNetworkReloadOptions(overrides = {}) {
        return {
            forceRefresh: true,
            page: this.networkPagination?.page ?? null,
            pageSize: this.networkPagination?.pageSize ?? null,
            ...overrides
        };
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'local':
                await this.loadLocalThemes();
                break;
            case 'network':
                await this.loadNetworkThemes(this.getNetworkReloadOptions());
                break;
            default:
                break;
        }
    }

    destroy() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];

        if (this.eventBus?.off) {
            for (const {eventName, listenerId} of this.eventBusListeners) {
                this.eventBus.off(eventName, listenerId);
            }
        }
        this.eventBusListeners = [];
        this.eventBusSubscribed = false;

        if (this.themeRepository && this.directoryMonitorCallback) {
            this.themeRepository.removeMonitorCallback(this.directoryMonitorCallback);
            this.directoryMonitorCallback = null;
        }

        this.timers.clearAll();

        this.tweaksView?.close?.();
        this.storeState();
        this.store?.destroy?.();
        this.isInitialized = false;
    }

    determineElapsedMs(applyResult) {
        if (typeof applyResult?.elapsedTime === 'number' && applyResult.elapsedTime > 0) return applyResult.elapsedTime;

        const timeMessage = Array.isArray(applyResult?.messages)
                ? applyResult.messages.find((msg) => /elapsed/i.test(msg))
                : null,
              match = timeMessage?.match?.(/([0-9]+\.?[0-9]*)s/);
        return match ? parseFloat(match[1]) * 1000 : 0;
    }

    async handleApplyResult(applyResult, theme, settings) {
        if (!applyResult.success) {
            return this.handleApplyError(
                new Error(applyResult.errors?.join('; ') || this.translate('UNKNOWN_ERROR')),
                theme
            );
        }

        this.store?.setCurrentTheme?.(theme.name);
        theme && this.store?.selectTheme?.(theme);

        if (this.view?.updateThemesList) {
            const rawList = this.store.get(this.store.get('activeTab') === TabType.LOCAL ? 'localThemes' : 'networkThemes');
            this.view.updateThemesList(Array.isArray(rawList) ? rawList : []);
        }
        this.view?.updateCurrentThemeStyles?.(theme.name);
        this.settingsService?.setCurrentTheme?.(theme.name);

        theme.source === ThemeSource.NETWORK && await this.loadLocalThemes();

        const elapsedMs = (settings.showApplyTime && this.notifier) ? this.determineElapsedMs(applyResult) : 0;
        elapsedMs > 0 && this.notifier.info(
            this.translate('THEME_APPLIED_NOTIFY'),
            this.translate('THEME_APPLIED_WITH_TIME', {
                theme: theme.title || theme.name,
                seconds: (elapsedMs / 1000).toFixed(1)
            })
        );

        settings.closePopupAfterApply && this.view?.hide?.();
        return undefined;
    }

    handleApplyError(error, theme) {
        const title = this.translate('THEME_APPLY_ERROR_TITLE');
        const message = this.translate('THEME_APPLY_ERROR_WITH_THEME', {
            theme: theme?.name || this.translate('THEME'),
            error: error?.message || this.translate('UNKNOWN_ERROR')
        });
        this.notifier.error(title, message);
    }

    scheduleLocalReload(delayMs = 200) {
        this.timers.debounce('localReload', () => this.loadLocalThemes({force: true}), delayMs);
    }

    scheduleNetworkReload(delayMs = 0) {
        this.timers.debounce('networkReload', () => {
            this.loadNetworkThemes(this.getNetworkReloadOptions());
        }, delayMs);
    }
}

export function applyThemeSelectorControllerOpsLifecycle(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsLifecycle.prototype);
}
