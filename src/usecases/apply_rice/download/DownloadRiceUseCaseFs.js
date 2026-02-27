import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import {
    ARCHIVE_EXTRACTION_COMMANDS,
    DEFAULT_EXTRACTION_COMMANDS_BY_EXTENSION,
    ALLOWED_DELETION_PREFIXES,
    ALLOWED_TARGET_PREFIXES,
    CRITICAL_PATH_SET
} from '../../../infrastructure/constants/FileSafety.js';
import {ARCHIVE_EXTENSIONS_SORTED, DEFAULT_ARCHIVE_EXTENSION} from './DownloadRiceUseCaseConstants.js';

class DownloadRiceUseCaseFs {
    decodeOutput(bytes) {
        return bytes ? new TextDecoder('utf-8').decode(bytes) : '';
    }


    extractArchiveSync(archivePath, extractDir, extension) {
        if (!Gio.File.new_for_path(archivePath).query_exists(null))
            return {success: false, error: `Archive file not found: ${archivePath}`};

        const [fileCheckOk, fileOutput] = GLib.spawn_sync(null, [Commands.FILE, '-b', archivePath], null,
            GLib.SpawnFlags.SEARCH_PATH, null),
            extractFn = ((type) =>
                (type && ARCHIVE_EXTRACTION_COMMANDS.find(([pattern]) => type.includes(pattern))?.[1])
                || DEFAULT_EXTRACTION_COMMANDS_BY_EXTENSION[extension] || DEFAULT_EXTRACTION_COMMANDS_BY_EXTENSION.default
            )((fileCheckOk && fileOutput) ? this.decodeOutput(fileOutput).trim().toLowerCase() : null),
            [, , extractErr, exitCode] = GLib.spawn_command_line_sync(extractFn(archivePath, extractDir));
        return exitCode !== 0
            ? {success: false, error: `Extract failed with status ${exitCode}: ${this.decodeOutput(extractErr) || this.translate('UNKNOWN_ERROR')}`}
            : {success: true};
    }

    moveFilesSync(sourceDir, targetDir) {
        const enumerator = Gio.File.new_for_path(sourceDir)
            .enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null),
            files = [];
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            info.get_name().length > 0 && files.push(info.get_name());
        }
        enumerator.close(null);

        const firstItem = files.length === 1 ? `${sourceDir}/${files[0]}` : null,
            themeRoot = firstItem
                && Gio.File.new_for_path(firstItem).query_file_type(Gio.FileQueryInfoFlags.NONE, null) === Gio.FileType.DIRECTORY
                ? firstItem : sourceDir;

        Gio.File.new_for_path(themeRoot).move(Gio.File.new_for_path(targetDir), Gio.FileCopyFlags.OVERWRITE, null, null);
    }

    cleanupSync(archivePath, extractDir) {
        const archive = Gio.File.new_for_path(archivePath);
        archive.query_exists(null) && archive.delete(null);

        const extractDirFile = Gio.File.new_for_path(extractDir);
        extractDirFile.query_exists(null) && this.recursiveDelete(extractDirFile, extractDir);
    }

    removeDirectorySync(path) {
        const dir = Gio.File.new_for_path(path);
        dir.query_exists(null) && this.recursiveDelete(dir, path);
    }

    isDeletionAllowed(filePath, basePath = null) {
        const resolvedBasePath = basePath ? Gio.File.new_for_path(basePath).get_path() : null;
        return !!filePath
            && (!resolvedBasePath || filePath.startsWith(resolvedBasePath))
            && !(CRITICAL_PATH_SET.has(filePath) || CRITICAL_PATH_SET.has(`${filePath}/`))
            && (basePath || ALLOWED_DELETION_PREFIXES.some((prefix) => filePath.startsWith(prefix)));
    }

    recursiveDelete(file, basePath = null) {
        const filePath = file?.get_path?.(),
            canDelete = file instanceof Gio.File && filePath && this.isDeletionAllowed(filePath, basePath);
        if (!canDelete) return false;

        file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) === Gio.FileType.DIRECTORY && (() => {
            const enumerator = file.enumerate_children('standard::*',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                this.recursiveDelete(file.get_child(info.get_name()), basePath || filePath);
            }
            enumerator.close(null);
        })();

        file.delete(null);
        return true;
    }

    copyDirectory(sourceDir, targetDir) {
        let source = Gio.File.new_for_path(sourceDir), target = Gio.File.new_for_path(targetDir),
            targetPath = target.get_path();
        if (!(source.get_path() && targetPath && ALLOWED_TARGET_PREFIXES.some((prefix) => targetPath.startsWith(prefix)))) {
            return false;
        }

        target.query_exists(null) || target.make_directory_with_parents(null);

        let enumerator = source.enumerate_children('standard::*',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            let name = info.get_name(),
                sourceChild = source.get_child(name), targetChild = target.get_child(name),
                isValidTarget = !name.includes('..') && !name.includes('/') && targetChild.get_path().startsWith(targetPath);
            isValidTarget && (() => {
                switch (info.get_file_type()) {
                    case Gio.FileType.DIRECTORY:
                        this.copyDirectory(sourceChild.get_path(), targetChild.get_path());
                        break;
                    case Gio.FileType.SYMBOLIC_LINK:
                        break;
                    default:
                        sourceChild.copy(targetChild, Gio.FileCopyFlags.OVERWRITE, null, null);
                        break;
                }
            })();
        }
        enumerator.close(null);
    }

    async removeDirectory(path) {
        const file = Gio.File.new_for_path(path);
        file.query_exists(null) && await this.execAsync([Commands.RM, '-rf', path]);
    }

    async ensureDirectory(path) {
        const dir = Gio.File.new_for_path(path);
        !dir.query_exists(null) && dir.make_directory_with_parents(null);
    }

    async listDirectory(path) {
        const stdout = await this.getExecAsyncFn()([Commands.LS, '-1', path]);
        return stdout.trim().split('\n').filter(f => f.length > 0);
    }

    async execAsync(argv) {
        let execAsyncFn = this.getExecAsyncFn();
        return execAsyncFn
            ? await execAsyncFn(argv)
            : new Promise((complete, fail) => {
                const proc = Gio.Subprocess.new(
                    argv,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

                proc.communicate_utf8_async(null, null, (proc, res) => {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    proc.get_successful() ? complete(stdout) : fail(new Error(stderr || stdout));
                });
            });
    }

    getArchiveExtension(pathOrUrl) {
        const value = (pathOrUrl || '').toLowerCase();
        return ARCHIVE_EXTENSIONS_SORTED.find((ext) => value.endsWith(ext)) || DEFAULT_ARCHIVE_EXTENSION;
    }
}

export function applyDownloadRiceUseCaseFs(targetProto) {
    copyPrototypeDescriptors(targetProto, DownloadRiceUseCaseFs.prototype);
}
