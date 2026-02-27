import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { Commands } from '../../../../infrastructure/constants/Commands.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

const UTF8_DECODER = new TextDecoder();

function decodeBuffer(content) {
    return UTF8_DECODER.decode(content);
}

function getPrefixType(prefix) {
    if (prefix.includes('/rices/')) {
        return 'per-rice';
    }
    if (/\/programs\/[^/]+\/[^/]+$/.test(prefix)) {
        return 'per-program';
    }
    return 'shared';
}

class AdvancedTabDependencyIsolationOpsProcesses {
    readIsolationProcessInfo(pid) {
        return tryOrNull('listIsolationProcesses.readProcess', () => {
            const read = (p) => ((r) => r[0] && r[1] ? decodeBuffer(r[1]) : '')(GLib.file_get_contents(p)),
                [prefix, bin] = ((env) => ['PREFIX', 'BINARY'].map(k =>
                    env.match(new RegExp(`__LL_ISOLATION_${k}=([^\0]+)`))?.[1]))(read(`/proc/${pid}/environ`)),
                cmdArgs = (prefix && bin) ? read(`/proc/${pid}/cmdline`).split('\0').filter(Boolean) : null;
            return cmdArgs?.length && (cmdArgs[0]?.split('/').pop() === bin || cmdArgs[0]?.endsWith(`/${bin}`))
                ? {prefix, expectedBinary: bin, cmdArgs} : null;
        });
    }


    listIsolationProcesses() {
        const processes = [],
            homeDir = GLib.get_home_dir(),
            seenBinaries = new Set();

        const result = tryOrNull('listIsolationProcesses.spawn', () =>
            GLib.spawn_command_line_sync(`${Commands.BASH} -c "ls /proc 2>/dev/null | grep -E '^[0-9]+$'"`)
        );
        const [ok, stdout] = result || [],
            pids = result && ok && stdout && stdout.length > 0
                ? decodeBuffer(stdout).trim().split('\n').filter(Boolean)
                : [],
            processEntries = pids
                .map((pid) => ({ pid, info: this.readIsolationProcessInfo(pid) }))
                .filter(({info}) => Boolean(info));

        for (const {pid, info} of processEntries) {
            const { prefix, expectedBinary, cmdArgs } = info;
            const uniqueKey = `${prefix}:${expectedBinary}`;
            seenBinaries.has(uniqueKey) || (
                seenBinaries.add(uniqueKey),
                processes.push({
                    pid,
                    user: '',
                    command: cmdArgs.join(' ').substring(0, 150),
                    prefix: prefix.replace(homeDir, '~'),
                    type: getPrefixType(prefix),
                    binary: expectedBinary
                })
            );
        }

        return processes;
    }

    listIsolationProcessesAsync(callback) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_BATCH_SMALL_MS, () => {
            const processes = tryOrNull('listIsolationProcessesAsync', () => this.listIsolationProcesses());
            callback(processes ?? []);
            return GLib.SOURCE_REMOVE;
        });
    }

    deleteIsolationProgram(path) {
        GLib.spawn_command_line_sync(`${Commands.RM} -rf "${path}"`);
    }

    terminateIsolationProcess(pid) {
        GLib.spawn_command_line_sync(`${Commands.KILL} ${pid}`);
    }

}

export function applyAdvancedTabDependencyIsolationOpsProcesses(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsProcesses.prototype);
}
