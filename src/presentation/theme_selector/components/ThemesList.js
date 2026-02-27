import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import GObject from 'gi://GObject';
import {TabType, ViewTabName} from '../../common/Constants.js';

export class ThemesList {
    constructor(deps) {
        this.Box = deps.Box;
        this.Scrollable = deps.Scrollable;
        this.onScrollNearEnd = deps.onScrollNearEnd || (() => {
        });
        this.getCurrentTab = deps.getCurrentTab || (() => ViewTabName.INSTALLED);
        this.gridBox = null;
        this.gridContentBox = null;
        this.scrollableGrid = null;
        this.mainContentBox = null;
        this.scrollHandlerId = null;
        this.scrollAdjustment = null;
        this.localProgressArea = null;
        this.localProgressBar = null;
        this.localProgressLabel = null;
    }

    build() {
        this.gridBox = this.Box({vertical: true, vexpand: true, valign: Gtk.Align.FILL});
        this.localProgressLabel = new Gtk.Label({label: '', xalign: 0, halign: Gtk.Align.START});
        this.localProgressLabel.set_no_show_all(true);
        this.localProgressBar = new Gtk.ProgressBar({show_text: false, fraction: 0});
        this.localProgressBar.set_hexpand(true);
        this.localProgressBar.set_halign(Gtk.Align.FILL);
        this.localProgressBar.set_valign(Gtk.Align.CENTER);
        this.localProgressBar.set_no_show_all(true);
        this.localProgressBar.hide();
        this.localProgressArea = this.Box({
            vertical: false,
            spacing: 12,
            hexpand: true,
            className: 'network-progress-container',
            margin_top: 6,
            margin_bottom: 6,
            margin_left: 16,
            margin_right: 16,
            children: [this.localProgressLabel, this.localProgressBar]
        });
        this.localProgressArea.set_no_show_all(true);
        this.localProgressArea.hide();
        this.gridContentBox = this.Box({
            vertical: true,
            spacing: 8,
            vexpand: true,
            valign: Gtk.Align.FILL,
            children: [this.localProgressArea, this.gridBox]
        });
        this.scrollableGrid = this.Scrollable({
            className: 'my-theme-selector-scrollable',
            vscroll: 'always',
            hscroll: 'never',
            child: this.gridContentBox,
            widthRequest: 420,
            heightRequest: 160 * 4 + 20,
            vexpand: true,
            valign: Gtk.Align.FILL
        });
        this.mainContentBox = this.Box({
            vertical: false,
            hexpand: true,
            vexpand: true,
            margin_top: 0,
            margin_bottom: 0,
            children: [this.scrollableGrid]
        });
        this.attachScrollHandler();
        return {
            mainContentBox: this.mainContentBox,
            gridBox: this.gridBox,
            scrollableGrid: this.scrollableGrid,
            gridContentBox: this.gridContentBox
        };
    }

    disconnectScrollHandler(adjustment) {
        const canDisconnect = this.scrollHandlerId && this.scrollAdjustment === adjustment &&
            GObject.signal_handler_is_connected(adjustment, this.scrollHandlerId);
        canDisconnect && (
            adjustment.disconnect(this.scrollHandlerId),
            this.scrollHandlerId = null,
            this.scrollAdjustment = null
        );
    }

    attachScrollHandler() {
        const adjustment = this.scrollableGrid?.get_vadjustment?.();
        adjustment && (
            this.disconnectScrollHandler(adjustment),
            this.scrollAdjustment = adjustment,
            this.scrollHandlerId = adjustment.connect('value-changed', () => this.handleScroll(adjustment))
        );
    }

    handleScroll(adjustment) {
        this.getCurrentTab() === ViewTabName.NETWORK && (() => {
            const value = adjustment.get_value();
            const upper = adjustment.get_upper();
            const pageSize = adjustment.get_page_size();
            upper - (value + pageSize) <= 80 && this.onScrollNearEnd();
        })();
    }

    clear() {
        for (const child of this.gridBox.get_children()) {
            child._pulseTimer && (
                GLib.source_remove(child._pulseTimer),
                child._pulseTimer = null
            );
            this.gridBox.remove(child);
        }
    }

    resetLocalProgress() {
        this.localProgressBar.set_fraction(0);
        this.localProgressLabel.set_text('');
        this.localProgressArea.hide();
    }

    updateLocalProgress(processed, total) {
        const totalCount = typeof total === 'number' && total > 0 ? total : 0,
              processedCount = typeof processed === 'number' ? Math.max(0, processed) : 0,
              isLocalTab = this.getCurrentTab() === ViewTabName.INSTALLED || this.getCurrentTab() === TabType.LOCAL,
              shouldHideProgress = !totalCount || processedCount >= totalCount || !isLocalTab;
        return shouldHideProgress
            ? this.resetLocalProgress()
            : (
                this.localProgressBar.set_fraction(Math.max(0, Math.min(1, processedCount / totalCount))),
                this.localProgressLabel.set_text(`${processedCount}/${totalCount}`),
                this.localProgressArea.show_all()
            );
    }

    getWidgets() {
        return {
            gridBox: this.gridBox,
            gridContentBox: this.gridContentBox,
            scrollableGrid: this.scrollableGrid,
            mainContentBox: this.mainContentBox,
            localProgressArea: this.localProgressArea,
            localProgressBar: this.localProgressBar,
            localProgressLabel: this.localProgressLabel
        };
    }

    destroy() {
        this.scrollHandlerId && this.scrollAdjustment
            && GObject.signal_handler_is_connected(this.scrollAdjustment, this.scrollHandlerId)
            && this.scrollAdjustment.disconnect(this.scrollHandlerId);
        this.scrollHandlerId = null;
        this.scrollAdjustment = null;
    }
}
