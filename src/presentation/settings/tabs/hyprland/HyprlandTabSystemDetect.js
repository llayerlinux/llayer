import GLib from 'gi://GLib';
import { applyHyprlandEntryWidgetValue } from '../../../common/HyprlandParamUiShared.js';
import { tryOrNull, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';
import { AUTO_DETECT_PARAMS, readHyprctlOption, buildMonitorConfigString } from '../../../../infrastructure/hyprland/HyprlandSystemDetect.js';

const SETXKB_PARAM_MAP = {
    'layout': 'input:kb_layout',
    'variant': 'input:kb_variant',
    'options': 'input:kb_options'
};
const LOCALECTL_PARAM_LABELS = [
    ['X11 Layout:', 'input:kb_layout'],
    ['X11 Variant:', 'input:kb_variant'],
    ['X11 Options:', 'input:kb_options']
];

function assignIfTruthy(target, key, value) {
    value && (target[key] = value);
}

export function applyHyprlandTabSystemDetect(prototype) {

    prototype.AUTO_DETECT_PARAMS = AUTO_DETECT_PARAMS;

    prototype.isAutoDetectParam = function(paramPath) {
        return this.AUTO_DETECT_PARAMS.includes(paramPath);
    };

    prototype.readHyprctlOptionValue = function(option, logLabel = null) {
        const value = readHyprctlOption(option);
        !value && logLabel && this.logger?.debug?.(`[HyprlandTab] ${logLabel} detection error`);
        return value;
    };

    prototype.detectSystemParams = function() {
        let detected = {};
        let applyKeyboardFallback = (values = {}) => {
            for (let [key, value] of Object.entries(values)) {
                assignIfTruthy(detected, key, value);
            }
            return !!detected['input:kb_layout'];
        };

        let monitorsResult = tryOrNull(
            'detectSystemParams.monitors',
            () => GLib.spawn_command_line_sync('hyprctl monitors -j')
        );
        let [monitorsOk, monitorsStdout] = monitorsResult || [],
            monitorsOutput = monitorsOk && monitorsStdout && monitorsStdout.length > 0
            ? new TextDecoder().decode(monitorsStdout)
            : '';
        let monitors = monitorsOutput
            ? tryOrNull('detectSystemParams.monitors.parse', () => JSON.parse(monitorsOutput))
            : null;
        let monitorConfigs = Array.isArray(monitors)
            ? monitors.map(buildMonitorConfigString)
            : [];
        monitorConfigs.length > 0 && (detected.monitor = monitorConfigs[0]);
        !monitorsResult && this.logger?.debug?.('[HyprlandTab] monitor detection error');

        for (let param of ['input:kb_layout', 'input:kb_variant', 'input:kb_options']) {
            assignIfTruthy(detected, param, this.readHyprctlOptionValue(param, param === 'input:kb_layout' ? 'kb_layout' : undefined));
        }

        let keyboardDetectors = [
            {
                command: 'setxkbmap -query',
                errorLabel: 'detectSystemParams.setxkbmap',
                parse: (output) => {
                    let parsed = {},
                        lines = output.split('\n');
                    for (let line of lines) {
                        let colonIdx = line.indexOf(':'),
                            key = line.substring(0, colonIdx).trim(),
                            value = line.substring(colonIdx + 1).trim(),
                            mapped = SETXKB_PARAM_MAP[key];
                        colonIdx !== -1 && value && mapped && (parsed[mapped] = value);
                    }
                    return parsed;
                }
            },
            {
                command: 'localectl status',
                errorLabel: 'detectSystemParams.localectl',
                parse: (output) => {
                    let parsed = {},
                        lines = output.split('\n');
                    for (let line of lines) {
                        let mapping = LOCALECTL_PARAM_LABELS.find(([label]) => line.includes(label)),
                            value = line.split(':')[1]?.trim();
                        value && mapping && (parsed[mapping[1]] = value);
                    }
                    return parsed;
                }
            }
        ];

        for (let detector of keyboardDetectors) {
            if (detected['input:kb_layout']) break;

            let detectorResult = tryOrNull(
                detector.errorLabel,
                () => GLib.spawn_command_line_sync(detector.command)
            );
            let [ok, stdout] = detectorResult || [],
                output = detectorResult && ok && stdout && stdout.length > 0
                ? new TextDecoder().decode(stdout)
                : '';
            output && applyKeyboardFallback(detector.parse(output));
        }

        return detected;
    };

    prototype.applyDetectedParams = function() {
        if (this.isScanning) return undefined;

        this.isScanning = true;
        this.showScanningSpinner(true);

        let applied = tryRun('HyprlandTabSystemDetect.applyDetectedParams', () => {
            let detected = this.detectSystemParams();
            this.logger?.debug?.(`[HyprlandTab] Detected params: ${JSON.stringify(detected)}`);

            let existingOverrides = this.settingsManager?.get?.('hyprlandOverrides') ?? {};

            for (let [paramPath, value] of Object.entries(detected)) {
                let skipApply = !value || (paramPath === 'monitor' && existingOverrides.monitor);
                if (skipApply) continue;

                let entryData = this.parameterEntries.get(paramPath);
                applyHyprlandEntryWidgetValue(entryData, value);

                this.currentOverrides[paramPath] = value;
                entryData?.nameLabel?.get_style_context?.().add_class('global-override-label');
                entryData?.resetButton?.set_visible?.(true);

                this.autoDetectedParams.add(paramPath);
                this.scheduleRealtimeApply?.(paramPath, value);
            }

            this.updateAutoDetectLabels();

            if (this.settingsManager && Object.keys(this.currentOverrides).length > 0) {
                this.settingsManager.writeGlobalHyprland({ ...this.currentOverrides });
                this.settingsManager.set('hyprlandOverrides', { ...this.currentOverrides });
                this.settingsManager.write(null, { silent: true, force: true });
            }

            this.onOverridesChanged(this.currentOverrides);
        });
        !applied && this.logger?.debug?.('[HyprlandTab] applyDetectedParams failed');
        this.isScanning = false;
        this.showScanningSpinner(false);
    };

    prototype.showScanningSpinner = function(show) {
        if (this.scanningSpinner) {
            this.scanningSpinner.set_visible(show);
            show ? this.scanningSpinner.start() : this.scanningSpinner.stop();
        }
    };

    prototype.updateAutoDetectLabels = function() {
        let autoDetectEnabled = this.settings.autoDetectSystemParams !== false;

        for (let [paramPath, label] of this.autoDetectLabels) {
            let isDetected = this.autoDetectedParams.has(paramPath);
            label.set_visible(autoDetectEnabled && isDetected);
        }
    };

    prototype.handleAutoDetectToggle = function(enabled) {
        if (this.settingsManager) {
            this.settingsManager.set('autoDetectSystemParams', enabled);
            this.settingsManager.write(null, { silent: true, force: true });
        }
        this.settings.autoDetectSystemParams = enabled;
        enabled ? this.applyDetectedParams() : this.updateAutoDetectLabels();
    };

    prototype.initAutoDetect = function() {
        this.autoDetectedParams.clear();
        this.isScanning = false;

        this.settings.autoDetectSystemParams !== false && GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.applyDetectedParams();
            return GLib.SOURCE_REMOVE;
        });
    };
}
