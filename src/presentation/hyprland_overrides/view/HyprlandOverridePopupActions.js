import GLib from 'gi://GLib';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';
import { applyHyprlandEntryWidgetValue } from '../../common/HyprlandParamUiShared.js';
import { AUTO_DETECT_PARAMS, readHyprctlOption, buildMonitorConfigString } from '../../../infrastructure/hyprland/HyprlandSystemDetect.js';

export function applyHyprlandOverridePopupActions(prototype) {

    prototype.AUTO_DETECT_PARAMS = AUTO_DETECT_PARAMS;

    prototype.detectSystemParams = function() {
        const detected = {},
            result = tryOrNull('detectSystemParams.monitor', () => GLib.spawn_command_line_sync('hyprctl monitors -j')),
            [ok, stdout] = result || [];
        if (ok && stdout?.length > 0) {
            const output = new TextDecoder().decode(stdout);
            const monitors = tryOrNull('detectSystemParams.monitor.parse', () => JSON.parse(output));
            if (Array.isArray(monitors) && monitors.length > 0) {
                detected.monitor = buildMonitorConfigString(monitors[0]);
            }
        }

        for (const param of ['input:kb_layout', 'input:kb_variant', 'input:kb_options']) {
            const value = readHyprctlOption(param);
            value && (detected[param] = value);
        }

        return detected;
    };

    prototype.handleSetSystem = function() {
        const detected = this.detectSystemParams(),
            affectedWidgets = [];

        for (const [paramPath, value] of Object.entries(detected)) {
            const entryData = value ? this.parameterEntries.get(paramPath) : null;
            if (entryData?.type !== 'entry' && entryData?.type !== 'slider') continue;
            applyHyprlandEntryWidgetValue(entryData, value);
            affectedWidgets.push(entryData.widget);
        }

        affectedWidgets.length > 0 && this.highlightWidgets(affectedWidgets, 3000);
    };

    prototype.highlightWidgets = function(widgets, durationMs) {
        for (const widget of widgets) {
            widget.get_style_context().add_class('system-highlight');
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, durationMs, () => {
            for (const widget of widgets) {
                widget.get_style_context().remove_class('system-highlight');
            }
            return GLib.SOURCE_REMOVE;
        });
    };

    prototype.handleSave = function() {
        if (!(this.currentTheme && this.themeRepository)) {
            this.log('Cannot save: no theme or repository');
            this.hide();
            return;
        }

        const cleanOverrides = {};
        for (const [path, value] of Object.entries(this.currentOverrides)) {
            value !== null && value !== undefined && value !== '' && (cleanOverrides[path] = value);
        }

        this.themeRepository.writeOverrides(this.currentTheme.name, cleanOverrides)
            ? (this.log(`Saved ${Object.keys(cleanOverrides).length} overrides for ${this.currentTheme.name}`),
                this.savePerRiceHotkeyOverrides?.(), this.saveThemeMetadata?.(), this.generateEffectiveOverrides())
            : this.log(`Failed to save overrides for ${this.currentTheme.name}`);

        this.hide();
    };

    prototype.handleResetAll = function() {
        for (const [paramPath, entryData] of this.parameterEntries) {
            const originalValue = this.stripComment(this.getOriginalValue(paramPath));
            applyHyprlandEntryWidgetValue(entryData, originalValue, {
                sliderMinOnEmpty: true,
                comboActiveOnEmpty: -1
            });
        }

        this.currentOverrides = {};
    };

    prototype.generateEffectiveOverrides = function() {
        if (!(this.currentTheme && this.settingsManager)) return;

        const themePath = `${GLib.get_home_dir()}/.config/themes/${this.currentTheme.name}`,
            settings = this.settingsManager.getAll?.() ?? {};
        this.parameterService?.writeEffectiveOverrides?.(themePath, settings);
        this.hotkeyService?.writeEffectiveOverrides?.(themePath, settings);
    };

    prototype.getThemePath = function() {
        return this.currentTheme ? `${GLib.get_home_dir()}/.config/themes/${this.currentTheme.name}` : null;
    };

    prototype.hasUnsavedChanges = function() {
        if (!(this.themeRepository && this.currentTheme)) return false;

        const savedOverrides = this.themeRepository.readOverrides(this.currentTheme.name),
            currentKeys = new Set(Object.keys(this.currentOverrides)),
            savedKeys = new Set(Object.keys(savedOverrides));

        if (currentKeys.size !== savedKeys.size) return true;

        for (const key of currentKeys) {
            if (this.currentOverrides[key] !== savedOverrides[key]) return true;
        }

        return false;
    };
}
