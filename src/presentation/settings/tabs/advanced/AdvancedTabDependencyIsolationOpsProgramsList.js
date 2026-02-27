import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

class AdvancedTabDependencyIsolationOpsProgramsList {
    collectIsolationPrograms(scanAll) {
        const prefixesDir = this.getIsolationProgramsDir();
        return Gio.File.new_for_path(prefixesDir).query_exists(null)
            ? (() => {
                const items = [];
                scanAll(prefixesDir, items);
                return items;
            })()
            : [];
    }

    listIsolationPrograms() {
        return this.collectIsolationPrograms((prefixesDir, items) => {
            this.scanSharedDir(prefixesDir, items);
            this.scanRicesDir(prefixesDir, items);
            this.scanPerProgramDir(prefixesDir, items);
        });
    }


    listIsolationProgramsFast() {
        return this.collectIsolationPrograms((prefixesDir, items) => {
            this.scanSharedDirFast(prefixesDir, items);
            this.scanRicesDirFast(prefixesDir, items);
            this.scanPerProgramDirFast(prefixesDir, items);
        });
    }


    listIsolationProgramsAsync(callback) {

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_BATCH_SMALL_MS, () => {
            const programs = tryOrNull('listIsolationProgramsAsync', () => this.listIsolationProgramsFast());
            callback(programs ?? []);
            return GLib.SOURCE_REMOVE;
        });
    }
}

export function applyAdvancedTabDependencyIsolationOpsProgramsList(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsProgramsList.prototype);
}
