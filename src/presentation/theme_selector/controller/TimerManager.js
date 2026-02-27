import GLib from 'gi://GLib';

export class TimerManager {
    constructor() {
        this.timers = new Map();
    }

    registerTimer(key, type, createFn) {
        this.clear(key);
        const id = createFn();
        if (id) {
            this.timers.set(key, {id, type});
        }
        return id;
    }

    debounce(key, callback, delayMs) {
        return this.registerTimer(key, 'timeout', () =>
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(0, delayMs), () => {
                this.timers.delete(key);
                callback();
                return GLib.SOURCE_REMOVE;
            })
        );
    }

    idle(key, callback) {
        return this.registerTimer(key, 'idle', () =>
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.timers.delete(key);
                callback();
                return GLib.SOURCE_REMOVE;
            })
        );
    }

    clear(key) {
        const timer = this.timers.get(key);
        if (!timer) {
            return;
        }
        GLib.source_remove(timer.id);
        this.timers.delete(key);
    }

    clearAll() {
        for (const [, timer] of this.timers) {
            GLib.source_remove(timer.id);
        }
        this.timers.clear();
    }

    has(key) {
        return this.timers.has(key);
    }
}
