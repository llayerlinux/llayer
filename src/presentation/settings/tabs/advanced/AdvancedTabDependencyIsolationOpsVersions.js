import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../../../../infrastructure/constants/Commands.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';

const GENERIC_VERSION_ARG_SETS = [
    ['--version'],
    ['-V'],
    ['version']
];

const SPECIFIC_VERSION_PROBES = {
    'ags': (binaryPath) =>
        `${Commands.BASH} -c "timeout 2 '${binaryPath}' --version 2>&1 | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1"`,
    'agsv1': (binaryPath) =>
        `${Commands.BASH} -c "timeout 2 '${binaryPath}' --version 2>&1 | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1"`,
    'waybar': (binaryPath) =>
        `${Commands.BASH} -c "timeout 1 '${binaryPath}' --version 2>&1 | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1"`,
    'rofi': (binaryPath) =>
        `${Commands.BASH} -c "timeout 1 '${binaryPath}' -version 2>&1 | grep -oE 'Version:\\s*[0-9]+\\.[0-9.]+' | grep -oE '[0-9]+\\.[0-9.]+' | head -1"`,
    'eww': (binaryPath) =>
        `${Commands.BASH} -c "timeout 1 '${binaryPath}' --version 2>&1 | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1"`,
    'hyprctl': () =>
        `${Commands.BASH} -c "timeout 1 hyprctl version 2>/dev/null | grep -oE 'v[0-9]+\\.[0-9.]+' | head -1 | tr -d 'v'"`,
    'hyprland': () =>
        `${Commands.BASH} -c "timeout 1 hyprctl version 2>/dev/null | grep -oE 'v[0-9]+\\.[0-9.]+' | head -1 | tr -d 'v'"`,
    'kitty': (binaryPath) =>
        `${Commands.BASH} -c "timeout 1 '${binaryPath}' --version 2>&1 | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1"`
};

