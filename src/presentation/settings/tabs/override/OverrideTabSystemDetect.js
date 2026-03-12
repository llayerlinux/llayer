import GLib from 'gi://GLib';
import { tryOrDefault, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';

function readCommandOutput(command, context) {
    return tryOrDefault(context, () => {
        const [ok, stdout] = GLib.spawn_command_line_sync(command);
        return ok && stdout && stdout.length > 0 ? new TextDecoder().decode(stdout) : null;
    }, null);
}

function readJsonCommand(command, context) {
    return tryOrDefault(context, () => {
        const output = readCommandOutput(command, `${context}.stdout`);
        return output ? JSON.parse(output) : null;
    }, null);
}

function parseSetxkbmapOutput(output, detected) {
    for (const line of output.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();

        switch (key) {
            case 'layout':
                value && (detected['input:kb_layout'] = value);
                break;
            case 'variant':
                value && (detected['input:kb_variant'] = value);
                break;
            case 'options':
                value && (detected['input:kb_options'] = value);
                break;
            default:
                break;
        }
    }
}

function parseLocalectlOutput(output, detected) {
    for (const line of output.split('\n')) {
        switch (true) {
            case line.includes('X11 Layout:'): {
                const value = line.split(':')[1]?.trim();
                value && (detected['input:kb_layout'] = value);
                break;
            }
            case line.includes('X11 Variant:'): {
                const value = line.split(':')[1]?.trim();
                value && (detected['input:kb_variant'] = value);
                break;
            }
            case line.includes('X11 Options:'): {
                const value = line.split(':')[1]?.trim();
                value && (detected['input:kb_options'] = value);
                break;
            }
            default:
                break;
        }
    }
}

export function applyOverrideTabSystemDetect(prototype) {

    prototype.AUTO_DETECT_PARAMS = [
        'monitor',
        'input:kb_layout',
        'input:kb_variant',
        'input:kb_options'
    ];

    prototype.isAutoDetectParam = function(paramPath) {
        return this.AUTO_DETECT_PARAMS.includes(paramPath);
    };

    prototype.detectSystemParams = function() {
        const detected = {};

        const monitors = readJsonCommand('hyprctl monitors -j', 'OverrideTabSystemDetect.monitors');
        if (Array.isArray(monitors) && monitors.length > 0) {
            const monitorConfigs = monitors.map(m => {
                const name = m.name || '';
                const width = m.width || 1920;
                const height = m.height || 1080;
                const refreshRate = Math.round(m.refreshRate || 60);
                const x = m.x || 0;
                const y = m.y || 0;
                const scale = m.scale || 1;
                return `${name},${width}x${height}@${refreshRate},${x}x${y},${scale}`;
            });
            detected['monitor'] = monitorConfigs[0];
        }

        const keyboardOptions = {
            'input:kb_layout': readJsonCommand('hyprctl getoption input:kb_layout -j', 'OverrideTabSystemDetect.kbLayout'),
            'input:kb_variant': readJsonCommand('hyprctl getoption input:kb_variant -j', 'OverrideTabSystemDetect.kbVariant'),
            'input:kb_options': readJsonCommand('hyprctl getoption input:kb_options -j', 'OverrideTabSystemDetect.kbOptions')
        };

        for (const [paramPath, data] of Object.entries(keyboardOptions)) {
            if (data?.str && data.str !== '[[EMPTY]]') {
                detected[paramPath] = data.str;
            }
        }

        if (!detected['input:kb_layout']) {
            const setxkbmapOutput = readCommandOutput('setxkbmap -query', 'OverrideTabSystemDetect.setxkbmap');
            setxkbmapOutput && parseSetxkbmapOutput(setxkbmapOutput, detected);
        }

        if (!detected['input:kb_layout']) {
            const localectlOutput = readCommandOutput('localectl status', 'OverrideTabSystemDetect.localectl');
            localectlOutput && parseLocalectlOutput(localectlOutput, detected);
        }

        return detected;
    };

    prototype.applyDetectedParams = function() {
        if (this.isScanning) return;

        this.isScanning = true;
        this.showScanningSpinner(true);

        tryRun('OverrideTabSystemDetect.applyDetectedParams', () => {
            const detected = this.detectSystemParams();
            print(`[OverrideTab] Detected params: ${JSON.stringify(detected)}`);

            const existingOverrides = this.settingsManager?.get?.('hyprlandOverrides') || {};

            for (const [paramPath, value] of Object.entries(detected)) {
                if (value) {
                    if (paramPath === 'monitor' && existingOverrides.monitor) {
                        print(`[OverrideTab] Skipping monitor auto-detect, user has override: ${existingOverrides.monitor}`);
                        continue;
                    }

                    const entryData = this.parameterEntries.get(paramPath);
                    print(`[OverrideTab] Setting ${paramPath} = ${value}, entryData: ${entryData?.type}`);
                    if (entryData && entryData.type === 'entry') {
                        entryData.widget.set_text(value);
                    }
                    this.currentOverrides[paramPath] = value;
                    entryData?.nameLabel?.get_style_context?.().add_class('global-override-label');
                    entryData?.resetButton?.set_visible?.(true);
                    this.autoDetectedParams.add(paramPath);
                    this.scheduleRealtimeApply?.(paramPath, value);
                }
            }

            this.updateAutoDetectLabels();

            this.onOverridesChanged(this.currentOverrides);

        });

        this.isScanning = false;
        this.showScanningSpinner(false);
    };

    prototype.showScanningSpinner = function(show) {
        if (this.scanningSpinner) {
            this.scanningSpinner.set_visible(show);
            if (show) {
                this.scanningSpinner.start();
            } else {
                this.scanningSpinner.stop();
            }
        }
    };

    prototype.updateAutoDetectLabels = function() {
        const autoDetectEnabled = this.settings.autoDetectSystemParams !== false;

        for (const [paramPath, label] of this.autoDetectLabels) {
            const isDetected = this.autoDetectedParams.has(paramPath);
            label.set_visible(autoDetectEnabled && isDetected);
        }
    };

    prototype.handleAutoDetectToggle = function(enabled) {
        if (this.settingsManager) {
            this.settingsManager.set('autoDetectSystemParams', enabled);
        }
        this.settings.autoDetectSystemParams = enabled;

        if (enabled) {
            this.applyDetectedParams();
        } else {
            this.updateAutoDetectLabels();
        }
    };

    prototype.initAutoDetect = function() {
        this.autoDetectedParams.clear();
        this.isScanning = false;

        if (this.settings.autoDetectSystemParams !== false) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.applyDetectedParams();
                return GLib.SOURCE_REMOVE;
            });
        }
    };
}
