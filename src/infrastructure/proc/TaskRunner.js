import GLib from 'gi://GLib';
import {decodeBytes} from '../utils/Utils.js';

export const TaskStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    TIMEOUT: 'timeout'
};

const DEFAULT_COMMAND_WHITELIST = [
    'bash', 'sh', 'echo', 'cat', 'ls', 'pwd', 'which', 'test',
    'cp', 'mv', 'rm', 'mkdir', 'chmod', 'chown',
    'git',
    'tar', 'gzip', 'gunzip', 'zip', 'unzip',
    'curl', 'wget',
    'grep', 'sed', 'awk', 'cut', 'sort', 'uniq',
    'uname', 'hostname', 'whoami', 'id', 'ps', 'pgrep', 'pkill',
    'hyprctl', 'swww',
    'notify-send', 'dbus-send',
    'paplay', 'aplay', 'ffplay', 'mplayer',
    'systemctl', 'journalctl', 'jq', 'kill'
];

const SPAWN_FLAGS = GLib.SpawnFlags.SEARCH_PATH
    | GLib.SpawnFlags.STDERR_TO_DEV_NULL
    | GLib.SpawnFlags.STDOUT_TO_DEV_NULL;

export class Task {
    constructor(options) {
        this.id = options.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        this.command = options.command;
        this.args = options.args ?? [];
        this.cwd = options.cwd || null;
        this.env = options.env ?? {};
        this.timeout = options.timeout || 0;
        this.critical = options.critical || false;
        this.retries = options.retries || 0;
        this.maxRetries = options.maxRetries || 0;
        this.status = TaskStatus.PENDING;
        this.startTime = null;
        this.endTime = null;
        this.result = null;
        this.error = null;
        this.pid = null;
        this.onProgress = options.onProgress || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
    }

    getFullCommand() {
        return [this.command, ...this.args].join(' ');
    }

    getDuration() {
        return this.startTime ? (this.endTime || Date.now()) - this.startTime : 0;
    }
}

