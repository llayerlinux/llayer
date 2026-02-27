import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {ViewTabName} from '../../common/Constants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export class NetworkProgress {
    constructor(deps) {
        this.Box = deps.Box;
        this.getCurrentTab = deps.getCurrentTab || (() => ViewTabName.INSTALLED);
        this.progressBar = null;
        this.progressArea = null;
        this.pulseId = 0;
        this.disposed = false;
    }

    build() {
        this.disposed = false;
        this.progressBar = new Gtk.ProgressBar({show_text: false, fraction: 0});
        this.progressBar.set_hexpand(true);
        this.progressBar.set_halign(Gtk.Align.FILL);
        this.progressBar.set_valign(Gtk.Align.CENTER);
        this.progressBar.set_no_show_all(true);
        this.progressBar.hide();
        this.progressBar.set_pulse_step(0.08);
        this.progressBar.get_style_context().add_class('network-progress-bar');
        this.progressBar.connect('destroy', () => {
            this.progressBar = null;
        });
        this.progressArea = this.Box({
            vertical: false,
            hexpand: true,
            className: 'network-progress-container',
            margin_top: 4,
            margin_bottom: 4,
            margin_left: 16,
            margin_right: 16,
            visible: false,
            children: [this.progressBar]
        });
        this.progressArea.set_no_show_all(true);
        this.progressArea.connect('destroy', () => {
            this.progressArea = null;
        });
        return this.progressArea;
    }

    resetProgressBar() {
        this.progressBar.set_fraction(0);
    }

    show() {
        if (this.getCurrentTab() !== ViewTabName.NETWORK) {
            return;
        }
        this.resetProgressBar();
        this.progressBar.pulse();
        this.progressBar.show();
        this.progressArea.show();
        if (!this.pulseId) {
            this.pulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.PULSE_INTERVAL_MS, () => {
                this.progressBar.pulse();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    hide() {
        this.stopPulse();
        this.resetProgressBar();
        this.progressBar.hide();
        this.progressArea.hide();
    }

    stopPulse() {
        if (this.pulseId) {
            GLib.source_remove(this.pulseId);
            this.pulseId = 0;
        }
    }

    markDisposed() {
        this.disposed = true;
        this.progressBar = null;
        this.progressArea = null;
    }

    isVisible() {
        return this.progressArea.get_visible();
    }

    getWidgets() {
        return {progressBar: this.progressBar, progressArea: this.progressArea};
    }

    destroy() {
        this.stopPulse();
        this.markDisposed();
    }
}
