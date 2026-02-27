import GLib from 'gi://GLib';
import { applyHyprlandEntryWidgetValue } from '../../../common/HyprlandParamUiShared.js';
import { tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';
import { Events } from '../../../../app/eventBus.js';

export function applyHyprlandTabParameters(prototype) {
    prototype.subscribeToGlobalOverrideEvents = function() {
        const bus = this.eventBus;
        if (!bus?.on || this._globalOverridesListenerId) {
            return;
        }

        const eventName = Events.HYPRLAND_GLOBAL_OVERRIDES_CHANGED;
        const listenerId = bus.on(eventName, (payload) => {
            const overrides = payload?.overrides;
            overrides && this.applyGlobalOverridesToUI(overrides);
        });
        this._globalOverridesListenerId = listenerId;

        const cleanup = () => {
            this._globalOverridesListenerId && bus.off(eventName, this._globalOverridesListenerId);
            this._globalOverridesListenerId = null;
        };
        this.parentWindow?.connect?.('destroy', cleanup);
    };

    prototype.applyGlobalOverridesToUI = function(overrides) {
        if (!overrides || typeof overrides !== 'object') {
            return;
        }

        this.currentOverrides = { ...overrides };

        for (const [paramPath, entryData] of this.parameterEntries) {
            const value = this.currentOverrides[paramPath];
            const isEmpty = this.isEmptyOverrideValue(value);
            entryData && (
                entryData.suspendChange = true,
                applyHyprlandEntryWidgetValue(entryData, isEmpty ? '' : value, {
                    sliderMinOnEmpty: true,
                    comboActiveOnEmpty: -1
                }),
                entryData.suspendChange = false,
                this.updateEntryOverrideState(entryData, !isEmpty)
            );
        }
    };

    prototype.isEmptyOverrideValue = function(value) {
        return value === null || value === undefined || value === '';
    };

    prototype.updateEntryOverrideState = function(entryData, isActive) {
        entryData?.nameLabel?.get_style_context?.()?.[isActive ? 'add_class' : 'remove_class']?.('global-override-label');
        entryData?.resetButton?.set_visible?.(!!isActive);
    };

    prototype.getParametersSortedByPopularity = function() {
        return this.parameterService?.getAllParameters?.() ?? [];
    };

    prototype.handleParameterChange = function(paramPath, value) {
        this.isEmptyOverrideValue(value)
            ? delete this.currentOverrides[paramPath]
            : (this.currentOverrides[paramPath] = value);

        const entryData = this.parameterEntries.get(paramPath);
        this.updateEntryOverrideState(entryData, this.currentOverrides[paramPath] !== undefined);

        this.saveOverridesToSettings();

        this.onOverridesChanged(this.currentOverrides);

        this.scheduleRealtimeApply?.(paramPath, value);
    };

    prototype.saveOverridesToSettings = function() {
        const manager = this.settingsManager;
        manager && (
            manager.writeGlobalHyprland({ ...this.currentOverrides }),
            manager.set('hyprlandOverrides', { ...this.currentOverrides }),
            manager.write(null, { silent: true, force: true })
        );
    };

    prototype.getCurrentOverrides = function() {
        return { ...this.currentOverrides };
    };

    prototype.setOverrideValue = function(paramPath, value) {
        const entryData = this.parameterEntries.get(paramPath);
        applyHyprlandEntryWidgetValue(entryData, value);
        this.handleParameterChange(paramPath, value);
    };

    prototype.clearAllOverrides = function() {
        for (const [, entryData] of this.parameterEntries) {
            applyHyprlandEntryWidgetValue(entryData, '', {
                sliderMinOnEmpty: true,
                comboActiveOnEmpty: 0
            });
            this.updateEntryOverrideState(entryData, false);
        }
        this.currentOverrides = {};
        this.saveOverridesToSettings();
        this.onOverridesChanged(this.currentOverrides);
    };

    prototype.validateParameterValue = function(paramPath, value) {
        const param = this.parameterService?.getParameter?.(paramPath);
        return param ? param.validate(value) : { valid: true, value };
    };

    prototype.getParameterInfo = function(paramPath) {
        return this.parameterService?.getParameter?.(paramPath) || null;
    };

    prototype.isRealtimeApplyEnabled = function() {
        const settings = (this.settingsManager?.getAll?.() || this.settings) ?? {};
        return settings.applyHyprlandOverridesRealtime === true;
    };

    prototype.handleRealtimeApplyToggle = function(enabled) {
        this.settingsManager && (
            this.settingsManager.set('applyHyprlandOverridesRealtime', enabled),
            this.settingsManager.write(null, { silent: true, force: true })
        );
        this.settings.applyHyprlandOverridesRealtime = enabled;

        enabled && this.applyAllOverridesRealtime?.();
    };

    prototype.scheduleRealtimeApply = function(paramPath, value) {
        return this.isRealtimeApplyEnabled()
            ? (
                paramPath && this.realtimeApplyQueue.set(paramPath, value),
                this.realtimeApplyIdleId && (
                    GLib.source_remove(this.realtimeApplyIdleId),
                    this.realtimeApplyIdleId = 0
                ),
                this.realtimeApplyIdleId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    this.realtimeApplyDelayMs || 120,
                    () => {
                        this.flushRealtimeApplyQueue();
                        this.realtimeApplyIdleId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                )
            )
            : undefined;
    };

    prototype.flushRealtimeApplyQueue = function() {
        const queue = this.realtimeApplyQueue;
        queue?.size && (
            Array.from(queue.entries()).forEach(([paramPath, value]) => this.applyRealtimeOverride(paramPath, value)),
            queue.clear()
        );
    };

    prototype.applyAllOverridesRealtime = function() {
        return this.isRealtimeApplyEnabled()
            ? (() => {
                const overrides = this.getCurrentOverrides ? this.getCurrentOverrides() : { ...this.currentOverrides };
                for (const [paramPath, value] of Object.entries(overrides)) {
                    this.applyRealtimeOverride(paramPath, value);
                }
            })()
            : undefined;
    };

    prototype.applyRealtimeOverride = function(paramPath, value) {
        const param = this.parameterService?.getParameter?.(paramPath);
        return param
            ? (() => {
                const applyValue = this.isEmptyOverrideValue(value) ? this.getOriginalParamValue(paramPath) : value;
                return this.isEmptyOverrideValue(applyValue)
                    ? undefined
                    : (() => {
                        const escaped = this.parameterService.escapeValue
                            ? this.parameterService.escapeValue(applyValue)
                            : String(applyValue).replace(/"/g, '\\"');
                        const command = `hyprctl keyword ${paramPath} "${escaped}"`;
                        const applied = tryRun('HyprlandTabParameters.applyRealtimeOverride', () => {
                            GLib.spawn_command_line_sync(command);
                        });
                        !applied && this.logger?.warn?.('[HyprlandTab] Failed to apply realtime override');
                    })();
            })()
            : undefined;
    };

    prototype.getCurrentThemeName = function() {
        const settings = (this.settingsManager?.getAll?.() || this.settings) ?? {};
        const name = settings.theme || this.settingsManager?.get?.('theme');
        return (typeof name === 'string' && name.trim().length) ? name.trim() : null;
    };

    prototype.getOriginalParamValue = function(paramPath) {
        const parameterService = this.parameterService;
        const themeName = this.getCurrentThemeName();
        return (parameterService && themeName)
            ? (() => {
                const shouldReloadOriginals = this.realtimeApplyThemeName !== themeName || !this.realtimeApplyOriginals;
                shouldReloadOriginals && (
                    this.realtimeApplyOriginals = parameterService.parseThemeOriginals(`${GLib.get_home_dir()}/.config/themes/${themeName}`),
                    this.realtimeApplyThemeName = themeName
                );
                return this.realtimeApplyOriginals?.[paramPath] ?? null;
            })()
            : null;
    };
}
