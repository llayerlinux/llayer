import {copyPrototypeDescriptors} from '../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';
import { decodeBytes } from '../infrastructure/utils/Utils.js';
import { tryOrDefault, tryOrFalse, tryOrNull, tryRun } from '../infrastructure/utils/ErrorUtils.js';
import { TIMEOUTS } from '../infrastructure/constants/Timeouts.js';

const LASTLAYER_PGREP_PATTERNS = [
    'pgrep -f "gjs.*src/app/main.js"',
    'pgrep -f "src/app/main.js"'
];

class AppInstanceManager {
    isPositivePid(pid) {
        return Number.isFinite(pid) && pid > 0;
    }

    getInstancePidPath() {
        const configDir = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'lastlayer']);
        const pidPath = GLib.build_filenamev([configDir, 'lastlayer.pid']);
        const legacyLockPath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer', 'instance.lock']);
        return {configDir, pidPath, legacyLockPath};
    }

    readPidFile(path) {
        const result = tryOrNull('readPidFile', () => GLib.file_get_contents(path));
        const [ok, content] = result || [];
        if (!ok || !content) return null;
        const pid = parseInt(decodeBytes(content).trim().split(/\s+/)[0] || '', 10);
        return this.isPositivePid(pid) ? pid : null;
    }

    getCurrentPid() {
        const glibPid = typeof GLib.get_pid === 'function' ? GLib.get_pid() : 0;
        const result = tryOrNull('getCurrentPid', () => GLib.file_get_contents('/proc/self/stat'));
        const [ok, content] = result || [];
        const pidFromStat = ok && content ? parseInt(decodeBytes(content).split(' ')[0], 10) : 0;
        return [System?.pid, glibPid, pidFromStat].find((pid) => this.isPositivePid(pid)) || 0;
    }

    readProcessEnv(pid) {
        const [ok, content] = tryOrNull('readProcessEnv', () => GLib.file_get_contents(`/proc/${pid}/environ`)) || [];
        if (!ok || !content) return {};

        return Object.fromEntries(
            decodeBytes(content).split('\0')
                .filter(p => p.includes('='))
                .map(pair => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)])
        );
    }

    isSameDisplaySession(pid) {
        const env = this.readProcessEnv(pid),
            pairs = [
                ['DISPLAY', GLib.getenv('DISPLAY')],
                ['WAYLAND_DISPLAY', GLib.getenv('WAYLAND_DISPLAY')],
                ['XDG_RUNTIME_DIR', GLib.getenv('XDG_RUNTIME_DIR')]
            ];
        return pairs.every(([key, currentValue]) =>
            !currentValue || !env[key] || env[key] === currentValue
        );
    }

    readProcFile(pid, name) {
        const [ok, content] = tryOrDefault(
            `isLastLayerPid.${name}`,
            () => GLib.file_get_contents(`/proc/${pid}/${name}`),
            [false, null]
        );
        return ok && content ? decodeBytes(content) : '';
    }

    isLastLayerPid(pid) {
        if (!this.isPositivePid(pid)) return false;

        const proc = {
            cmdline: this.readProcFile(pid, 'cmdline').replace(/\0/g, ' ').trim().toLowerCase(),
            comm: this.readProcFile(pid, 'comm').trim().toLowerCase(),
            exe: (tryOrDefault('isLastLayerPid.readExeLink', () => GLib.file_read_link(`/proc/${pid}/exe`), '')
                .toLowerCase().split('/').pop()) || ''
        };

        return ['gjs', 'gjs-console'].some(n => n === proc.comm || n === proc.exe)
            && proc.cmdline.includes('src/app/main.js')
            && this.isSameDisplaySession(pid);
    }

    isPidAlive(pid) {
        return this.isPositivePid(pid) && Gio.File.new_for_path(`/proc/${pid}`).query_exists(null);
    }

    iterateLastLayerPids(callback, context = 'iterateLastLayerPids') {
        return LASTLAYER_PGREP_PATTERNS.some((pattern) => {
            const [ok, stdout] = tryOrNull(context, () => GLib.spawn_command_line_sync(pattern)) || [];
            let pidStrings = (ok && stdout?.length)
                ? decodeBytes(stdout).trim().split('\n').filter(Boolean)
                : [];
            return pidStrings.some((pidString) => {
                let pid = parseInt(pidString, 10);
                return this.isPositivePid(pid) && callback(pid) === true;
            });
        });
    }

    writeInstancePid() {
        const {configDir, pidPath} = this.getInstancePidPath();
        tryRun('writeInstancePid.mkdir', () => Gio.File.new_for_path(configDir).make_directory_with_parents(null));
        const pid = this.getCurrentPid();
        pid && GLib.file_set_contents(pidPath, `${pid}\n`);
        this.instancePidPath = pidPath;
    }

    releaseInstancePid() {
        if (!this.instancePidPath) return;
        tryRun('releaseInstancePid', () => Gio.File.new_for_path(this.instancePidPath).delete(null));
        this.instancePidPath = null;
    }

    getLockFilePath() {
        return this.lockFilePath;
    }

    getCommandFilePath() {
        return this.commandFilePath;
    }

    createLockFile() {
        const lockFile = this.getLockFilePath(), pid = this.getCurrentPid();
        tryRun('createLockFile.mkdir', () =>
            ((d) => d.query_exists(null) || d.make_directory_with_parents(null))(
                Gio.File.new_for_path(GLib.path_get_dirname(lockFile))));

        let createResult = tryOrNull('createLockFile.create', () => {
            let file = Gio.File.new_for_path(lockFile),
                existingPid = file.query_exists(null) && this.readPidFile(lockFile);
            if (existingPid && existingPid !== pid && this.isPidAlive(existingPid) && this.isLastLayerPid(existingPid))
                return {ok: false, reason: 'already-running'};

            file.query_exists(null) && this.tryDeleteFile(file, 'createLockFile.removeStale');
            if (file.query_exists(null)) return {ok: false, reason: 'cannot-remove-stale'};

            return ((s) => (s.write(`${pid}`, null), s.close(null), {ok: true, reason: 'created'}))(
                file.create(Gio.FileCreateFlags.NONE, null));
        });

        return createResult?.ok || (createResult?.reason !== 'already-running'
            && tryRun('createLockFile.fallback', () => GLib.file_set_contents(lockFile, `${pid}`)));
    }

    removeLockFile() {
        tryRun('removeLockFile', () => {
            const file = Gio.File.new_for_path(this.getLockFilePath());
            file.query_exists(null) && file.delete(null);
        });
    }

    tryDeleteFile(file, context) {
        tryRun(context, () => file.delete(null));
    }

    toggleExistingOrStaleCleanup(command = 'toggle') {
        let {pidPath, legacyLockPath} = this.getInstancePidPath();
        let [lockFile, commandFile, currentPid] = [this.getLockFilePath(), this.getCommandFilePath(), this.getCurrentPid()];

        let sendCommandAndVerify = () => tryOrFalse('sendCommandAndVerify', () => {
            GLib.file_set_contents(commandFile, command);
            GLib.usleep(TIMEOUTS.TOGGLE_VERIFY_USEC);
            let cmdFile = Gio.File.new_for_path(commandFile);
            if (!cmdFile.query_exists(null)) return true;
            GLib.usleep(TIMEOUTS.TOGGLE_EXTRA_USEC);
            if (!cmdFile.query_exists(null)) return true;
            this.tryDeleteFile(cmdFile, 'sendToggleAndVerify.cleanup');
            return false;
        });

        let tryPid = (pid) => {
            if (!pid || pid === currentPid || !this.isLastLayerPid(pid)) return false;
            let toggled = sendCommandAndVerify();
            this.debugStartup('toggleExisting:tryPid', {pid, toggled});
            return toggled;
        };

        let getFileAgeSec = (filePath) => tryOrDefault('isFileTooOld', () => {
            let file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) return Infinity;
            let info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
            return Math.floor(Date.now() / 1000) - (info.get_modification_date_time()?.to_unix?.()
                || Math.floor(info.get_modification_time?.()?.tv_sec || 0));
        }, Infinity);

        let shouldDeleteAsStale = (filePath) => {
            if (getFileAgeSec(filePath) > TIMEOUTS.LOCK_MAX_AGE_SEC) return true;
            let pid = this.readPidFile(filePath);
            return !pid || (pid !== currentPid && !(this.isPidAlive(pid) && this.isLastLayerPid(pid)));
        };

        let tryPidFromFile = (filePath, staleContext, context) => tryOrDefault(context, () => {
            let file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) return false;
            if (shouldDeleteAsStale(filePath)) { this.tryDeleteFile(file, staleContext); return false; }
            return tryPid(this.readPidFile(filePath));
        }, false);

        return this.iterateLastLayerPids((pid) => tryPid(pid), 'toggleExisting.pgrep')
            || [
                [lockFile, 'toggleExisting.staleLock', 'toggleExisting.lockFile'],
                [pidPath, 'toggleExisting.stalePid', 'toggleExisting.pidPath'],
                [legacyLockPath, 'toggleExisting.staleLegacy', 'toggleExisting.legacyLock']
            ].some(([filePath, staleContext, context]) => tryPidFromFile(filePath, staleContext, context));
    }

    hasOtherLastLayerInstance() {
        const currentPid = this.getCurrentPid();
        return this.iterateLastLayerPids(
            (pid) => pid !== currentPid && this.isLastLayerPid(pid),
            'hasOtherLastLayerInstance'
        );
    }

    startLockUpdater() {
        this.lockUpdaterId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.LOCK_UPDATE_INTERVAL_MS, () => {
            tryRun('startLockUpdater', () => {
                const lockPath = this.getLockFilePath();
                const [ok, content] = (Gio.File.new_for_path(lockPath).query_exists(null)
                    && tryOrNull('startLockUpdater.read', () => GLib.file_get_contents(lockPath))) || [];
                ok && GLib.file_set_contents(lockPath, decodeBytes(content));
            });
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopLockUpdater() {
        if (!this.lockUpdaterId) return;
        tryRun('stopLockUpdater', () => GLib.source_remove(this.lockUpdaterId));
        this.lockUpdaterId = null;
    }

    toggleMainWindow() {
        if (this.themeSelectorView?.toggle) return this.themeSelectorView.toggle();

        const win = this.container?.has?.('mainWindow') ? this.container.get('mainWindow') : null;
        if (!win) return;
        win.get_visible?.() ? win.hide?.() : (win.show_all?.(), win.present?.());
    }

    showMainWindow() {
        const showWindow = (win) => win && (win.show_all?.(), win.present?.(), true);

        showWindow(this.themeSelectorView?.window)
            || (typeof this.themeSelectorView?.show === 'function' && (
                this.themeSelectorView.show(),
                showWindow(this.themeSelectorView?.window)
            ))
            || showWindow(this.container?.has?.('mainWindow') && this.container.get('mainWindow'));
    }

    startCommandListener() {
        let commandFile = this.getCommandFilePath();
        let lastToggleTime = 0;
        let commandHandlers = {
            toggle: () => this.toggleMainWindow(),
            show: () => this.showMainWindow()
        };

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.INITIALIZATION_DELAY_MS, () => {
            this.isWindowReady = true;
            return GLib.SOURCE_REMOVE;
        });

        this.commandListenerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.COMMAND_POLL_INTERVAL_MS, () => {
            tryRun('commandListener', () => {
                let file = Gio.File.new_for_path(commandFile);
                if (!file.query_exists(null)) return;

                let [ok, content] = tryOrNull('commandListener.read', () => GLib.file_get_contents(commandFile)) || [];
                if (!ok) return;

                let command = decodeBytes(content).trim();
                let handler = commandHandlers[command];
                if (!handler) { file.delete(null); return; }
                if (!this.isWindowReady) return;

                file.delete(null);
                if (command === 'toggle' && Date.now() - lastToggleTime < TIMEOUTS.TOGGLE_COOLDOWN_MS) return;
                lastToggleTime = Date.now();
                handler();
            });
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopCommandListener() {
        if (!this.commandListenerId) return;
        tryRun('stopCommandListener', () => GLib.source_remove(this.commandListenerId));
        this.commandListenerId = null;
    }
}

export function applyAppInstanceManager(prototype) {
    copyPrototypeDescriptors(prototype, AppInstanceManager.prototype);
}