const WRAPPER_PATH_EXTRACTORS = [
    (text) => text.match(/^exec\s+([^\s"$]+)/m)?.[1] || null,
    (text) => text.match(/# Real binary:\s*(.+)/)?.[1]?.trim() || null,
    (text) => text.match(/__LL_REAL_BINARY="([^"]+)"/)?.[1] || null
];
const UNKNOWN_VERSION = '\u2014';
const UTF8_DECODER = new TextDecoder();
const VERSION_OUTPUT_PATTERNS = [
    (output, programName) => output.match(new RegExp(`${programName}[\\s-]*([\\d]+[\\d.]+[\\d\\w.-]*)`, 'i'))?.[1] || null,
    (output) => output.match(/(?:version|v)\s*(\d+[\d.]+[\d\w.-]*)/i)?.[1] || null,
    (output) => output.match(/\b(\d+\.\d+(?:\.\d+)?(?:[-.\w]*)?)\b/)?.[1] || null,
    (output) => output.match(/(\d+\.\d+\.\d+(?:-\d+-g[a-f0-9]+)?)/)?.[1] || null
];

function determineWrapperTarget(realPath) {
    if (!realPath) {
        return null;
    }
    if (realPath.startsWith('/usr/')) {
        return 'system';
    }
    if (realPath.includes('-real')) {
        return 'local';
    }
    return realPath.replace(GLib.get_home_dir(), '~');
}

class AdvancedTabDependencyIsolationOpsVersions {
    createSubprocessLauncher() {
        return new Gio.SubprocessLauncher({
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        });
    }

    getProgramVersionAsync(programName, binaryPath, prefixDir, callback) {
        const prefixVersion = this.readPrefixVersion(programName, prefixDir);
        if (prefixVersion) {
            callback(prefixVersion);
            return;
        }
        if (!(binaryPath && GLib.file_test(binaryPath, GLib.FileTest.IS_EXECUTABLE))) {
            this.getPacmanVersionAsync(programName, callback);
            return;
        }

        this.runVersionCommandAsync(
            this.detectWrapperInfo(binaryPath)?.realPath || binaryPath,
            programName,
            (version) => version ? callback(version) : this.getPacmanVersionAsync(programName, callback)
        );
    }

    runVersionCommandAsync(binaryPath, programName, callback) {
        const subprocess = tryOrNull(
            'runVersionCommand.spawn',
            () => this.createSubprocessLauncher().spawnv(['/usr/bin/timeout', '1', binaryPath, '--version'])
        );
        return subprocess
            ? subprocess.communicate_utf8_async(null, null, (proc, res) => {
                const result = tryOrNull('runVersionCommand.finish', () => proc.communicate_utf8_finish(res)),
                    [ok, stdout] = result || [],
                    output = result && ok && stdout ? stdout.trim().split('\n')[0] : null;
                callback(output ? this.extractVersionFromOutput(output, programName) : null);
            })
            : callback(null);
    }

    getPacmanVersionAsync(programName, callback) {
        const subprocess = tryOrNull(
            'pacmanVersion.spawn',
            () => this.createSubprocessLauncher().spawnv(['/usr/bin/pacman', '-Q', programName])
        );
        return subprocess
            ? subprocess.communicate_utf8_async(null, null, (proc, res) => {
                const result = tryOrNull('pacmanVersion.finish', () => proc.communicate_utf8_finish(res)),
                    [ok, stdout] = result || [],
                    parts = result && ok && stdout ? stdout.trim().split(/\s+/) : [];
                callback(parts.length >= 2 ? parts[1] : null);
            })
            : callback(null);
    }

    loadVersionsAsync(programs, onVersionLoaded, onComplete) {
        return (Array.isArray(programs) && programs.length > 0)
            ? (() => {
                const scheduleIdle = (next) => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    next();
                    return GLib.SOURCE_REMOVE;
                });
                const scheduleBatched = (next) => GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, TIMEOUTS.UI_BATCH_TINY_MS, () => {
                    next();
                    return GLib.SOURCE_REMOVE;
                });

                let index = 0;
                const loadNext = () => {
                    return index >= programs.length
                        ? onComplete?.()
                        : (() => {
                            const prog = programs[index];
                            index++;
                            const skipProbe = !prog.path || (prog.version && prog.version !== UNKNOWN_VERSION);
                            return skipProbe
                                ? scheduleIdle(loadNext)
                                : this.getProgramVersionAsync(prog.program, prog.path, prog.prefixDir, (version) => {
                                    version && (prog.version = version, onVersionLoaded?.(prog.path, version));
                                    scheduleBatched(loadNext);
                                });
                        })();
                };

                loadNext();
                return undefined;
            })()
            : onComplete?.();
    }

    decodeText(content) {
        return UTF8_DECODER.decode(content);
    }

    readPrefixVersion(programName, prefixDir) {
        const pcPath = prefixDir ? `${prefixDir}/lib/pkgconfig/${programName}.pc` : null;
        return pcPath && GLib.file_test(pcPath, GLib.FileTest.EXISTS)
            ? this.readPkgConfigVersion(pcPath)
            : null;
    }

    runShellVersionProbe(command, context) {
        const result = tryOrNull(context, () => GLib.spawn_command_line_sync(command));
        const [ok, stdout] = result || [];
        const version = result && ok && stdout ? this.decodeText(stdout).trim() : '';
        return version.length > 0 ? version : null;
    }

    quoteArg(arg) {
        const escaped = String(arg).replace(/'/g, '\'\\\'\'');
        return `'${escaped}'`;
    }

    buildVersionProbeCommand(binaryPath, args = []) {
        return `${Commands.BASH} -c "timeout 1 '${binaryPath}' ${args.map(arg => this.quoteArg(arg)).join(' ')} 2>/dev/null | head -1"`;
    }

    readVersionFromBinaryProbe(binaryPath, programName, args = []) {
        const output = this.runShellVersionProbe(
            this.buildVersionProbeCommand(binaryPath, args),
            `getVersion.${args.join(' ') || 'probe'}`
        );
        return output ? this.extractVersionFromOutput(output, programName) : null;
    }

    readPacmanVersionSync(programName) {
        return this.runShellVersionProbe(
            `${Commands.BASH} -c "pacman -Q ${programName} 2>/dev/null | awk '{print $2}'"`,
            'getVersion.pacman'
        );
    }

    readPkgConfigVersion(pcPath) {
        const result = tryOrNull('readPkgConfigVersion', () => GLib.file_get_contents(pcPath));
        const [ok, content] = result || [];
        const text = result && ok && content ? this.decodeText(content) : '';
        const match = text ? text.match(/^Version:\s*(.+)$/m) : null;
        return match ? match[1].trim() : null;
    }

    detectWrapperInfo(filePath) {
        let result = tryOrNull('detectWrapperInfo', () => GLib.file_get_contents(filePath));
        let [ok, content] = result || [];
        let text = result && ok && content ? this.decodeText(content) : '';
        if (!text.includes('LASTLAYER ISOLATION WRAPPER')) return null;
        let realPath = WRAPPER_PATH_EXTRACTORS.map((extract) => extract(text)).find(Boolean) || null;
        return { realPath, target: determineWrapperTarget(realPath) };
    }

    getProgramVersion(programName, binaryPath, prefixDir) {
        const prefixVersion = this.readPrefixVersion(programName, prefixDir);
        const canProbeBinary = !prefixVersion && binaryPath && GLib.file_test(binaryPath, GLib.FileTest.IS_EXECUTABLE);
        const binaryVersion = canProbeBinary
            ? GENERIC_VERSION_ARG_SETS
                .map((args) => this.readVersionFromBinaryProbe(binaryPath, programName, args))
                .find(Boolean) || null
            : null;
        return prefixVersion
            || binaryVersion
            || this.readPacmanVersionSync(programName)
            || this.getSpecificProgramVersion(programName, binaryPath)
            || null;
    }

    extractVersionFromOutput(output, programName) {
        return (!output || output.length === 0) ? null : VERSION_OUTPUT_PATTERNS
            .map((pickVersion) => pickVersion(output, programName))
            .find(Boolean) || null;
    }

    getSpecificProgramVersion(programName, binaryPath) {
        const probe = SPECIFIC_VERSION_PROBES[String(programName || '').toLowerCase()];
        return typeof probe === 'function'
            ? this.runShellVersionProbe(probe(binaryPath), `specificVersion.${programName}`)
            : null;
    }
}

export function applyAdvancedTabDependencyIsolationOpsVersions(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationOpsVersions.prototype);
}
