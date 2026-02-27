import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';

class AdvancedTabDependencyIsolationOpsProgramsScanFast {
    scanSharedDirFast(prefixesDir, items) {
        let sharedInfo = this.getSharedPrefixInfo(prefixesDir);
        if (!sharedInfo) {
            return;
        }

        let { sharedDir, binDir, shareDir, isFlatPrefix } = sharedInfo;
        if (!isFlatPrefix) {
            return;
        }

        let foundPrograms = new Map();

        this.forEachExecutableInBin(binDir, 'scanSharedDirFast.bin', (info) => {
            foundPrograms.set(info.get_name(), { size: info.get_size(), source: 'bin' });
        });

        for (let [program, data] of foundPrograms) {
            let programPath = data.source === 'bin'
                ? `${binDir}/${program}`
                : `${shareDir}/${program}`;

            items.push({
                type: 'shared',
                rice: null,
                program: program,
                version: '\u2014',
                path: programPath,
                prefixDir: sharedDir,
                size: data.size ? this.formatFileSize(data.size) : '...'
            });
        }
    }


    scanRicesDirFast(prefixesDir, items) {
        const ricesDir = `${prefixesDir}/rices`,
            ricesDirFile = Gio.File.new_for_path(ricesDir);

        if (!ricesDirFile.query_exists(null)) return;

        this.forEachChildDirectory(ricesDirFile, 'scanRicesDirFast.enumerate', (info) => {
            const riceName = info.get_name(),
                riceDir = `${ricesDir}/${riceName}`,
                binDir = `${riceDir}/bin`;

            this.forEachExecutableInBin(binDir, 'scanRicesDirFast.bin', (binInfo) => {
                items.push({
                    type: 'per-rice',
                    rice: riceName,
                    program: binInfo.get_name(),
                    version: '\u2014',
                    path: `${binDir}/${binInfo.get_name()}`,
                    prefixDir: riceDir,
                    size: this.formatFileSize(binInfo.get_size())
                });
            });
        });
    }


    scanPerProgramDirFast(prefixesDir, items) {

        const rootBinDir = `${prefixesDir}/bin`;
        this.forEachExecutableInBin(rootBinDir, 'scanPerProgramDirFast.bin', (binInfo) => {
            items.push({
                type: 'per-program',
                rice: null,
                program: binInfo.get_name(),
                version: '\u2014',
                path: `${rootBinDir}/${binInfo.get_name()}`,
                prefixDir: prefixesDir,
                size: this.formatFileSize(binInfo.get_size())
            });
        });

        this.forEachPerProgramDirectory(prefixesDir, 'scanPerProgramDirFast.enumerate', (dirName) => {
            this.scanVersionsDirFast(`${prefixesDir}/${dirName}`, dirName, 'per-program', null, items);
        });
    }


    scanVersionsDirFast(programDir, programName, type, rice, items) {
        this.scanVersionDirectories(programDir, programName, type, rice, items, {
            context: 'scanVersionsDirFast',
            defaultVersion: '\u2014',
            defaultSize: '\u2014',
            includePrefixDir: true
        });
    }
}

export function applyAdvancedTabDependencyIsolationOpsProgramsScanFast(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsProgramsScanFast.prototype);
}
