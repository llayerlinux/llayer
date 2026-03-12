import {copyPrototypeDescriptors} from '../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';
import { decodeBytes } from '../infrastructure/utils/Utils.js';
import { tryOrDefault, tryOrFalse, tryOrNull, tryOrNullAsync, tryRun } from '../infrastructure/utils/ErrorUtils.js';
import { TIMEOUTS } from '../infrastructure/constants/Timeouts.js';
import { Events } from './eventBus.js';

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

    getCommandQueueDir() {
        return this.commandQueueDir
            || GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer_popup_commands']);
    }

    ensureCommandQueueDir() {
        tryRun('ensureCommandQueueDir', () => {
            GLib.mkdir_with_parents(this.getCommandQueueDir(), parseInt('0755', 8));
        });
    }

    createLockFile() {
        const lockFile = this.getLockFilePath();
        const pid = this.getCurrentPid();
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

        if (createResult?.ok) {
            return true;
        }

        return createResult?.reason !== 'already-running'
            && tryRun('createLockFile.fallback', () => GLib.file_set_contents(lockFile, `${pid}`));
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
        const showWindow = (win) => {
            if (!win) {
                return false;
            }

            win.show_all?.();
            win.present?.();
            return true;
        };

        if (showWindow(this.themeSelectorView?.window)) {
            return;
        }
        if (typeof this.themeSelectorView?.show === 'function') {
            this.themeSelectorView.show();
            if (showWindow(this.themeSelectorView?.window)) {
                return;
            }
        }

        showWindow(this.container?.has?.('mainWindow') && this.container.get('mainWindow'));
    }

    getThemeSelectorController() {
        return this.container?.has?.('themeSelectorController')
            ? this.container.get('themeSelectorController')
            : null;
    }

    syncLocalThemesSnapshot(controller, {switchLocal = false} = {}) {
        const localThemes = controller?.themeRepository?.getLocalThemes?.() || null;
        if (!Array.isArray(localThemes)) return null;

        controller.store?.set?.('localThemes', localThemes);
        controller.store?.update?.({totalLocalThemes: localThemes.length});
        controller.store?.notifySubscribers?.('localThemes', localThemes, null);
        switchLocal && controller.view?.updateThemesList?.(localThemes);
        return localThemes;
    }

    selectLocalThemeByName(controller, themeName) {
        if (!themeName) return;

        controller?.store?.setCurrentTheme?.(themeName);
        const currentList = controller?.store?.get?.('localThemes');
        if (!Array.isArray(currentList)) return;

        const match = currentList.find((theme) => theme?.name === themeName);
        match && controller.store?.selectTheme?.(match);
    }

    extractCommandArgument(command) {
        if (!command || typeof command !== 'string') return null;
        const idx = command.indexOf(':');
        if (idx < 0) return null;
        const value = command.slice(idx + 1).trim();
        return value || null;
    }

    parseCommand(command) {
        if (!command || typeof command !== 'string') {
            return {name: null, argument: null};
        }

        const separatorIndex = command.indexOf(':');
        return {
            name: separatorIndex < 0 ? command : command.slice(0, separatorIndex),
            argument: separatorIndex < 0 ? null : this.extractCommandArgument(command)
        };
    }

    refreshLocalThemes({showWindow = false, switchLocal = false, themeName = null} = {}) {
        if (showWindow) {
            this.showMainWindow();
        }
        const controller = this.getThemeSelectorController();
        if (!controller) return;

        if (switchLocal) {
            controller.switchToTab?.('local');
        }
        controller.themeRepository?.clearCache?.();
        this.syncLocalThemesSnapshot(controller, {switchLocal});

        const loadPromise = controller.loadLocalThemes?.({force: true});
        if (loadPromise) {
            tryOrNullAsync('AppInstanceManager.refreshLocalThemes', () => loadPromise);
        }

        this.selectLocalThemeByName(controller, themeName);
    }

    showWindowWithLocalTab(themeName = null) {
        this.refreshLocalThemes({showWindow: true, switchLocal: true, themeName});
    }

    refreshLocalThemesSilent(themeName = null) {
        this.refreshLocalThemes({showWindow: false, switchLocal: false, themeName});
    }

    refreshCurrentTheme(themeName = null) {
        if (!themeName) return;

        const controller = this.getThemeSelectorController();
        controller?.store?.setCurrentTheme?.(themeName);
        controller?.view?.updateCurrentThemeStyles?.(themeName);
    }

    emitThemeUpdated(themeName = null) {
        this.eventBus?.emit?.(Events.THEME_UPDATED, {
            theme: themeName ? {name: themeName} : null
        });
    }

    handleToggleCommand(lastToggleTimeRef) {
        if (!this.isWindowReady) return false;

        const now = Date.now();
        if (now - lastToggleTimeRef.value < TIMEOUTS.TOGGLE_COOLDOWN_MS) {
            return false;
        }

        lastToggleTimeRef.value = now;
        this.toggleMainWindow();
        return true;
    }

    handleShowCommand() {
        if (!this.isWindowReady) return false;
        this.showMainWindow();
        return true;
    }

    handleShowLocalCommand(themeName = null) {
        if (!this.isWindowReady) return false;
        this.showWindowWithLocalTab(themeName);
        return true;
    }

    handleRefreshLocalThemesCommand(themeName = null) {
        if (!this.isWindowReady) return false;
        this.refreshLocalThemesSilent(themeName);
        return true;
    }

    handleRefreshCurrentThemeCommand(themeName = null) {
        if (!this.isWindowReady) return false;
        this.refreshCurrentTheme(themeName);
        return true;
    }

    handleThemeUpdatedCommand(themeName = null) {
        if (!this.isWindowReady) return false;
        this.emitThemeUpdated(themeName);
        this.refreshLocalThemesSilent(themeName);
        return true;
    }

    emitCommandPayload(eventName, payloadText) {
        const payload = payloadText
            ? tryOrNull('AppInstanceManager.emitCommandPayload.parse', () => JSON.parse(payloadText))
            : null;
        this.eventBus?.emit?.(eventName, payload);
        return true;
    }

    handleCommand(command, lastToggleTimeRef) {
        if (!command) return true;

        const parsedCommand = this.parseCommand(command);
        switch (parsedCommand.name) {
        case 'toggle':
            return command === 'toggle' ? this.handleToggleCommand(lastToggleTimeRef) : true;
        case 'show':
            return command === 'show' ? this.handleShowCommand() : true;
        case 'show_local':
            return this.handleShowLocalCommand(parsedCommand.argument);
        case 'refresh_local_silent':
            return this.handleRefreshLocalThemesCommand(parsedCommand.argument);
        case 'refresh_theme':
            return this.handleRefreshCurrentThemeCommand(parsedCommand.argument);
        case 'theme_updated':
            return this.handleThemeUpdatedCommand(parsedCommand.argument);
        case 'wm_conversion_start':
            return command.startsWith('wm_conversion_start:')
                ? this.emitCommandPayload(Events.WM_CONVERSION_START, parsedCommand.argument)
                : true;
        case 'wm_conversion_complete':
            return command.startsWith('wm_conversion_complete:')
                ? this.emitCommandPayload(Events.WM_CONVERSION_COMPLETE, parsedCommand.argument)
                : true;
        default:
            return true;
        }
    }

    drainCommandFile(commandFile, lastToggleTimeRef) {
        const file = Gio.File.new_for_path(commandFile);
        if (!file.query_exists(null)) return;

        const [ok, content] = tryOrNull('commandListener.read', () => GLib.file_get_contents(commandFile)) || [];
        if (!ok) return;

        const command = decodeBytes(content).trim();
        if (!command) {
            tryRun('commandListener.deleteEmptyFile', () => file.delete(null));
            return;
        }

        const handled = this.handleCommand(command, lastToggleTimeRef);
        handled && tryRun('commandListener.deleteFile', () => file.delete(null));
    }

    drainCommandQueue(commandQueueDir, lastToggleTimeRef) {
        const dir = Gio.File.new_for_path(commandQueueDir);
        if (!dir.query_exists(null)) return;

        const names = [];
        const enumerator = tryOrNull(
            'commandListener.queue.enumerate',
            () => dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
        );
        if (!enumerator) return;

        let info = null;
        while ((info = tryOrNull('commandListener.queue.next', () => enumerator.next_file(null))) !== null) {
            if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
            names.push(info.get_name());
        }
        tryRun('commandListener.queue.close', () => enumerator.close(null));
        names.sort();

        names.forEach((name) => {
            const path = GLib.build_filenamev([commandQueueDir, name]);
            const file = Gio.File.new_for_path(path);
            const [ok, content] = tryOrNull('commandListener.queue.read', () => GLib.file_get_contents(path)) || [];
            if (!ok) {
                tryRun('commandListener.queue.deleteUnreadable', () => file.delete(null));
                return;
            }

            const command = decodeBytes(content).trim();
            if (!command) {
                tryRun('commandListener.queue.deleteEmpty', () => file.delete(null));
                return;
            }

            const handled = this.handleCommand(command, lastToggleTimeRef);
            handled && tryRun('commandListener.queue.delete', () => file.delete(null));
        });
    }

    startCommandListener() {
        const commandFile = this.getCommandFilePath();
        const commandQueueDir = this.getCommandQueueDir();
        const lastToggleTimeRef = {value: 0};
        this.ensureCommandQueueDir();

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.INITIALIZATION_DELAY_MS, () => {
            this.isWindowReady = true;
            return GLib.SOURCE_REMOVE;
        });

        this.commandListenerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.COMMAND_POLL_INTERVAL_MS, () => {
            tryRun('commandListener.file', () => this.drainCommandFile(commandFile, lastToggleTimeRef));
            tryRun('commandListener.queue', () => this.drainCommandQueue(commandQueueDir, lastToggleTimeRef));
            return GLib.SOURCE_CONTINUE;
        });
    }

    enqueueCommand(command) {
        if (!command) return;
        tryRun('enqueueCommand', () => {
            this.ensureCommandQueueDir();
            const queueDir = this.getCommandQueueDir();
            const id = typeof GLib.uuid_string_random === 'function'
                ? GLib.uuid_string_random()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const path = GLib.build_filenamev([queueDir, `${Date.now()}-${id}.cmd`]);
            GLib.file_set_contents(path, command);
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
