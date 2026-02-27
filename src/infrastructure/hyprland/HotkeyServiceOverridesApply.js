import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull, tryRun } from '../utils/ErrorUtils.js';

function isThemeDirectory(themePath) {
    return themePath && GLib.file_test(themePath, GLib.FileTest.IS_DIR);
}

function createShellSubprocess() {
    return tryOrNull('HotkeyServiceOverridesApply.createSubprocess', () => {
        const process = new Gio.Subprocess({
            argv: ['bash', '-s'],
            flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        });
        process.init(null);
        return process;
    });
}

function buildOverrideScript(service, themePath, settings) {
    let safeSettings = settings ?? {},
        mergedCollection = tryOrNull(
            'HotkeyServiceOverridesApply.getMergedHotkeys',
            () => service.getMergedHotkeys(themePath, safeSettings)
        );
    if (!mergedCollection) return '';

    if (!tryRun(
        'HotkeyServiceOverridesApply.writeEffectiveOverrides',
        () => service.writeEffectiveOverrides(themePath, safeSettings)
    )) return '';

    return service.generateOverrideScript(mergedCollection, themePath);
}

function logSubprocessResult(service, output, process) {
    if (!output) {
        service.log('Hotkey override apply error');
        return;
    }

    const [, stdout, stderr] = output;
    if (process.get_exit_status() !== 0) {
        service.log(`Hotkey override apply failed: ${stderr || stdout || 'unknown error'}`);
    }
}

export function applyHotkeyServiceOverridesApply(targetPrototype) {
    targetPrototype.applyOverridesNow = function(themePath, settings) {
        if (!isThemeDirectory(themePath)) return false;

        let script = buildOverrideScript(this, themePath, settings),
            subprocess = script.trim() ? createShellSubprocess() : null;
        if (!subprocess) return false;

        subprocess.communicate_utf8_async(script, null, (proc, result) => {
            logSubprocessResult(this, tryOrNull(
                'HotkeyServiceOverridesApply.communicate',
                () => proc.communicate_utf8_finish(result)
            ), proc);
        });
        return true;
    };

    targetPrototype.regenerateAllEffectiveOverrides = function(settings) {
        const themesDir = `${GLib.get_home_dir()}/.config/themes`,
            results = { regenerated: 0, errors: [] };
        if (!GLib.file_test(themesDir, GLib.FileTest.IS_DIR)) return results;

        let enumerator = tryOrNull(
            'HotkeyServiceOverridesApply.regenerate.enumerate',
            () => Gio.File.new_for_path(themesDir).enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            )
        );
        if (!enumerator) {
            results.errors.push('Failed to enumerate themes');
            return results;
        }

        let info;
        while ((info = enumerator.next_file(null))) {
            let themeName = info.get_name(),
                themePath = `${themesDir}/${themeName}`,
                isCandidateTheme = info.get_file_type() === Gio.FileType.DIRECTORY
                    && GLib.file_test(`${themePath}/hyprland`, GLib.FileTest.IS_DIR);
            if (isCandidateTheme) {
                tryRun(
                    `HotkeyServiceOverridesApply.regenerate.${themeName}`,
                    () => this.writeEffectiveOverrides(themePath, settings)
                )
                    ? results.regenerated++
                    : results.errors.push(`${themeName}: failed to write effective overrides`);
            }
        }
        enumerator.close(null);
        return results;
    };
}
