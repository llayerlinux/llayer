import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Commands} from '../../infrastructure/constants/Commands.js';
import {tryOrNull, tryRun} from '../../infrastructure/utils/ErrorUtils.js';

const DELAYS = {
    SWWW_RESTART_MS: 1500,
    POST_INIT_MS: 1500,
    CLEANUP_MS: 300
};

const CLEANUP = {
    STUCK_SCRIPTS: ['controls.sh', 'expand'],
    AGS_EXACT: ['agsv1', 'ags'],
    AGS_PATTERN: ['ags-yorha'],
    MEMORY_THRESHOLD_KB: 1000000
};

export class FixHyprlandUseCase {
    constructor(container) {
        this.container = container;
        this.logger = container.has?.('logger') ? container.get('logger') : null;
        this.settingsService = container.has?.('settingsService') ? container.get('settingsService') : null;
        this.applyThemeUseCase = container.has?.('applyThemeUseCase') ? container.get('applyThemeUseCase') : null;
        this.soundService = container.has?.('soundService') ? container.get('soundService') : null;
        this.home = GLib.get_home_dir();
    }

    execute(options = {}) {
        const {playSound = true, settingsThemeHint = null, deepClean = true} = options;

        this.log('Starting Hyprland fix...');

        deepClean && this.performDeepCleanup();

        this.checkDependencies();
        this.reloadHyprlandConfig();
        this.restartSwwwDaemon();

        GLib.usleep(DELAYS.POST_INIT_MS * 1000);

        const currentThemeName = this.getCurrentThemeName(settingsThemeHint);
        const hasTheme = currentThemeName && currentThemeName !== 'default';
        const themeReapplied = hasTheme ? this.reapplyTheme(currentThemeName) : false;

        playSound && this.soundService?.playSound?.('installed.wav');

        this.log('Hyprland fix completed');

        return {
            success: true,
            themeReapplied,
            currentThemeName: hasTheme ? currentThemeName : null
        };
    }

    decodeOutput(stdout) {
        return stdout ? new TextDecoder().decode(stdout).trim() : '';
    }

    performDeepCleanup() {
        this.log('Performing deep cleanup...');

        this.killZombieParents();
        this.killStuckScripts();
        this.cleanupAgsProcesses();
        this.killMemoryLeakingGjs();
        this.cleanupAgsDbus();
        this.resetReservedSpace();
        this.cleanupPlugins();

        GLib.usleep(DELAYS.CLEANUP_MS * 1000);
        this.log('Deep cleanup completed');
    }

    killZombieParents() {
        const zombiePids = this.shellOutput('ps aux | grep -E \'Z|defunct\' | grep -v grep | awk \'{print $2}\'');
        for (const zombiePid of (zombiePids || '').split('\n').filter(Boolean)) {
            const ppid = this.shellOutput(`ps -o ppid= -p ${zombiePid} 2>/dev/null | tr -d ' '`);
            const state = this.shellOutput(`ps -o stat= -p ${ppid} 2>/dev/null`);
            switch (true) {
            case !ppid || ppid === '1' || ppid === '0':
                continue;
            case state?.includes('T') || state?.includes('Z'):
                this.execSafe([Commands.KILL, '-9', ppid]);
                this.log(`Killed stopped parent ${ppid} of zombie ${zombiePid}`);
                break;
            default:
                break;
            }
        }
    }

    killStuckScripts() {
        for (const pattern of CLEANUP.STUCK_SCRIPTS) {
            this.execSafe([Commands.PKILL, '-9', '-f', pattern]);
        }
        this.log('Killed stuck scripts');
    }

    cleanupAgsProcesses() {
        for (const name of CLEANUP.AGS_EXACT) {
            this.execSafe([Commands.PKILL, '-x', name]);
        }
        for (const pattern of CLEANUP.AGS_PATTERN) {
            this.execSafe([Commands.PKILL, '-f', pattern]);
        }
        this.log('AGS processes cleaned up');
    }

    killMemoryLeakingGjs() {
        const pids = this.shellOutput(
            `ps -eo pid,rss,comm | grep gjs | awk '$2 > ${CLEANUP.MEMORY_THRESHOLD_KB} {print $1}'`
        );
        const myPid = String(new Gio.Credentials().get_unix_pid());
        for (const pid of (pids || '').split('\n').filter(Boolean)) {
            pid === myPid || (
                this.execSafe([Commands.KILL, '-9', pid]),
                this.log(`Killed memory-leaking GJS process ${pid}`)
            );
        }
    }

    cleanupAgsDbus() {
        this.execSafe([
            Commands.BASH, '-c',
            'gdbus call --session --dest com.github.Aylur.ags ' +
            '--object-path /com/github/Aylur/ags/Application ' +
            '--method com.github.Aylur.ags.Application.Quit 2>/dev/null || true'
        ]);
        this.log('D-Bus AGS services cleaned up');
    }

