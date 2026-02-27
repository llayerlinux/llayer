import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../constants/Commands.js';

const isValidPath = (path) => typeof path === 'string' && path.length > 0;
const isValidExec = (execFn) => typeof execFn === 'function';
const fileTest = (path, test) => GLib.file_test(path, test);

export async function existsFile(_execFn, path) {
    return isValidPath(path)
        && fileTest(path, GLib.FileTest.EXISTS)
        && !fileTest(path, GLib.FileTest.IS_DIR);
}

export async function existsDir(_execFn, path) {
    return isValidPath(path) && fileTest(path, GLib.FileTest.IS_DIR);
}

export async function removePath(execFn, path) {
    isValidExec(execFn) && isValidPath(path) && await execFn([Commands.RM, '-rf', path]);
}

async function removeIfExists(execFn, path, existsFn) {
    const canRun = isValidExec(execFn) && isValidPath(path) && typeof existsFn === 'function' && await existsFn(path);
    if (!canRun) {
        return;
    }
    const rmArgs = path.endsWith('/') ? [Commands.RM, '-rf', path] : [Commands.RM, '-f', path];
    await execFn(rmArgs);
}

export async function removeMissingEntries(execFn, entries = []) {
    if (!(Array.isArray(entries) && isValidExec(execFn))) {
        return;
    }
    for (const entry of entries) {
        !entry?.present && await removeIfExists(execFn, entry.path, entry.check);
    }
}

export async function copyIfExists(execFn, tasks = [], ensurePath = null) {
    if (!(isValidExec(execFn) && Array.isArray(tasks))) {
        return;
    }

    let ensured = false;
    const ensureDestination = async () => {
        !(ensured || !ensurePath) && (
            await execFn([Commands.MKDIR, '-p', ensurePath]),
            ensured = true
        );
    };

    for (const task of tasks) {
        const canRun = !!(task?.exists && task?.args) && await task.exists();
        canRun && (await ensureDestination(), await execFn(task.args));
    }
}

export function findExistingNamedDir(baseDir, names) {
    for (const name of names) {
        if (!name) continue;
        const path = `${baseDir}/${name}`;
        if (Gio.File.new_for_path(path).query_exists(null)) return path;
    }
    return null;
}

export function findSubdirWithHyprland(subdirs) {
    for (const subdir of subdirs) {
        const hyprlandPath = `${subdir}/hyprland.conf`;
        if (Gio.File.new_for_path(hyprlandPath).query_exists(null)) return subdir;
    }
    return null;
}

export async function getSubdirs(dir, execAsync, limit = 0) {
    const result = await execAsync([Commands.BASH, '-c',
        `find "${dir}" -mindepth 1 -maxdepth 1 -type d ! -name ".*"${limit > 0 ? ` | head -${limit}` : ''}`
    ]);
    return result.trim().split('\n').filter((d) => d.trim());
}
