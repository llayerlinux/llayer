import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

const MAX_LOG_SIZE = 5 * 1024 * 1024;
const FLUSH_INTERVAL_MS = 2000;
const FLUSH_BATCH_SIZE = 20;

let _instance = null;

export class SupporterAuditLog {
    static getInstance() { return _instance; }

    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        _instance = this;
        this.logPath = options.logPath
            || GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer', 'supporter-audit.log']);
        this._callCount = 0;
        this._sessionId = GLib.get_real_time().toString(36);
        this._buffer = [];
        this._flushTimerId = 0;

        if (this.enabled) {
            this.ensureDirectory();
            this.writeSessionHeader();
        }
    }

    ensureDirectory() {
        const dir = GLib.path_get_dirname(this.logPath);
        GLib.mkdir_with_parents(dir, 0o755);
    }

    writeSessionHeader() {
        this.writeLine(JSON.stringify({
            type: 'session_start',
            t: new Date().toISOString(),
            sid: this._sessionId,
            pid: new Gio.Credentials().get_unix_pid()
        }));
    }

    log(serviceName, methodName, args, durationMs = null) {
        if (!this.enabled) return;
        this._callCount++;
        const entry = {
            n: this._callCount,
            t: new Date().toISOString(),
            s: serviceName,
            m: methodName,
            argc: args?.length ?? 0
        };
        if (durationMs !== null) entry.ms = durationMs;

        this._buffer.push(JSON.stringify(entry));
        if (this._buffer.length >= FLUSH_BATCH_SIZE) {
            this.flush();
            return;
        }

        if (!this._flushTimerId) {
            this._flushTimerId = GLib.timeout_add(GLib.PRIORITY_LOW, FLUSH_INTERVAL_MS, () => {
                this.flush();
                this._flushTimerId = 0;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    flush() {
        if (this._buffer.length === 0) return;
        const lines = this._buffer.join('\n') + '\n';
        this._buffer = [];

        this.rotateIfNeeded();
        this.appendText(lines, 'SupporterAuditLog.flush.append');
    }

    rotate() {
        tryRun('SupporterAuditLog.rotate', () => {
            const current = Gio.File.new_for_path(this.logPath);
            const old = Gio.File.new_for_path(`${this.logPath}.old`);
            if (old.query_exists(null)) old.delete(null);
            current.move(old, Gio.FileCopyFlags.OVERWRITE, null, null);
        });
    }

    getStats() {
        return { callCount: this._callCount, sessionId: this._sessionId, enabled: this.enabled };
    }

    shutdown() {
        if (this._flushTimerId) {
            GLib.source_remove(this._flushTimerId);
            this._flushTimerId = 0;
        }
        this.flush();
        if (this.enabled) {
            this.writeLine(JSON.stringify({
                type: 'session_end',
                t: new Date().toISOString(),
                sid: this._sessionId,
                totalCalls: this._callCount
            }));
        }
    }

    writeLine(line) {
        this.appendText(`${line}\n`, 'SupporterAuditLog.writeLine');
    }

    rotateIfNeeded() {
        tryRun('SupporterAuditLog.rotateIfNeeded', () => {
            const file = Gio.File.new_for_path(this.logPath);
            if (!file.query_exists(null)) {
                return;
            }

            const info = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null);
            if (info.get_size() > MAX_LOG_SIZE) {
                this.rotate();
            }
        });
    }

    appendText(text, context) {
        const encoder = new TextEncoder();
        return tryOrDefault(context, () => {
            const file = Gio.File.new_for_path(this.logPath);
            const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
            stream.write_all(encoder.encode(text), null);
            stream.close(null);
            return true;
        }, false);
    }
}
