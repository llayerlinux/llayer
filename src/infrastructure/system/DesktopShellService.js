import GLib from 'gi://GLib';
import { Commands } from '../constants/Commands.js';

export class DesktopShellService {
    open(target) {
        const value = typeof target === 'string' ? target.trim() : '';
        if (!value) return false;
        return GLib.spawn_command_line_async(`${Commands.XDG_OPEN} ${GLib.shell_quote(value)}`);
    }
}
