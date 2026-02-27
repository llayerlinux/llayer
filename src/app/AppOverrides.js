import {copyPrototypeDescriptors} from '../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { decodeBytes } from '../infrastructure/utils/Utils.js';
import { tryOrDefault, tryRun } from '../infrastructure/utils/ErrorUtils.js';
import { TIMEOUTS } from '../infrastructure/constants/Timeouts.js';

class AppOverrides {
    wasRecentHyprctlReload(thresholdSeconds = TIMEOUTS.RECENT_RELOAD_THRESHOLD_SEC) {
        const markerPath = `${GLib.get_home_dir()}/.cache/lastlayer/recent_hyprctl_reload`,
            [ok, contents] = GLib.file_test(markerPath, GLib.FileTest.EXISTS)
                ? tryOrDefault('wasRecentHyprctlReload.read', () => GLib.file_get_contents(markerPath), [false, null])
                : [false, null];
        if (!ok) return false;
        let recent = (Math.floor(Date.now() / 1000) - parseInt(decodeBytes(contents).trim(), 10)) < thresholdSeconds;
        recent && tryRun('wasRecentHyprctlReload.delete', () => Gio.File.new_for_path(markerPath).delete(null));
        return recent;
    }

    refreshOverridesOnStartup(get, settings) {
        const themePath = settings?.theme
                && `${settings?.localThemesPath || `${GLib.get_home_dir()}/.config/themes`}/${settings.theme}`,
            [parameterService, hotkeyService] = [get('hyprlandParameterService'), get('hotkeyService')];
        if (!themePath || !GLib.file_test(themePath, GLib.FileTest.IS_DIR)) return;

        parameterService && tryRun('_refreshOverrides.writeParams', () => {
            parameterService.writeEffectiveOverrides(themePath, settings);
        });

        hotkeyService && tryRun('_refreshOverrides.writeHotkeys', () => {
            hotkeyService.writeEffectiveOverrides?.(themePath, settings);
        });

        !this.wasRecentHyprctlReload()
            && tryRun('_refreshOverrides.hyprctlReload', () => GLib.spawn_command_line_sync('hyprctl reload'));
    }
}

export function applyAppOverrides(prototype) {
    copyPrototypeDescriptors(prototype, AppOverrides.prototype);
}
