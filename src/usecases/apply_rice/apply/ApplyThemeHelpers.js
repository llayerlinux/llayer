import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Commands} from '../../../infrastructure/constants/Commands.js';

export const themesDir = () => `${GLib.get_home_dir()}/.config/themes`;
export const defaultPreview = () => `${GLib.get_home_dir()}/lastlayer/arch_lastlayer_clear/assets/no_preview.png`;

export const ROOT_COMMANDS_FOR_PKEXEC = [
    Commands.APT,
    Commands.DNF,
    Commands.PACMAN,
    Commands.YAY,
    Commands.CHOWN,
    Commands.CHMOD,
    Commands.USRMOD,
    Commands.SETCAP,
    Commands.SETFACL,
    Commands.SYSTEMCTL,
    Commands.MAKEPKG
];

export function determinePreviewPath(themeDir) {
    const path = `${themeDir}/preview.png`;
    return Gio.File.new_for_path(path).query_exists(null) ? path : defaultPreview();
}

export function createLocalThemeObject(themeName, themeDir) {
    return {
        name: themeName,
        title: themeName,
        source: 'local',
        path: themeDir,
        icon: determinePreviewPath(themeDir),
        metadata: {},
        isLocal: () => true,
        hasScripts: () => false
    };
}
