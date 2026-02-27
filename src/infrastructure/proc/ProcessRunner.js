import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class ProcessRunner {
    constructor(options = {}) {
        this.defaultTimeoutMs = options.defaultTimeoutMs > 0 ? options.defaultTimeoutMs : 30000;
    }

    getTimeoutMs(options) {
        return (typeof options.timeoutMs === 'number' && options.timeoutMs > 0)
            ? options.timeoutMs
            : this.defaultTimeoutMs;
    }

    buildResult({argv, stdout = '', stderr = '', status = -1, success = false, timedOut = false}) {
        const base = {argv, stdout, stderr, status, success};
        return timedOut ? {...base, timedOut: true} : base;
    }

    async run(argv, options = {}) {
        return (Array.isArray(argv) && argv.length > 0)
            ? await (async () => {
                const flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;
                const launcher = new Gio.SubprocessLauncher({flags});

                options.cwd && launcher.set_cwd(options.cwd);

                const env = this.buildEnv(options.env ?? {}, options.mergeEnv !== false);
                Object.entries(env).forEach(([key, value]) => launcher.setenv(key, value, true));

                const subprocess = launcher.spawnv(argv);

                const timeoutMs = this.getTimeoutMs(options);

                let timeoutId = 0;
                let timedOut = false;

                timeoutMs > 0 && (timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
                    timedOut = true;
                    subprocess.force_exit();
                    return GLib.SOURCE_REMOVE;
                }));

                const [ok, stdout, stderr] = await this.communicate(subprocess, options.input || null);

                timeoutId && GLib.source_remove(timeoutId);

                return timedOut
                    ? this.buildResult({
                        argv,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        status: subprocess.get_exit_status(),
                        success: false,
                        timedOut: true
                    })
                    : this.buildResult({
                        argv,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        status: subprocess.get_exit_status(),
                        success: ok && subprocess.get_successful()
                    });
            })()
            : this.buildResult({argv: []});
    }

    communicate(subprocess, input) {
        return new Promise((complete, fail) => {
            return subprocess
                ? subprocess.communicate_utf8_async(input, null, (proc, res) => {
                    try {
                        proc
                            ? complete(proc.communicate_utf8_finish(res))
                            : fail(new Error('Process became null during communication'));
                    } catch (error) {
                        fail(error);
                    }
                })
                : fail(new Error('Subprocess is null or undefined'));
        });
    }

    buildEnv(customEnv, mergeWithSystem) {
        const env = {};

        mergeWithSystem && GLib.get_environ().forEach(entry => {
            const [key, ...rest] = entry.split('=');
            env[key] = rest.join('=');
        });

        Object.entries(customEnv ?? {}).forEach(([key, value]) => {
            value != null && (env[String(key)] = String(value));
        });

        return env;
    }
}
