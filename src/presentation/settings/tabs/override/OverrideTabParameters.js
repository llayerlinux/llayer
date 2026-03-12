import GLib from 'gi://GLib';

export function applyOverrideTabParameters(prototype) {

    prototype.getParametersSortedByPopularity = function() {
        if (!this.parameterService) {
            return [];
        }
        return this.parameterService.getAllParameters();
    };

    prototype.handleParameterChange = function(paramPath, value) {
        if (value === null || value === undefined || value === '') {
            delete this.currentOverrides[paramPath];
        } else {
            this.currentOverrides[paramPath] = value;
        }

        const entryData = this.parameterEntries.get(paramPath);
        if (entryData?.nameLabel) {
            if (this.currentOverrides[paramPath] !== undefined) {
                entryData.nameLabel.get_style_context().add_class('global-override-label');
            } else {
                entryData.nameLabel.get_style_context().remove_class('global-override-label');
            }
        }
        if (entryData?.resetButton) {
            entryData.resetButton.set_visible(this.currentOverrides[paramPath] !== undefined);
        }

        this.onOverridesChanged(this.currentOverrides);

        if (this.scheduleRealtimeApply) {
            this.scheduleRealtimeApply(paramPath, value);
        }
    };

    prototype.getCurrentOverrides = function() {
        return { ...this.currentOverrides };
    };

    prototype.setOverrideValue = function(paramPath, value) {
        const entryData = this.parameterEntries.get(paramPath);
        if (entryData) {
            switch (entryData.type) {
                case 'checkbox':
                    entryData.widget.set_active(value === 'true' || value === '1' || value === 'yes');
                    break;
                case 'slider': {
                    entryData.widget.set_text(value || '');
                    const numVal = parseFloat(value);
                    !isNaN(numVal) && entryData.scale && entryData.scale.set_value(numVal);
                    break;
                }
                case 'combo':
                    value && entryData.widget.set_active_id(String(value));
                    break;
                default: {
                    const widget = entryData.widget || entryData;
                    widget.set_text(value || '');
                    break;
                }
            }
        }
        this.handleParameterChange(paramPath, value);
    };

    prototype.clearAllOverrides = function() {
        for (const [paramPath, entryData] of this.parameterEntries) {
            switch (entryData.type) {
                case 'checkbox':
                    entryData.widget.set_active(false);
                    break;
                case 'slider':
                    entryData.widget.set_text('');
                    if (entryData.scale) {
                        const adj = entryData.scale.get_adjustment();
                        entryData.scale.set_value(adj.get_lower());
                    }
                    break;
                case 'combo':
                    entryData.widget.set_active(0);
                    break;
                default: {
                    const widget = entryData.widget || entryData;
                    widget.set_text('');
                    break;
                }
            }
            entryData.nameLabel?.get_style_context?.().remove_class('global-override-label');
            entryData.resetButton?.set_visible?.(false);
        }
        this.currentOverrides = {};
        this.onOverridesChanged(this.currentOverrides);
    };

    prototype.validateParameterValue = function(paramPath, value) {
        if (!this.parameterService) {
            return { valid: true, value };
        }

        const param = this.parameterService.getParameter(paramPath);
        if (!param) {
            return { valid: true, value };
        }

        return param.validate(value);
    };

    prototype.getParameterInfo = function(paramPath) {
        if (!this.parameterService) {
            return null;
        }
        return this.parameterService.getParameter(paramPath);
    };

    prototype.isRealtimeApplyEnabled = function() {
        const settings = this.settingsManager?.getAll?.() || this.settings || {};
        return settings.applyHyprlandOverridesRealtime === true;
    };

    prototype.handleRealtimeApplyToggle = function(enabled) {
        if (this.settingsManager) {
            this.settingsManager.set('applyHyprlandOverridesRealtime', enabled);
        }
        this.settings.applyHyprlandOverridesRealtime = enabled;

        if (enabled) {
            this.applyAllOverridesRealtime?.();
        }
    };

    prototype.scheduleRealtimeApply = function(paramPath, value) {
        if (!this.isRealtimeApplyEnabled()) return;

        if (paramPath) {
            this.realtimeApplyQueue.set(paramPath, value);
        }

        if (this.realtimeApplyIdleId) {
            GLib.source_remove(this.realtimeApplyIdleId);
            this.realtimeApplyIdleId = 0;
        }

        this.realtimeApplyIdleId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this.realtimeApplyDelayMs || 120,
            () => {
                this.flushRealtimeApplyQueue();
                this.realtimeApplyIdleId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    };

    prototype.flushRealtimeApplyQueue = function() {
        if (!this.realtimeApplyQueue || this.realtimeApplyQueue.size === 0) return;

        for (const [paramPath, value] of this.realtimeApplyQueue.entries()) {
            this.applyRealtimeOverride(paramPath, value);
        }
        this.realtimeApplyQueue.clear();
    };

    prototype.applyAllOverridesRealtime = function() {
        if (!this.isRealtimeApplyEnabled()) return;

        const overrides = this.getCurrentOverrides ? this.getCurrentOverrides() : { ...this.currentOverrides };
        for (const [paramPath, value] of Object.entries(overrides)) {
            this.applyRealtimeOverride(paramPath, value);
        }
    };

    prototype.applyRealtimeOverride = function(paramPath, value) {
        if (!this.parameterService) return;
        const param = this.parameterService.getParameter(paramPath);
        if (!param) return;

        let applyValue = value;
        if (applyValue === null || applyValue === undefined || applyValue === '') {
            applyValue = this.getOriginalParamValue(paramPath);
        }
        if (applyValue === null || applyValue === undefined || applyValue === '') return;

        const escaped = this.parameterService.escapeValue
            ? this.parameterService.escapeValue(applyValue)
            : String(applyValue).replace(/"/g, '\\"');
        const command = `hyprctl keyword ${paramPath} "${escaped}"`;
        GLib.spawn_command_line_sync(command);
    };

    prototype.getCurrentThemeName = function() {
        const settings = this.settingsManager?.getAll?.() || this.settings || {};
        const name = settings.theme || this.settingsManager?.get?.('theme');
        return (typeof name === 'string' && name.trim().length) ? name.trim() : null;
    };

    prototype.getOriginalParamValue = function(paramPath) {
        if (!this.parameterService) return null;

        const themeName = this.getCurrentThemeName();
        if (!themeName) return null;

        if (this.realtimeApplyThemeName !== themeName || !this.realtimeApplyOriginals) {
            const themePath = `${GLib.get_home_dir()}/.config/themes/${themeName}`;
            this.realtimeApplyOriginals = this.parameterService.parseThemeOriginals(themePath);
            this.realtimeApplyThemeName = themeName;
        }

        return this.realtimeApplyOriginals?.[paramPath] ?? null;
    };
}
