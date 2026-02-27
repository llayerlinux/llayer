import { applyHyprlandEntryWidgetValue } from '../../../common/HyprlandParamUiShared.js';
import { Events } from '../../../../app/eventBus.js';

export function applyHyprlandOverridePopupRowsHandlers(prototype) {
    prototype.handleEntryChanged = function(paramPath, value) {
        let entryData = this.parameterEntries.get(paramPath),
            originalValue = this.stripComment(this.getOriginalValue(paramPath));

        (value === '' || value === null || value === undefined)
            ? delete this.currentOverrides[paramPath]
            : (this.currentOverrides[paramPath] = value);

        entryData && (() => {
            let widget = entryData.widget || entryData,
                inputContainer = widget.get_parent(),
                row = inputContainer?.get_parent(),
                isOverridden = value !== '' && value !== originalValue;
            row && row.get_style_context()[isOverridden ? 'add_class' : 'remove_class']('overridden-row');
            this.updateParameterVisualState(paramPath, entryData);
        })();
    };

    prototype.handleParameterDig = function(paramPath) {
        let hasPerRiceOverride = this.currentOverrides[paramPath] !== undefined,
            rawValue = hasPerRiceOverride ? this.currentOverrides[paramPath] : this.getOriginalValue(paramPath),
            value = (() => {
            let primary = this.stripComment(rawValue);
            if (primary !== null && primary !== undefined && primary !== '') return primary;
            return this.stripComment(this.getCurrentValue(paramPath));
        })();
        if (value === null || value === undefined || value === '') return;

        this.globalOverrides ||= {};
        this.digRollbackParamsSnapshot || (this.digRollbackParamsSnapshot = JSON.parse(JSON.stringify(this.globalOverrides)));
        this.globalOverrideInitiators ||= {};
        this.digRollbackParamInitiatorsSnapshot || (this.digRollbackParamInitiatorsSnapshot = JSON.parse(JSON.stringify(this.globalOverrideInitiators)));
        this.digParamTargets && typeof this.digParamTargets === 'object' && (this.digParamTargets[paramPath] = value);

        this.globalOverrides[paramPath] = value;
        this.globalOverrideInitiators[paramPath] = this.currentTheme?.name || '';

        this.settingsManager?.set && (
            this.settingsManager.writeGlobalHyprland?.(this.globalOverrides, this.globalOverrideInitiators),
            this.settingsManager.set('hyprlandOverrides', this.globalOverrides),
            this.settingsManager.write?.(null, { silent: true, force: true })
        );

        this.eventBus?.emit?.(Events.HYPRLAND_GLOBAL_OVERRIDES_CHANGED, {
            overrides: { ...(this.globalOverrides ?? {}) },
            initiators: { ...(this.globalOverrideInitiators ?? {}) },
            emitter: 'HyprlandOverridePopup'
        });

        this.handleUseGlobal(paramPath);
    };

    prototype.handleUseGlobal = function(paramPath) {
        delete this.currentOverrides[paramPath];

        let globalValue = this.globalOverrides[paramPath],
            originalValue = this.stripComment(this.getOriginalValue(paramPath)),
            newValue = globalValue !== undefined ? globalValue : originalValue,
            entryData = this.parameterEntries.get(paramPath);
        applyHyprlandEntryWidgetValue(entryData, newValue, {
            sliderMinOnEmpty: true,
            comboActiveOnEmpty: -1
        });

        entryData && (() => {
            this.updateParameterVisualState(paramPath, entryData);

            let widget = entryData.widget || entryData,
                inputContainer = widget.get_parent(),
                row = inputContainer?.get_parent(),
                hasGlobal = this.globalOverrides[paramPath] !== undefined;
            row && row.get_style_context()[hasGlobal ? 'add_class' : 'remove_class']('overridden-row');
        })();
    };
}
