import { Events } from '../../../app/eventBus.js';

export function applyThemeSelectorControllerNavigationNotify(targetPrototype) {
    targetPrototype.notifyInfo = function(titleKey, messageKey, params = null) {
        this.notifier?.info?.(
            this.translate(titleKey),
            this.translate(messageKey, params || undefined)
        );
    };

    targetPrototype.notifyError = function(titleKey, message) {
        this.notifier?.error?.(this.translate(titleKey), message);
    };

    targetPrototype.onThemeSelected = function(theme) {
        this.eventBus.emit(Events.THEME_SELECTED, {theme});
    };

    targetPrototype.handleWindowShow = function() {
        const canCheck = this.checkForUpdatesUseCase && this.timers?.debounce && this.checkForUpdates;
        const now = Date.now();
        const lastCheckAt = this.lastUpdateCheckAt ?? 0;
        canCheck && now - lastCheckAt >= 600000 && (
            this.lastUpdateCheckAt = now,
            this.timers.debounce('checkUpdates', () => this.checkForUpdates(), 1000)
        );
    };

    targetPrototype.handleWindowHide = function() {
    };
}
