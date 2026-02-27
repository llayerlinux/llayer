import GLib from 'gi://GLib';
import { decodeBytes } from '../utils/Utils.js';

export class CommandExecutionService {
    executeSync(argv = []) {
        if (!Array.isArray(argv) || argv.length === 0) {
            return {success: false, stdout: '', stderr: ''};
        }
        const [success, stdout, stderr] = GLib.spawn_sync(
            null,
            argv,
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );
        return {
            success: !!success,
            stdout: decodeBytes(stdout),
            stderr: decodeBytes(stderr)
        };
    }

    executeCommandSync(command) {
        const [success, stdout, stderr] = GLib.spawn_command_line_sync(command);
        return {
            success: !!success,
            stdout: decodeBytes(stdout),
            stderr: decodeBytes(stderr)
        };
    }
}
