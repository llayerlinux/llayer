import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export function resolveModuleFilePath(moduleUrl) {
    return Gio.File.new_for_uri(moduleUrl).get_path();
}

export function resolveModuleDirPath(moduleUrl) {
    return GLib.path_get_dirname(resolveModuleFilePath(moduleUrl));
}

export function resolveProjectRootFromModule(moduleUrl) {
    let current = resolveModuleDirPath(moduleUrl);

    while (current && GLib.path_get_basename(current) !== 'src') {
        const parent = GLib.path_get_dirname(current);
        if (!parent || parent === current) {
            return GLib.get_current_dir();
        }
        current = parent;
    }

    return current && GLib.path_get_basename(current) === 'src'
        ? GLib.path_get_dirname(current)
        : GLib.get_current_dir();
}
