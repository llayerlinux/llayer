import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

const RESERVED_SHARED_DIRS = new Set(['bin', 'lib', 'share', 'include', 'etc']);
const IGNORED_SHARED_SHARE_DIRS = new Set([
    'icons',
    'themes',
    'fonts',
    'locale',
    'man',
    'doc',
    'applications',
    'mime',
    'pixmaps',
    'glib-2.0',
    'gtk-3.0',
    'gtk-4.0'
]);
const UNKNOWN_VERSION = '\u2014';
const UNKNOWN_SIZE = '...';

class AdvancedTabDependencyIsolationOpsProgramsScan {
    scanSharedDir(prefixesDir, items) {
        let sharedInfo = this.getSharedPrefixInfo(prefixesDir);
        if (!sharedInfo) return;

        let { sharedDir, sharedDirFile, binDir, shareDir, libDir, isFlatPrefix } = sharedInfo;

        if (!isFlatPrefix) {
            this.forEachChildDirectory(sharedDirFile, 'scanSharedDir.enumerate', (info) => {
                let programName = info.get_name();
                if (RESERVED_SHARED_DIRS.has(programName)) return;
                this.scanVersionsDir(`${sharedDir}/${programName}`, programName, 'shared', null, items);
                return true;
            });
            return;
        }

        let foundPrograms = new Map();

        this.forEachExecutableInBin(binDir, 'scanSharedDir.bin', (info) => {
            foundPrograms.set(info.get_name(), { version: null, size: info.get_size(), source: 'bin' });
        });

        GLib.file_test(shareDir, GLib.FileTest.IS_DIR) && (
            this.forEachChildDirectory(Gio.File.new_for_path(shareDir), 'scanSharedDir.share', (info) => {
                let dirName = info.get_name();
                !IGNORED_SHARED_SHARE_DIRS.has(dirName) && !foundPrograms.has(dirName)
                    && foundPrograms.set(dirName, {version: null, size: null, source: 'share'});
                return true;
            })
        );

        let pkgconfigDir = `${libDir}/pkgconfig`;
        GLib.file_test(pkgconfigDir, GLib.FileTest.IS_DIR) && (
            this.enumerateChildren(
                Gio.File.new_for_path(pkgconfigDir),
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                'scanSharedDir.pkgconfig',
                (info) => {
                    let fileName = info.get_name();
                    if (!fileName.endsWith('.pc')) return true;

                    let programName = fileName.replace('.pc', ''),
                        pcPath = `${pkgconfigDir}/${fileName}`,
                        version = this.readPkgConfigVersion(pcPath),
                        found = foundPrograms.get(programName);
                    found
                        ? (found.version = version)
                        : foundPrograms.set(programName, {version, size: null, source: 'pkgconfig'});
                    return true;
                }
            )
        );

        let applicationsDir = `${shareDir}/applications`;
        GLib.file_test(applicationsDir, GLib.FileTest.IS_DIR) && (
            this.enumerateChildren(
                Gio.File.new_for_path(applicationsDir),
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                'scanSharedDir.desktop',
                (info) => {
                    let fileName = info.get_name();
                    if (!fileName.endsWith('.desktop')) return true;

                    let programName = fileName.replace('.desktop', '');
                    !foundPrograms.has(programName)
                        && foundPrograms.set(programName, {version: null, size: null, source: 'desktop'});
                    return true;
                }
            )
        );

        for (let [program, data] of foundPrograms) {
            let isBinSource = data.source === 'bin',
                programPath = isBinSource
                ? `${binDir}/${program}`
                : `${shareDir}/${program}`;

            let wrapperInfo = isBinSource ? this.detectWrapperInfo(programPath) : null,
                realPath = wrapperInfo?.realPath || programPath;

            items.push({
                type: 'shared',
                rice: null,
                program: program,
                version: data.version || this.getProgramVersion(program, realPath, sharedDir) || UNKNOWN_VERSION,
                path: programPath,
                prefixDir: sharedDir,
                size: typeof data.size === 'number' ? this.formatFileSize(data.size) : UNKNOWN_SIZE
            });
        }

        foundPrograms.size === 0 && this.hasAnyFiles(sharedDir) && items.push({
            type: 'shared',
            rice: null,
            program: '[shared prefix]',
            version: UNKNOWN_VERSION,
            path: sharedDir,
            size: UNKNOWN_SIZE
        });
    }

    scanRicesDir(prefixesDir, items) {
        const ricesDir = `${prefixesDir}/rices`,
            ricesDirFile = Gio.File.new_for_path(ricesDir);

        if (!ricesDirFile.query_exists(null)) return;

        this.forEachChildDirectory(ricesDirFile, 'scanRicesDir.enumerate', (info) => {
            const riceName = info.get_name(),
                riceDir = `${ricesDir}/${riceName}`;
            let hasPerRicePrograms = false;

            const venvDir = `${riceDir}/venv`;
            GLib.file_test(`${venvDir}/bin/activate`, GLib.FileTest.EXISTS) && items.push({
                type: 'venv',
                rice: riceName,
                program: 'Python venv',
                version: null,
                path: venvDir,
                size: UNKNOWN_SIZE
            });

            const binDir = `${riceDir}/bin`;
            this.forEachExecutableInBin(binDir, 'scanRicesDir.bin', (binInfo) => {
                const progName = binInfo.get_name(),
                    filePath = `${binDir}/${progName}`,
                    wrapperInfo = this.detectWrapperInfo(filePath),
                    realPath = wrapperInfo?.realPath || filePath;
                let fileSize = binInfo.get_size();
                wrapperInfo?.realPath && (() => {
                    const realInfo = tryOrNull('scanRicesDir.realSize', () =>
                        Gio.File.new_for_path(wrapperInfo.realPath)
                            .query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null)
                    );
                    realInfo && (fileSize = realInfo.get_size());
                })();

                items.push({
                    type: 'per-rice',
                    rice: riceName,
                    program: progName,
                    version: this.getProgramVersion(progName, realPath, riceDir) || UNKNOWN_VERSION,
                    path: filePath,
                    prefixDir: riceDir,
                    size: this.formatFileSize(fileSize)
                });
                hasPerRicePrograms = true;
                return true;
            });

            const libDir = `${riceDir}/lib`,
                shareDir = `${riceDir}/share`;
            (GLib.file_test(libDir, GLib.FileTest.IS_DIR) || GLib.file_test(shareDir, GLib.FileTest.IS_DIR))
                && !hasPerRicePrograms && items.push({
                type: 'per-rice',
                rice: riceName,
                program: `[${riceName} prefix]`,
                version: null,
                path: riceDir,
                size: UNKNOWN_SIZE
            });
            return true;
        });
    }

    scanPerProgramDir(prefixesDir, items) {
        this.forEachPerProgramDirectory(prefixesDir, 'scanPerProgramDir', (dirName) => {
            this.scanVersionsDir(`${prefixesDir}/${dirName}`, dirName, 'per-program', null, items);
        });
    }

    scanVersionsDir(programDir, programName, type, rice, items) {
        this.scanVersionDirectories(programDir, programName, type, rice, items, {
            context: 'scanVersionsDir',
            defaultVersion: null,
            defaultSize: UNKNOWN_SIZE,
            includePrefixDir: false
        });
    }
}

export function applyAdvancedTabDependencyIsolationOpsProgramsScan(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsProgramsScan.prototype);
}
