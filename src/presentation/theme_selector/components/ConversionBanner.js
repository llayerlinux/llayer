import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { Events } from '../../../app/eventBus.js';

export class ConversionBanner {
    constructor(deps = {}) {
        this.Box = deps.Box;
        this.eventBus = deps.eventBus;
        this.t = deps.t || ((k) => k);

        this.banner = null;
        this.progressBar = null;
        this.label = null;
        this.iconLabel = null;
        this.successIcon = null;
        this.pulseId = 0;
        this.hideTimeoutId = 0;
        this.disposed = false;
        this.sourceWM = null;
        this.targetWM = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.eventBus) return;

        this.conversionStartId = this.eventBus.on(Events.WM_CONVERSION_START, (data) => {
            this.show(data?.sourceWM, data?.targetWM);
        });

        this.conversionCompleteId = this.eventBus.on(Events.WM_CONVERSION_COMPLETE, () => {
            this.hideWithDelay(1500);
        });
    }

    build() {
        this.disposed = false;

        this.banner = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        this.banner.set_no_show_all(true);
        this.banner.hide();
        this.banner.get_style_context().add_class('conversion-banner');

        const contentRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 12,
            margin_end: 12,
            margin_top: 8,
            margin_bottom: 4
        });

        this.iconLabel = new Gtk.Label({ label: '>' });
        this.iconLabel.get_style_context().add_class('conversion-icon');
        contentRow.pack_start(this.iconLabel, false, false, 0);

        this.label = new Gtk.Label({
            label: 'Converting...',
            halign: Gtk.Align.START,
            hexpand: true
        });
        this.label.get_style_context().add_class('conversion-label');
        contentRow.pack_start(this.label, true, true, 0);

        this.successIcon = new Gtk.Label({ label: 'OK' });
        this.successIcon.set_no_show_all(true);
        this.successIcon.hide();
        contentRow.pack_end(this.successIcon, false, false, 0);

        this.banner.pack_start(contentRow, false, false, 0);

        this.progressBar = new Gtk.ProgressBar({
            show_text: false,
            fraction: 0
        });
        this.progressBar.set_hexpand(true);
        this.progressBar.set_margin_start(12);
        this.progressBar.set_margin_end(12);
        this.progressBar.set_margin_bottom(8);
        this.progressBar.set_pulse_step(0.05);
        this.progressBar.get_style_context().add_class('conversion-progress');
        this.banner.pack_start(this.progressBar, false, false, 0);

        this.banner.connect('destroy', () => {
            this.dispose();
        });

        return this.banner;
    }

    show(sourceWM = 'Sway', targetWM = 'Hyprland') {
        if (this.disposed || !this.banner) return;

        this.sourceWM = sourceWM;
        this.targetWM = targetWM;

        if (this.hideTimeoutId) {
            GLib.source_remove(this.hideTimeoutId);
            this.hideTimeoutId = 0;
        }

        const convertingText = this.t('CONVERTING_WM_BANNER') || 'Converting';
        this.label.set_markup(`<b>${convertingText}</b>  ${sourceWM} -> ${targetWM}`);

        this.successIcon.hide();
        this.iconLabel.show();
        this.progressBar.set_fraction(0);

        this.banner.show();
        this.label.show();
        this.iconLabel.show();
        this.progressBar.show();

        this.banner.get_children().forEach((child) => {
            child.show();
            if (child.get_children) {
                child.get_children().forEach((grandChild) => grandChild.show());
            }
        });

        this.successIcon.hide();
        this.startPulse();
    }

    hideWithDelay(delay = 3000) {
        if (this.disposed || !this.banner) return;

        this.stopPulse();
        this.progressBar.set_fraction(1.0);
        this.iconLabel.hide();
        this.successIcon.show();

        const doneText = this.t('CONVERSION_COMPLETE_BANNER') || 'Converted successfully';
        const wmInfo = this.sourceWM && this.targetWM ? `${this.sourceWM} -> ${this.targetWM}` : '';
        this.label.set_markup(wmInfo ? `<b>${wmInfo}</b>  ${doneText}` : doneText);

        this.hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.hide();
            this.hideTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    hide() {
        if (this.disposed || !this.banner) return;

        this.stopPulse();

        if (this.hideTimeoutId) {
            GLib.source_remove(this.hideTimeoutId);
            this.hideTimeoutId = 0;
        }

        this.banner.hide();
    }

    startPulse() {
        if (this.pulseId) return;

        this.pulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            if (this.disposed || !this.progressBar) {
                this.pulseId = 0;
                return GLib.SOURCE_REMOVE;
            }
            this.progressBar.pulse();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopPulse() {
        if (this.pulseId) {
            GLib.source_remove(this.pulseId);
            this.pulseId = 0;
        }
    }

    dispose() {
        this.disposed = true;
        this.stopPulse();

        if (this.hideTimeoutId) {
            GLib.source_remove(this.hideTimeoutId);
            this.hideTimeoutId = 0;
        }

        if (this.eventBus) {
            if (this.conversionStartId) {
                this.eventBus.off(Events.WM_CONVERSION_START, this.conversionStartId);
            }
            if (this.conversionCompleteId) {
                this.eventBus.off(Events.WM_CONVERSION_COMPLETE, this.conversionCompleteId);
            }
        }

        this.banner = null;
        this.progressBar = null;
        this.label = null;
        this.iconLabel = null;
        this.successIcon = null;
    }

    getWidget() {
        return this.banner;
    }
}
