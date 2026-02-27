import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import {Events} from '../../../app/eventBus.js';
import {COMBO_WIDGET_KEYS} from './AppSettingsViewConstants.js';

export function applyAppSettingsViewCore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AppSettingsViewCore.prototype);
}

class AppSettingsViewCore {
    isOwnEmitter(payload) {
        return payload?.emitter === 'AppSettingsView';
    }

    applyComboValues(settings, widgets) {
        const valueMap = {
            langCombo: settings.language || 'en',
            gtkThemeCombo: settings.gtkTheme || 'LastLayer',
            animTypeCombo: settings.animationType || 'grow',
            altBarCombo: settings.alt_bar || 'none',
            defaultBarCombo: settings.default_theme_bar || 'none'
        };
        COMBO_WIDGET_KEYS.forEach(key => {
            const widget = widgets[key];
            widget && (() => {
                const val = valueMap[key];
                widget.get_active_id() !== val && widget.set_active_id(val);
            })();
        });
    }

    applyCheckboxValues(settings, widgets) {
        const checkboxMap = {
            applyCheck: settings.applyNetworkThemesImmediately === true ||
                (settings.applyNetworkThemesImmediately === undefined && settings.applyImmediately === true),
            closeAfterApplyCheck: settings.closePopupAfterApply === true,
            soundEnabledCheck: settings.soundEnabled !== false,
            showApplyTimeCheck: !!settings.showApplyTime,
            sendPerformanceStatsCheck: !!settings.sendPerformanceStats,
            showInstallTerminalCheck: !!settings.show_install_terminal,
            showAfterInstallTerminalCheck: !!settings.show_after_install_terminal,
            autoCloseInstallTerminalCheck: !!settings.auto_close_install_terminal,
            autoCloseAfterInstallTerminalCheck: !!settings.auto_close_after_install_terminal,
            forceHideScriptTerminalsCheck: !!settings.force_hide_script_terminals,
            patcherHoldTerminalCheck: !!settings.patcher_hold_terminal,
            isolationCheckbox: !!settings.enable_dependency_isolation
        };
        Object.entries(checkboxMap).forEach(([key, value]) => {
            widgets[key]?.set_active(value);
        });
    }

    syncFromStore() {
        this.handleExternalSettingsUpdate(this.store.snapshot.settings);
    }

    replaceFormState(newValues, {sync = true} = {}) {
        Object.keys(this.formState).forEach((key) => delete this.formState[key]);
        Object.assign(this.formState, this.clonePlainObject(newValues ?? {}));
        sync && this.onFormStateUpdated();
    }

    onFormStateUpdated() {
        this.compat.syncGlobals(this.formState);
    }

    applyRestorePointTimestamp(timestamp, options = {}) {
        const {patchStore = false, emitEvent = false, emitter = 'AppSettingsView'} = options;
        const t = this.translate || ((key) => key);
        const normalized = (typeof timestamp === 'string' && timestamp.trim().length)
            ? timestamp.trim() : null;
        const displayValue = normalized || t('DEFAULT_INSTALL_TEXT');

        this.widgets?.restorePointLastUpdateLabel?.set_text?.(displayValue);

        normalized
            ? (this.settingsProxy.restore_point_last_update = normalized)
            : ('restore_point_last_update' in this.settingsProxy && delete this.settingsProxy.restore_point_last_update);

        patchStore && this.store?.patch?.({restore_point_last_update: normalized});
        emitEvent && this.bus?.emit?.(Events.APPSETTINGS_RESTOREPOINT_DISPLAY, {timestamp: normalized, emitter});
    }

    subscribeToEvents() {
        const handleExternalPayload = (payload, handler) => {
            !this.isOwnEmitter(payload) && handler(payload);
        };

        [Events.APPSETTINGS_LOADED, Events.APPSETTINGS_CHANGED, Events.APPSETTINGS_RESET, Events.APPSETTINGS_COMMITTED]
            .forEach((eventName) => {
                this.eventBindings.on(eventName, (payload, sourceEvent) => {
                    const effectiveSettings = payload?.settings ?? payload;
                    this.handleExternalSettingsUpdate(effectiveSettings, sourceEvent || eventName);
                }, eventName);
            });

        this.eventBindings.on(Events.APPSETTINGS_RESTOREPOINT_DISPLAY, (payload) => {
            handleExternalPayload(payload, (eventPayload) => {
                const timestamp = eventPayload?.timestamp?.trim?.() || null;
                this.applyRestorePointTimestamp(timestamp, {patchStore: false, emitEvent: false});
            });
        });

        const repoEventName = this.bus.Events?.THEME_REPOSITORY_UPDATED || Events.THEME_REPOSITORY_UPDATED;
        this.eventBindings.on(repoEventName, () => {
            this.sections.themeApps?.refresh?.();
        });

        this.eventBindings.on(Events.APPSETTINGS_THEMEAPPS_REFRESH, (payload) => {
            handleExternalPayload(payload, () => this.sections.themeApps?.refresh?.());
        });

        const installStopEvent = this.bus.Events?.THEME_INSTALL_STOP || Events.THEME_INSTALL_STOP;
        this.eventBindings.on(installStopEvent, () => {
            const skipList = this.controller?.getSkipInstallList?.()
                || (this.formState?.skip_install_theme_apps ?? []);
            this.formState.skip_install_theme_apps = Array.isArray(skipList) ? [...skipList] : [];
            this.compat.syncGlobals(this.formState);
            this.sections.themeApps?.syncCheckboxes?.(skipList);
        });
    }

    handleExternalSettingsUpdate(settings, sourceEvent = null) {
        const snapshot = this.compat.composeSnapshot(this.clonePlainObject(settings));
        this.applySettingsToUI(snapshot);

        [Events.APPSETTINGS_LOADED, Events.APPSETTINGS_COMMITTED, Events.APPSETTINGS_RESET].includes(sourceEvent)
            && (
                this.initialFormState = this.clonePlainObject(this.formState),
                this.initialCompatibilitySnapshot = this.compat.captureState()
            );
    }

    applySettingsToUI(settings) {
        this.replaceFormState(settings, {sync: false});
        this.onFormStateUpdated();

        this.updatingFromStore = true;
        const w = this.widgets;
        const t = this.translate || ((k) => k);

        this.applyComboValues(settings, w);

        this.applyCheckboxValues(settings, w);

        w.fpsEntry?.set_text(String(settings.animationFPS ?? 240));
        w.angleEntry?.set_text(String(settings.animationAngle ?? 0));
        w.durEntry?.set_text(String(settings.wallpaperDuration ?? 1.3));
        w.altTimeoutEntry?.set_text(String(settings.alt_timeout ?? 3));

        w.defaultBarStatusLabel && (() => {
            const manual = !!settings.default_bar_manual;
            w.defaultBarStatusLabel.set_label(manual ? t('SELECTED_BY_USER') : t('SELECTED_AUTOMATICALLY'));
        })();

        w.restorePointLastUpdateLabel && (() => {
            const ts = settings.restore_point_last_update?.trim?.()
                || this.controller?.getRestorePointLastUpdate?.()?.trim?.()
                || '';
            w.restorePointLastUpdateLabel.set_text(ts || t('DEFAULT_INSTALL_TEXT'));
        })();

        const skipList = Array.isArray(settings.skip_install_theme_apps)
            ? [...settings.skip_install_theme_apps] : [];
        this.sections.themeApps?.syncCheckboxes?.(skipList);

        this.updatingFromStore = false;
    }
}