export class TaskRunner {
    constructor(logger = null, eventBus = null, translator = null) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.translator = translator || ((k) => k);
        this.normalQueue = [];
        this.criticalQueue = [];
        this.runningTasks = new Map();
        this.maxConcurrentTasks = 3;
        this.currentTasks = 0;
        this.criticalTaskRunning = false;
        this.defaultTimeout = 30000;
        this.commandWhitelist = new Set(DEFAULT_COMMAND_WHITELIST);
    }

    buildEnv(task) {
        const systemEnv = {
            HOME: GLib.get_home_dir(),
            USER: GLib.get_user_name(),
            PATH: GLib.getenv('PATH') || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            SHELL: GLib.getenv('SHELL') || '/bin/bash',
            PWD: task.cwd || GLib.get_current_dir(),
            TERM: GLib.getenv('TERM') || 'xterm-256color',
            DISPLAY: GLib.getenv('DISPLAY') || ':1',
            WAYLAND_DISPLAY: GLib.getenv('WAYLAND_DISPLAY') || 'wayland-1',
            XDG_RUNTIME_DIR: GLib.getenv('XDG_RUNTIME_DIR') || '/run/user/1000',
            XDG_SESSION_TYPE: GLib.getenv('XDG_SESSION_TYPE') || 'wayland',
            HYPRLAND_INSTANCE_SIGNATURE: GLib.getenv('HYPRLAND_INSTANCE_SIGNATURE') || '',
            XDG_CURRENT_DESKTOP: GLib.getenv('XDG_CURRENT_DESKTOP') || 'Hyprland'
        };
        return Object.entries({...systemEnv, ...task.env}).map(([k, v]) => `${k}=${v}`);
    }

    addIoWatch(channel, stream, onData) {
        return GLib.io_add_watch(
            channel,
            GLib.PRIORITY_DEFAULT,
            GLib.IOCondition.IN | GLib.IOCondition.HUP,
            (ch, condition) => {
                (condition & GLib.IOCondition.IN) && (() => {
                    const [status, data] = ch.read_line();
                    (status === GLib.IOStatus.NORMAL && data) && onData(decodeBytes(data), stream);
                })();
                return true;
            }
        );
    }

    checkCommandSafety(command, _args = []) {
        return this.commandWhitelist.has(command)
            ? {safe: true}
            : {safe: false, reason: this.translator('TASK_NOT_WHITELISTED', `Command '${command}' is not whitelisted`)};
    }

    createTask(options) {
        const safetyCheck = this.checkCommandSafety(options.command, options.args);
        return safetyCheck.safe ? new Task({
            ...options,
            timeout: options.timeout || this.defaultTimeout
        }) : null;
    }

    enqueue(taskOptions) {
        return new Promise((complete, fail) => {
            const task = this.createTask(taskOptions);
            if (!task) {
                complete({success: false, error: 'Unsafe command'});
                return;
            }
            task.finish = complete;
            task.reject = fail;
            (task.critical ? this.criticalQueue : this.normalQueue).push(task);
            this.processQueue();
        });
    }

    processQueue() {
        if (this.criticalQueue.length > 0 && !this.criticalTaskRunning) {
            this.criticalTaskRunning = true;
            this.executeTask(this.criticalQueue.shift());
            return;
        }
        while (this.normalQueue.length > 0 && this.currentTasks < this.maxConcurrentTasks) {
            const task = this.normalQueue.shift();
            this.executeTask(task);
        }
    }

    async executeTask(task) {
        task.status = TaskStatus.RUNNING;
        task.startTime = Date.now();
        this.runningTasks.set(task.id, task);
        this.currentTasks++;

        let timeoutId = null;
        task.timeout > 0 && (timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, task.timeout, () => {
            this.cancelTask(task.id, 'timeout');
            return GLib.SOURCE_REMOVE;
        }));

        const result = await this.runCommand(task);
        timeoutId && GLib.source_remove(timeoutId);
        task.status = TaskStatus.COMPLETED;
        task.result = result;
        task.endTime = Date.now();
        task.onComplete && task.onComplete(result);
        task.finish(result);

        this.runningTasks.delete(task.id);
        this.currentTasks--;
        task.critical && (this.criticalTaskRunning = false);
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.processQueue();
            return false;
        });
    }

    runCommand(task) {
        return new Promise((complete) => {
            let argv = [task.command, ...task.args],
                envp = this.buildEnv(task);

            const [success, child_pid, , child_stdout, child_stderr] =
                GLib.spawn_async_with_pipes(
                    task.cwd,
                    argv,
                    envp,
                    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                    null
                );

            if (!success) {
                task.status = TaskStatus.FAILED;
                task.result = {success: false, error: `Failed to start process: ${argv.join(' ')}`};
                task.finish(task.result);
                return;
            }

            task.pid = child_pid;

            let stdoutChannel = GLib.IOChannel.unix_new(child_stdout),
                stderrChannel = GLib.IOChannel.unix_new(child_stderr);

            let stdoutData = '';
            let stderrData = '';

            const onData = (data, stream) => {
                stream === 'stdout' ? (stdoutData += data) : (stderrData += data);
                task.onProgress && task.onProgress({type: stream, data});
            };

            const stdoutWatch = this.addIoWatch(stdoutChannel, 'stdout', onData);
            const stderrWatch = this.addIoWatch(stderrChannel, 'stderr', onData);

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, child_pid, (_pid, status) => {
                GLib.source_remove(stdoutWatch);
                GLib.source_remove(stderrWatch);
                stdoutChannel.close();
                stderrChannel.close();
                const exitCode = GLib.spawn_check_exit_status(status) ? 0 : 1;
                complete({
                    exitCode,
                    stdout: stdoutData,
                    stderr: stderrData,
                    duration: task.getDuration(),
                    success: exitCode === 0
                });
            });
        });
    }

    cancelTask(taskId, reason = 'cancelled') {
        const task = this.runningTasks.get(taskId);
        if (!task) return false;
        task.status = reason === 'timeout' ? TaskStatus.TIMEOUT : TaskStatus.CANCELLED;
        task.endTime = Date.now();
        task.pid && (
            GLib.spawn_sync(
                null,
                ['kill', '-TERM', task.pid.toString()],
                null,
                SPAWN_FLAGS,
                null
            ),
            GLib.spawn_sync(
                null,
                ['kill', '-KILL', task.pid.toString()],
                null,
                SPAWN_FLAGS,
                null
            )
        );
        task.onError && task.onError(new Error(`Task ${reason}: ${task.getFullCommand()}`));
        task.reject(new Error(`Task ${reason}`));
        return true;
    }

    cancelAllTasks() {
        for (const [taskId] of this.runningTasks) {
            this.cancelTask(taskId, 'shutdown');
        }
        this.normalQueue.length = 0;
        this.criticalQueue.length = 0;
    }

    async run(command, args = [], options = {}) {
        return this.enqueue({command, args, ...options});
    }

}
