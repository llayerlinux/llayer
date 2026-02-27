import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import { isObjectLike } from '../../../infrastructure/utils/Utils.js';

class ThemeSelectorControllerSettingsRefresh {
    flushPendingSettingsRefresh() {
        const pending = this.pendingSettingsRefresh;
        this.pendingSettingsRefresh = null;
        if (pending) {
            this.scheduleSettingsRefresh(pending.settings, pending.options);
        }
    }

    parseSettingsCommitPayload(payload) {
        const payloadObj = isObjectLike(payload) ? payload : null;
        const settings = (payloadObj && 'settings' in payloadObj) ? payloadObj.settings : payload;
        const diff = payloadObj && isObjectLike(payloadObj.diff) ? payloadObj.diff : null;
        return {settings, diff};
    }

    buildSettingsRefreshOptions(diff) {
        return diff ? {
            immediate: !!diff.immediate,
            languageChanged: !!diff.languageChanged,
            themeChanged: !!diff.themeChanged
        } : {};
    }

    persistSettingsToStore(settings) {
        const store = this.store;
        if (typeof store?.setSettings === 'function') {
            return store.setSettings(settings);
        }
        if (typeof store?.set === 'function') {
            return store.set('settings', settings);
        }
        return null;
    }

    determineThemeForSettingsRefresh(settings) {
        return this.pickFirstTruthy(
            isObjectLike(settings) ? settings.theme : null,
            this.settingsService && typeof this.settingsService.getCurrentTheme === 'function'
                ? this.settingsService.getCurrentTheme()
                : null,
            this.getCurrentStoreThemeName()
        );
    }

    runSettingsRefreshUpdate(updateFn, debounceValue) {
        if (debounceValue) {
            this.timers.debounce('settingsDebounce', updateFn, debounceValue);
            return;
        }
        updateFn();
    }

    snapshotSettings(settings) {
        return isObjectLike(settings) ? {...settings} : {};
    }

    handleSettingsCommit(payload) {
        const {settings, diff} = this.parseSettingsCommitPayload(payload);
        const options = this.buildSettingsRefreshOptions(diff);
        this.scheduleSettingsRefresh(settings, options);
    }

    scheduleSettingsRefresh(settings, options = {}) {
        if (!settings) {
            return undefined;
        }

        const nextSnapshot = this.snapshotSettings(settings);
        const payload = {
            settings,
            options: {
                ...options,
                ...this.detectSettingsChanges(
                    nextSnapshot,
                    this.getPreviousSettingsSnapshot(),
                    options,
                    this.consumeSettingsOverride(options)
                )
            }
        };
        this.runSettingsRefreshUpdate(
            () => this.executeSettingsRefresh(payload, nextSnapshot),
            payload.options.debounce
        );
        return undefined;
    }

    consumeSettingsOverride(options) {
        if (!this.settingsRefreshOverride) {
            return null;
        }

        const override = {...this.settingsRefreshOverride};
        if (!options?.debounce) {
            this.settingsRefreshOverride = null;
        }
        return override;
    }

    getPreviousSettingsSnapshot() {
        const viewSettings = isObjectLike(this.view?.currentSettings)
            ? this.view.currentSettings
            : null;
        const fromView = (viewSettings && Object.keys(viewSettings).length > 0) ? {...viewSettings} : null;
        const state = this.store?.getState?.();
        const fromStore = isObjectLike(state?.settings) ? {...state.settings} : null;
        return this.snapshotSettings(fromView || fromStore || this.lastKnownSettings || {});
    }

    detectSettingsChanges(next, prev, options, override) {
        let readValue = (src, key) => src?.[key],
            isInitial = !!options.initial;
        let determineChangedFlag = (flagName, computed) => {
            return (isObjectLike(override) && this.hasOwn(override, flagName))
                ? !!override[flagName]
                : (this.hasOwn(options, flagName) ? !!options[flagName] : computed);
        };

        let languageChanged = determineChangedFlag(
            'languageChanged',
            isInitial || readValue(next, 'language') !== readValue(prev, 'language')
        );
        let themeChanged = determineChangedFlag(
            'themeChanged',
            isInitial
            || readValue(next, 'theme') !== readValue(prev, 'theme')
            || readValue(next, 'gtkTheme') !== readValue(prev, 'gtkTheme')
        );

        return {languageChanged, themeChanged};
    }

    executeSettingsRefresh(payload, nextSnapshot) {
        let {settings, options} = payload;

        this.persistSettingsToStore(settings);

        let themeName = (options.initial || options.themeChanged)
            ? this.determineThemeForSettingsRefresh(settings) : null;
        themeName && (
            this.store?.setCurrentTheme?.(themeName),
            this.timers.debounce('themeStyleUpdate', () => this.view?.updateCurrentThemeStyles?.(themeName), 500)
        );

        this.lastKnownSettings = nextSnapshot;

        (options.themeChanged || options.initial) && settings?.gtkTheme
            && this.appSettingsService?.applyGtkTheme?.(settings.gtkTheme, settings);

        this.scheduleViewSettingsUpdate(payload);
    }

    scheduleViewSettingsUpdate(payload) {
        let applyUpdate = () => {
            let view = this.view;
            view?.setupLocalizationListeners?.();
            payload.options.languageChanged && view?.handleLocalizationEvent?.(payload.settings, {
                ...payload.options,
                immediate: true
            });
            view?.onSettingsApplied?.(payload.settings, payload.options);
        };

        if (payload.options && payload.options.immediate) {
            applyUpdate();
        } else {
            this.timers.idle('settingsRefresh', applyUpdate);
        }
    }
}

export function applyThemeSelectorControllerSettingsRefresh(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorControllerSettingsRefresh.prototype);
}
