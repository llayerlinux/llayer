import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../../../../infrastructure/constants/Commands.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';
import { formatTotalSize } from './AdvancedTabDependencyIsolationDialogProgramsFormatters.js';

const RESERVED_PREFIX_DIR_NAMES = new Set([
    'shared',
    'rices',
    'bin',
    'lib',
    'share',
    'include',
    'etc',
    'man',
    'doc'
]);
const UNKNOWN_SIZE = '...';
const UNKNOWN_VERSION = '\u2014';

class AdvancedTabDependencyIsolationOpsProgramsUtils {
    getIsolationProgramsDir() {
        return `${GLib.get_home_dir()}/.local/share/lastlayer/programs`;
    }

    getSharedPrefixInfo(prefixesDir) {
        let sharedDir = `${prefixesDir}/shared`,
            sharedDirFile = Gio.File.new_for_path(sharedDir);
        if (!sharedDirFile.query_exists(null)) return null;

        let [binDir, shareDir, libDir] = ['bin', 'share', 'lib'].map(sub => `${sharedDir}/${sub}`);
        return {
            sharedDir,
            sharedDirFile,
            binDir,
            shareDir,
            libDir,
            isFlatPrefix: Gio.File.new_for_path(binDir).query_exists(null)
                || GLib.file_test(shareDir, GLib.FileTest.IS_DIR)
                || GLib.file_test(libDir, GLib.FileTest.IS_DIR)
        };
    }

    isReservedPrefixDirName(dirName) {
        return RESERVED_PREFIX_DIR_NAMES.has(dirName);
    }

    isExecutableFileType(fileType) {
        return fileType === Gio.FileType.REGULAR || fileType === Gio.FileType.SYMBOLIC_LINK;
    }

    enumerateChildren(file, attributes, flags, context, onInfo) {
        const enumerator = tryOrNull(context, () => file.enumerate_children(attributes, flags, null));
        if (!enumerator) return false;

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (onInfo(info) === false) break;
        }
        enumerator.close?.(null);
        return true;
    }

    forEachChildDirectory(file, context, onDirectory) {
        return this.enumerateChildren(
            file,
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            context,
            (info) => (info.get_file_type() === Gio.FileType.DIRECTORY ? onDirectory(info) : true)
        );
    }

    forEachExecutableInBin(binDir, context, onExecutable) {
        const binDirFile = Gio.File.new_for_path(binDir);
        return binDirFile.query_exists(null)
            ? this.enumerateChildren(
                binDirFile,
                'standard::name,standard::type,standard::size',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                context,
                (info) => (this.isExecutableFileType(info.get_file_type()) ? onExecutable(info) : true)
            )
            : false;
    }

    forEachPerProgramDirectory(prefixesDir, context, onDirectory) {
        return this.forEachChildDirectory(
            Gio.File.new_for_path(prefixesDir),
            context,
            (info) => {
                const dirName = info.get_name();
                return this.isReservedPrefixDirName(dirName) ? true : (onDirectory(dirName), true);
            }
        );
    }

    scanVersionDirectories(programDir, programName, type, rice, items, options = {}) {
        const {
            context = 'scanVersionsDir',
            defaultVersion = null,
            defaultSize = UNKNOWN_SIZE,
            includePrefixDir = false
        } = options;
        const programDirFile = Gio.File.new_for_path(programDir);
        if (!programDirFile.query_exists(null)) {
            return;
        }

        let hasVersions = false;
        this.forEachChildDirectory(programDirFile, context, (info) => {
            hasVersions = true;
            const version = info.get_name();
            const fullPath = `${programDir}/${version}`;
            const item = {
                type,
                rice,
                program: programName,
                version,
                path: fullPath,
                size: defaultSize,
                ...(includePrefixDir ? {prefixDir: fullPath} : {})
            };
            items.push(item);
            return true;
        });

        hasVersions || items.push({
            type,
            rice,
            program: programName,
            version: defaultVersion,
            path: programDir,
            size: defaultSize,
            ...(includePrefixDir ? {prefixDir: programDir} : {})
        });
    }

    hasAnyFiles(dirPath, maxDepth = 3) {
        const dir = Gio.File.new_for_path(dirPath);
        if (maxDepth <= 0 || !dir.query_exists(null)) {
            return false;
        }

        let hasFiles = false;
        this.enumerateChildren(
            dir,
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            'hasAnyFiles',
            (info) => {
                const fileType = info.get_file_type();
                switch (fileType) {
                case Gio.FileType.REGULAR:
                    hasFiles = true;
                    return false;
                case Gio.FileType.DIRECTORY:
                    hasFiles = this.hasAnyFiles(`${dirPath}/${info.get_name()}`, maxDepth - 1);
                    return !hasFiles;
                default:
                    return true;
                }
            }
        );
        return hasFiles;
    }

    formatFileSize(bytes) {
        return formatTotalSize(bytes);
    }

    getDirectorySize(path) {
        const [ok, stdout] = GLib.spawn_command_line_sync(`${Commands.DU} -sh "${path}"`);
        const output = ok && stdout ? new TextDecoder().decode(stdout).trim().split(/\s+/)[0] : '';
        return output || UNKNOWN_VERSION;
    }
}

export function applyAdvancedTabDependencyIsolationOpsProgramsUtils(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsProgramsUtils.prototype);
}
