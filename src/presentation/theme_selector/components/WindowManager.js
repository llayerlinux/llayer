import GLib from 'gi://GLib';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export class WindowManager {
    constructor(deps) {
        this.getWindow = deps.getWindow || (() => null);
        this.getContentBox = deps.getContentBox || (() => null);
        this.getDownloadsContainer = deps.getDownloadsContainer || (() => null);
        this.getDownloadsBox = deps.getDownloadsBox || (() => null);
        this.getNetworkProgressPulseId = deps.getNetworkProgressPulseId || (() => 0);
        this.setNetworkProgressPulseId = deps.setNetworkProgressPulseId || (() => {
        });
        this.DEFAULT_WIDTH = 400;
        this.DEFAULT_HEIGHT = 640;
    }

    queueResizeWidgets(...widgets) {
        widgets.forEach((widget) => widget?.queue_resize?.());
    }

    resetSizeRequests(...widgets) {
        widgets.forEach((widget) => widget?.set_size_request?.(-1, -1));
    }

    captureWindowState() {
        const window = this.getWindow();
        return window ? {
            position: window.get_position?.() || null,
            size: window.get_size?.() || null,
            wasVisible: window.get_visible?.() || false
        } : {position: null, size: null, wasVisible: false};
    }

    clampPositionToPrimaryMonitor(window, position, size = null) {
        if (!(window && Array.isArray(position) && position.length >= 2 && window?.get_screen?.()?.get_monitor_geometry))
            return position;
        const geometry = window.get_screen().get_monitor_geometry(window.get_screen().get_primary_monitor?.() || 0);
        const fb = window.get_size?.() || [this.DEFAULT_WIDTH, this.DEFAULT_HEIGHT];
        const [w, h] = [0, 1].map(i => (Array.isArray(size) && Number.isFinite(size[i]) && size[i] > 0) ? size[i] : fb[i]);
        return [Math.min(geometry.x + Math.max(0, geometry.width - w), Math.max(geometry.x, position[0])),
            Math.min(geometry.y + Math.max(0, geometry.height - h), Math.max(geometry.y, position[1]))];
    }

    applyWindowState(window, state) {
        const safePosition = this.clampPositionToPrimaryMonitor(window, state?.position, state?.size);
        const ops = [
            [safePosition, () => window.move?.(safePosition[0], safePosition[1])],
            [state?.size, () => window.resize?.(state.size[0], state.size[1])]
        ];
        ops.forEach(([condition, action]) => condition && action());
    }

    restoreWindowState(state) {
        const window = this.getWindow();
        window && this.applyWindowState(window, state);
    }

    clearPulseTimer() {
        const pulseId = this.getNetworkProgressPulseId();
        pulseId && (
            GLib.source_remove(pulseId),
            this.setNetworkProgressPulseId(0)
        );
    }

    adaptSize() {
        const window = this.getWindow();
        window && (() => {
            const contentBox = this.getContentBox(), downloadsContainer = this.getDownloadsContainer(),
                downloadsBox = this.getDownloadsBox();
            window.set_resizable?.(true);
            this.resetSizeRequests(downloadsContainer, downloadsBox);
            this.queueResizeWidgets(downloadsBox, downloadsContainer, contentBox, window);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_QUICK_MS, () => {
                const win = this.getWindow();
                return win
                    ? (() => {
                        const cb = this.getContentBox(), [, natHeight] = cb?.get_preferred_height?.() || [0, 0];
                        win.resize?.(this.DEFAULT_WIDTH, Math.max(this.DEFAULT_HEIGHT, natHeight));
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_QUICK_MS, () => {
                            this.getWindow()?.set_resizable?.(false);
                            return GLib.SOURCE_REMOVE;
                        });
                        return GLib.SOURCE_REMOVE;
                    })()
                    : GLib.SOURCE_REMOVE;
            });
        })();
    }

    shrinkToDefault() {
        this.adaptSize();
    }

    resetToDefaultSize(setResizable = true) {
        const window = this.getWindow();
        window && (
            setResizable && window.set_resizable?.(true),
            window.set_default_size?.(this.DEFAULT_WIDTH, this.DEFAULT_HEIGHT),
            window.resize?.(this.DEFAULT_WIDTH, this.DEFAULT_HEIGHT),
            window.queue_resize?.(),
            setResizable && GLib.timeout_add(GLib.PRIORITY_HIGH, TIMEOUTS.UI_REFRESH_MS, () => {
                const win = this.getWindow();
                win && (win.resize?.(this.DEFAULT_WIDTH, this.DEFAULT_HEIGHT), win.set_resizable?.(false));
                return GLib.SOURCE_REMOVE;
            })
        );
    }
}