    resetReservedSpace() {
        this.execSafe([Commands.HYPRCTL, 'keyword', 'monitor', ',addreserved,0,0,0,0']);
        this.log('Reserved space reset');
    }

    cleanupPlugins() {
        const plugins = ['/lib/hyprland-plugins/hyprbars.so', '/usr/lib/hyprland-plugins/hyprbars.so'];
        for (const plugin of plugins) {
            this.execSafe([Commands.HYPRCTL, 'plugin', 'unload', plugin]);
        }
        this.log('Plugins unloaded');
    }

    checkDependencies() {
        this.execSync([Commands.WHICH, Commands.HYPRCTL]);
        this.execSync([Commands.WHICH, Commands.SWWW]);
    }

    reloadHyprlandConfig() {
        this.execSync([Commands.HYPRCTL, 'reload']);
    }

    killConflictingWallpaperDaemons() {
        const conflictingDaemons = ['swaybg', 'hyprpaper'];
        for (const daemon of conflictingDaemons) {
            this.execSafe([Commands.PKILL, '-9', '-x', daemon]);
        }
        this.log('Killed conflicting wallpaper daemons');
    }

    restartSwwwDaemon() {
        const uid = new Gio.Credentials().get_unix_user();
        const socketPath = `/run/user/${uid}/swww-wayland-1.socket`;

        this.killConflictingWallpaperDaemons();

        for (let attempt = 1; attempt <= 3; attempt++) {
            this.log(`Starting swww-daemon (attempt ${attempt}/3)`);

            this.execSafe([Commands.PKILL, '-9', '-f', Commands.SWWW_DAEMON]);
            GLib.usleep(500 * 1000);

            this.cleanupSocket(socketPath);
            this.spawnSwwwInit();

            GLib.usleep(DELAYS.SWWW_RESTART_MS * 1000);
            const isRunning = this.isSwwwRunning();
            if (isRunning) {
                return this.log(`swww-daemon started successfully on attempt ${attempt}`), true;
            }
            this.log(`swww-daemon failed to start on attempt ${attempt}`);
        }

        this.log('Failed to start swww-daemon after all retries');
        return false;
    }

    cleanupSocket(socketPath) {
        const socketFile = Gio.File.new_for_path(socketPath);
        const deleted = socketFile.query_exists(null) && tryRun('cleanupSocket', () => {
            socketFile.delete(null);
        });
        deleted && this.log(`Cleaned up stale socket: ${socketPath}`);
    }

    isSwwwRunning() {
        return ((result) => result ? result.exitStatus === 0 && result.outputSize > 0 : false)(
            tryOrNull('isSwwwRunning', () => {
                const proc = new Gio.Subprocess({
                    argv: [Commands.SWWW, 'query'],
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
                });
                proc.init(null);
                const [, stdout] = proc.communicate(null, null);
                proc.wait(null);
                return {exitStatus: proc.get_exit_status(), outputSize: stdout?.get_size() || 0};
            })
        );
    }

    spawnSwwwInit() {
        const [ok, pid] = GLib.spawn_async(
            null,
            [Commands.BASH, '-c', 'RUST_MIN_STACK=8388608 exec swww-daemon --format xrgb'],
            null,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null
        );
        ok && pid && GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {});
    }

    execSync(argv) {
        const proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
        });
        proc.init(null);
        proc.wait(null);
    }

    execSafe(argv) {
        return tryRun('execSafe', () => this.execSync(argv));
    }

    shellOutput(cmd) {
        const result = tryOrNull('shellOutput', () => GLib.spawn_command_line_sync(`${Commands.BASH} -c "${cmd}"`));
        const [ok, stdout] = result || [];
        return ok ? this.decodeOutput(stdout) : null;
    }

    reapplyTheme(themeName) {
        const result = this.applyThemeUseCase.execute(themeName, {
            isReapplying: true,
            source: 'fix_hyprland'
        });
        return Boolean(result?.success);
    }

    getCurrentThemeName(settingsHint = null) {
        const themeFile = `${this.home}/.config/lastlayer_pref/current_theme`;
        const fileTheme = Gio.File.new_for_path(themeFile).query_exists(null)
            && (() => { const [ok, c] = GLib.file_get_contents(themeFile); return ok ? this.decodeOutput(c) || null : null; })();

        return fileTheme
            || settingsHint
            || ((this.settingsService?.getSettings?.() || this.settingsService?.getAll?.()) ?? {}).theme
            || 'default';
    }

    log(message) {
        this.logger?.info?.(`[FixHyprland] ${message}`);
    }
}
