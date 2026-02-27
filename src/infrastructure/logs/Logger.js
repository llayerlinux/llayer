import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
};

export const LogLevelNames = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.CRITICAL]: 'CRITICAL'
};

export class Logger {
    constructor(options = {}) {
        this.minLevel = options.minLevel || LogLevel.INFO;
        this.enableConsole = false;
        this.enableFile = options.enableFile || false;
        this.logFile = options.logFile || `${GLib.get_user_cache_dir()}/lastlayer/app.log`;
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
        this.enableTimestamp = options.enableTimestamp !== false;
        this.enableFile && this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = GLib.path_get_dirname(this.logFile);
        const dir = Gio.File.new_for_path(logDir);
        !dir.query_exists(null) && dir.make_directory_with_parents(null);
    }

    getLogFile() {
        return Gio.File.new_for_path(this.logFile);
    }

    getLogFileSize(file) {
        const info = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null);
        return info.get_size();
    }

    formatMessage(level, component, message, data = null) {
        const timestamp = this.enableTimestamp ? new Date().toISOString() : '';
        let formatted = '';
        this.enableTimestamp && (formatted += `${timestamp} `);
        formatted += `[${component.toUpperCase()}] ${message}`;
        data && (formatted += ` | ${typeof data === 'object' ? JSON.stringify(data) : data}`);
        return formatted;
    }

    log(level, component, message, data = null) {
        return level >= this.minLevel
            ? (() => {
                const formatted = this.formatMessage(level, component, message, data);
                this.enableFile && this.writeToFile(formatted);
            })()
            : undefined;
    }

    writeToFile(message) {
        const file = this.getLogFile();
        const size = file.query_exists(null) ? this.getLogFileSize(file) : 0;
        size > this.maxFileSize && this.rotateLogFile();
        const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        const dataStream = Gio.DataOutputStream.new(stream);
        dataStream.put_string(`${message}\n`, null);
        dataStream.close(null);
    }

    rotateLogFile() {
        const oldFile = `${this.logFile}.old`;
        const currentFile = Gio.File.new_for_path(this.logFile);
        const rotatedFile = Gio.File.new_for_path(oldFile);
        rotatedFile.query_exists(null) && rotatedFile.delete(null);
        currentFile.move(rotatedFile, Gio.FileCopyFlags.NONE, null, null);
    }

    debug(component, message, data = null) {
        this.log(LogLevel.DEBUG, component, message, data);
    }

    info(component, message, data = null) {
        this.log(LogLevel.INFO, component, message, data);
    }

    warn(component, message, data = null) {
        this.log(LogLevel.WARN, component, message, data);
    }

    error(component, message, data = null) {
        this.log(LogLevel.ERROR, component, message, data);
    }

    critical(component, message, data = null) {
        this.log(LogLevel.CRITICAL, component, message, data);
    }

}
