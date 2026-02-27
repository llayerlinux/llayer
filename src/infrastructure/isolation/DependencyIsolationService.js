import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../constants/Commands.js';
import { tryOrNull } from '../utils/ErrorUtils.js';
import { fileExists, isDir, decodeBytes } from '../utils/Utils.js';

export class DependencyIsolationService {
    constructor({execAsync = null, legacySettingsStorage = null, settingsManager = null, logger = null} = {}) {
        this.execAsync = execAsync || this.execDirect;
        this.legacySettingsStorage = legacySettingsStorage || null;
        this.settingsManager = settingsManager || null;
        this.logger = logger || null;
        this.homeDir = GLib.get_home_dir();
        this.baseProgramsDir = `${this.homeDir}/.local/share/lastlayer/programs`;
    }

    getGroupingMode() {
        return this.settingsManager?.read?.()?.isolation_grouping_mode || 'hybrid';
    }

    getInstallPath(programName, version, riceName = null) {
        const mode = this.getGroupingMode();

        switch (mode) {
            case 'per-rice':
                return `${this.baseProgramsDir}/rices/${riceName || (() => {
                    throw new Error('riceName required for per-rice mode');
                })()}`;

            case 'per-program':
                return `${this.baseProgramsDir}/${programName}/${version || 'latest'}`;

            case 'hybrid':
            default:
                return `${this.baseProgramsDir}/shared/${programName}/${version || 'latest'}`;
        }
    }

    getVenvPath(riceName) {
        return `${this.baseProgramsDir}/rices/${riceName}/venv`;
    }

    findProgram(programName, version = null, riceName = null) {
        const mode = this.getGroupingMode(),
            notFound = {found: false, path: null, version: null};

        if (mode === 'per-rice') {
            if (!riceName) return notFound;
            let ricePath = `${this.baseProgramsDir}/rices/${riceName}`;
            return fileExists(`${ricePath}/bin/${programName}`)
                ? { found: true, path: ricePath, version: 'rice-local' }
                : notFound;
        }

        let searchBase = mode === 'hybrid'
            ? `${this.baseProgramsDir}/shared/${programName}`
            : `${this.baseProgramsDir}/${programName}`;

        if (!isDir(searchBase)) return notFound;

        if (version) {
            return isDir(`${searchBase}/${version}`)
                ? { found: true, path: `${searchBase}/${version}`, version }
                : notFound;
        }

        let enumerator = tryOrNull('findProgram.enumerate', () =>
            Gio.File.new_for_path(searchBase).enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
        );
        if (!enumerator) return notFound;

        let versions = [], info;
        while ((info = enumerator.next_file(null)) !== null) {
            info.get_file_type() === Gio.FileType.DIRECTORY && versions.push(info.get_name());
        }
        if (!versions.length) return notFound;

        versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        return {
            found: true,
            path: `${searchBase}/${versions[0]}`,
            version: versions[0]
        };
    }

    hasVenv(riceName) {
        return fileExists(`${this.getVenvPath(riceName)}/bin/activate`);
    }

    getIsolatedEnv(riceName, programs = []) {
        const env = {},
            pathParts = [],
            venvPath = this.getVenvPath(riceName);
        this.hasVenv(riceName) && (
            pathParts.push(`${venvPath}/bin`),
            env.VIRTUAL_ENV = venvPath,
            env.activateVenv = `source ${venvPath}/bin/activate`
        );

        for (const prog of programs) {
            const programPath = this.findProgram(prog, null, riceName).path;
            programPath && pathParts.push(`${programPath}/bin`);
        }

        pathParts.length > 0 && (env.PATH = pathParts.join(':') + ':$PATH');

        return env;
    }

    async execDirect(argv) {
        return new Promise((complete) => {
            const proc = GLib.spawn_async_with_pipes(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
            const [, , stdoutFd, stderrFd] = proc;
            const stdout = GLib.IOChannel.unix_new(stdoutFd).read_to_end(null)[1] || '';
            const stderr = GLib.IOChannel.unix_new(stderrFd).read_to_end(null)[1] || '';
            complete({stdout, stderr});
        });
    }

    async listPrograms() {
        if (!Gio.File.new_for_path(this.baseProgramsDir).query_exists(null)) return [];
        let programs = [],
            enumerator = Gio.File.new_for_path(this.baseProgramsDir)
                .enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null),
            info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;

            let programDir = `${this.baseProgramsDir}/${info.get_name()}`,
                versionEnumerator = Gio.File.new_for_path(programDir)
                    .enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null),
                versionInfo, hasVersions = false;
            while ((versionInfo = versionEnumerator.next_file(null)) !== null) {
                if (versionInfo.get_file_type() !== Gio.FileType.DIRECTORY) continue;
                hasVersions = true;
                let fullPath = `${programDir}/${versionInfo.get_name()}`;
                programs.push({program: info.get_name(), version: versionInfo.get_name(), path: fullPath,
                    size: await this.getDirectorySize(fullPath), installedAt: await this.readInstallDate(fullPath)});
            }

            !hasVersions && programs.push({
                program: info.get_name(), version: null, path: programDir,
                size: await this.getDirectorySize(programDir), installedAt: await this.readInstallDate(programDir)
            });
        }

        return programs;
    }

    async deleteProgram(programPath) {
        if (!programPath) return false;
        await this.execAsync([Commands.RM, '-rf', programPath]);
        return true;
    }

    async listProcesses() {
        let [ok, stdout] = GLib.spawn_command_line_sync(
            "bash -c \"ps aux | grep -E '\\/.local/share/lastlayer/programs/' | grep -v grep\""
        );
        if (!ok) return [];

        let output = decodeBytes(stdout);
        if (!output.trim()) return [];

        return output.split(/\r?\n/).filter(Boolean).map((line) => {
            let parts = line.trim().split(/\s+/),
                command = line.substring(line.indexOf(parts[10] || '')).trim();
            return {
                pid: parts[1] || '',
                user: parts[0] || '',
                command,
                prefix: (command.match(/\/.local\/share\/lastlayer\/programs\/[\w.-]+\/[\w.-]+/) || [''])[0]
            };
        });
    }

    async terminateProcess(pid) {
        await this.execAsync([Commands.KILL, '-9', String(pid)]);
        return true;
    }

    async togglePatchPostinstall(enabled) {
        const snapshot = this.legacySettingsStorage.read() ?? {};
        snapshot.patch_postinstall_scripts = !!enabled;
        this.legacySettingsStorage.write(snapshot);
        return true;
    }

    async getDirectorySize(path) {
        const result = await this.execAsync([Commands.DU, '-sh', path]);
        if (!result) return 'unknown';
        const stdout = typeof result === 'object' ? (result.stdout || '') : String(result || '');
        const size = stdout.split('\t')[0]?.trim();
        return size || 'unknown';
    }

    async readInstallDate(path) {
        const dateFile = Gio.File.new_for_path(`${path}/.install_date`);
        if (!dateFile.query_exists(null)) return null;
        const [ok, content] = GLib.file_get_contents(dateFile.get_path());
        return ok ? decodeBytes(content).trim() : null;
    }
}
