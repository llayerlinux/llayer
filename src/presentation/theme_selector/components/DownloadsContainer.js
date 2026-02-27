import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor} from '../../common/ViewUtils.js';

export class DownloadsContainer {
    constructor(deps) {
        this.Box = deps.Box;
        this.onAdaptWindowSize = deps.onAdaptWindowSize || (() => {
        });
        this.container = null;
        this.downloadsBox = null;
        this.activeDownloads = [];
    }

    getThemeLabel(theme) {
        return theme?.title || theme?.name || '';
    }

    showContainer() {
        this.container.visible = true;
        this.container.get_style_context().add_class('visible');
        this.container.show_all();
    }

    hideContainer(removeClass = false) {
        this.container.visible = false;
        removeClass && this.container.get_style_context().remove_class('visible');
        this.container.hide();
    }

    build() {
        this.downloadsBox = this.Box({
            vertical: true,
            spacing: 6,
            margin_top: 0,
            margin_bottom: 0,
            margin_left: 8,
            margin_right: 8
        });
        this.container = this.Box({
            vertical: true,
            children: [this.downloadsBox],
            visible: false,
            className: 'downloads-container'
        });
        return this.container;
    }

    createProgressUI(data) {
        const {theme, onCancel, processId} = data;
        const themeLabel = this.getThemeLabel(theme);
        const sizeLabel = new Gtk.Label({
            label: `0.00 / ? MB — ${themeLabel} (0%)`,
            halign: Gtk.Align.END,
            hexpand: false,
            margin_right: 8
        });
        sizeLabel.get_style_context().add_class('download-size-label');
        const progressBarBg = this.Box({className: 'download-progress-bar-bg', heightRequest: 8, hexpand: true});
        const progressBar = this.Box({
            className: 'download-progress-bar-fill',
            heightRequest: 4,
            widthRequest: 0,
            hexpand: false
        });
        progressBarBg.pack_start(progressBar, false, false, 0);
        progressBarBg.pack_start(this.Box({hexpand: true}), true, true, 0);
        const cancelBtn = new Gtk.Button({width_request: 20, height_request: 20, hexpand: false, vexpand: false});
        cancelBtn.set_image(new Gtk.Image({icon_name: 'window-close-symbolic', icon_size: Gtk.IconSize.SMALL_TOOLBAR}));
        cancelBtn.get_style_context().add_class('download-cancel-btn');
        addPointerCursor(cancelBtn);
        onCancel && cancelBtn.connect('clicked', () => onCancel(processId));
        const progressRow = this.Box({
            vertical: false,
            spacing: 6,
            hexpand: true,
            margin_bottom: 4,
            children: [progressBarBg, cancelBtn]
        });
        const container = this.Box({
            vertical: true,
            spacing: 4,
            margin_top: 4,
            margin_bottom: 4,
            className: 'download-progress-item',
            children: [sizeLabel, progressRow]
        });
        const updateProgress = (downloaded, total, percent) => {
            const downloadedMB = (downloaded / (1024 * 1024)).toFixed(2),
                totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(2) : '?';
            sizeLabel.set_text(`${downloadedMB} / ${totalMB} MB — ${themeLabel} (${Math.round(percent || 0)}%)`);
            total > 0 && progressBarBg.get_allocated_width
                && progressBar.set_size_request(Math.round((percent / 100) * progressBarBg.get_allocated_width()), 4);
        };
        return {
            container,
            sizeLabel,
            progressBar,
            progressBarBg,
            cancelBtn,
            processId,
            updateProgress,
            themeName: themeLabel
        };
    }

    addDownload(data) {
        const progressUI = this.createProgressUI(data);
        this.downloadsBox.pack_start(progressUI.container, false, false, 0);
        !this.container.visible && this.showContainer();
        this.activeDownloads.push(progressUI);
        data.updateProgress = progressUI.updateProgress;
        return progressUI;
    }

    removeDownload(processId) {
        const index = this.activeDownloads.findIndex(p => p.processId === processId);
        index !== -1 && (() => {
            const progressUI = this.activeDownloads[index];
            progressUI.container?.get_parent?.()?.remove(progressUI.container);
            this.activeDownloads.splice(index, 1);
            this.activeDownloads.length === 0 && this.hideContainer(true);
            this.onAdaptWindowSize();
        })();
    }

    getWidgets() {
        return {container: this.container, downloadsBox: this.downloadsBox};
    }

    clear() {
        for (const download of this.activeDownloads) {
            download.container?.get_parent?.()?.remove(download.container);
        }
        this.activeDownloads = [];
        this.hideContainer(false);
    }
}
