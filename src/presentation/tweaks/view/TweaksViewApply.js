import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=3.0';
import {COMMAND_BIN, TWEAK_MAPPING} from './TweaksViewConstants.js';

export function applyTweaksViewApply(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewApply.prototype);
}

class TweaksViewApply {
    clearApplyTweaksTimer() {
        const timerId = this.applyTweaksIdleId;
        timerId > 0 && (
            GLib.source_remove(timerId),
            this.applyTweaksIdleId = 0
        );
    }

    scheduleApplyCurrentTweaks(delayMs = 150, force = false) {
        if (!force && (this.tweaksLocked || !this.currentTweaks)) {
            return;
        }

        let currentTime = Date.now(),
            timeSinceLastApply = currentTime - this.lastTweaksApplyTime;
        (!force && timeSinceLastApply < this.TWEAKS_DEBOUNCE_DELAY)
            && (delayMs = Math.max(delayMs, this.TWEAKS_DEBOUNCE_DELAY - timeSinceLastApply + 50));

        this.clearApplyTweaksTimer();

        this.applyTweaksIdleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this.lastTweaksApplyTime = Date.now();
            let prev = this.tweaksLocked;
            force && (this.tweaksLocked = false);
            this.applyCurrentTweaks();
            force && (this.tweaksLocked = prev);
            this.applyTweaksIdleId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    applyCurrentTweaks() {
        if (this.tweaksLocked || !this.currentTweaks) {
            return;
        }

        this.execSyncCommand(`${COMMAND_BIN.WHICH} ${COMMAND_BIN.HYPRCTL}`);

        TWEAK_MAPPING
            .filter(([key]) => this.currentTweaks[key] !== undefined)
            .forEach(([key, hyprParam, transform]) => {
                const value = transform
                    ? transform(this.currentTweaks[key])
                    : String(this.currentTweaks[key]);
                this.execSyncCommand(`${COMMAND_BIN.HYPRCTL} keyword ${hyprParam} ${value}`);
            });
    }

    connectTweaksHandler(widget, signal, callback) {
        return widget
            ? (() => {
                const handlerId = widget.connect(signal, callback);
                this.tweaksEventHandlers.push({widget, handlerId, signal});
                return handlerId;
            })()
            : undefined;
    }

    disconnectAllTweaksHandlers() {
        this.tweaksEventHandlers.forEach(({widget, handlerId}) => {
            const disconnect = widget?.disconnect;
            typeof disconnect === 'function' && disconnect.call(widget, handlerId);
        });

        this.tweaksEventHandlers = [];
    }

    exitTweaksTab() {
        this.setTweaksLock(true);
        this.clearApplyTweaksTimer();
        this.disconnectAllTweaksHandlers();
    }

    setTweaksLock(locked) {
        this.tweaksLocked = locked;
        locked && this.clearApplyTweaksTimer();
    }

    getMainWindow() {
        return Gdk.Display.get_default()
            ? Gtk.Window.list_toplevels().find((window) => window?.is_visible?.()) ?? null
            : null;
    }
}
