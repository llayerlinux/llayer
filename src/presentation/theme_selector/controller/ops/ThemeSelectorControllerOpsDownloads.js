import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { Events } from '../../../../app/eventBus.js';
import {addPointerCursor} from '../../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';

class ThemeSelectorControllerOpsDownloads {
    hideDownloadsContainer() {
        if (!this.view?.downloadsContainer) return;
        this.view.downloadsContainer.visible = false;
        this.view.downloadsContainer.get_style_context().remove_class('visible');
        this.view.downloadsContainer.hide?.();
    }

    maybeHideDownloadsContainer() {
        const children = this.view && this.view.downloadsBox && typeof this.view.downloadsBox.get_children === 'function'
            ? this.view.downloadsBox.get_children()
            : [];
        !children.length && this.hideDownloadsContainer();
    }

    cancelActiveDownload(themeName, options = {}) {
        const normalizedThemeName = typeof themeName === 'string' ? themeName.trim() : '';
        const processId = options?.processId || null;
        const reason = options?.reason || 'user';

        if (!normalizedThemeName) return;

        this.downloadRiceUseCase?.cancel?.(normalizedThemeName);
        if (this.eventBus?.emit) {
            this.eventBus.emit(Events.THEME_DOWNLOAD_CANCELLED, {
                theme: {name: normalizedThemeName},
                processId,
                reason
            });
            return;
        }
        this.handleDownloadCancel(normalizedThemeName, processId, reason);
    }

    handleDownloadCancel(themeName, processId = null, reason = 'user') {
        const normalizedThemeName = typeof themeName === 'string' ? themeName.trim() : '';
        if (!normalizedThemeName) return;

        this.activeProcesses.delete(normalizedThemeName);
        this.downloading.delete(normalizedThemeName);
        this.pendingAutoApplyThemes.delete(normalizedThemeName);
        this.store?.updateTheme?.({
            name: normalizedThemeName,
            downloading: false,
            status: 'available'
        });
        this.view?.setDownloadState?.(normalizedThemeName, {status: 'complete', progress: 0, reason});
        if (processId) {
            this.view?.removeDownloadProgress?.(processId);
        }
        this.maybeHideDownloadsContainer();
        this.view?.adaptWindowSize?.();
    }

    createSimpleDownloadProgressUI(theme) {
        const sizeLabel = new Gtk.Label({
            label: `0.00 MB — ${theme.title || theme.name} (0%)`, halign: Gtk.Align.END
        });

        const progressBar = new Gtk.ProgressBar({
            width_request: 300, height_request: 6
        });

        const cancelBtn = new Gtk.Button({
            label: '×', width_request: 26, height_request: 26
        });
        cancelBtn.get_style_context().add_class('download-cancel-btn');
        addPointerCursor(cancelBtn);

        cancelBtn.connect('clicked', () => {
            const parent = container.get_parent();
            parent && parent.remove(container);
            this.cancelActiveDownload(theme.name);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_REFRESH_MS, () => {
                this.maybeHideDownloadsContainer();
                this.view?.adaptWindowSize?.();
                return GLib.SOURCE_REMOVE;
            });
        });

        const topRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 8
        });
        topRow.pack_start(sizeLabel, true, true, 0);
        topRow.pack_start(cancelBtn, false, false, 0);

        const container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 6
        });
        container.pack_start(topRow, false, false, 0);
        container.pack_start(progressBar, false, false, 0);

        return {
            container,
            sizeLabel,
            progressBar,
            updateProgress: (progressData) => {
                const safeProgressData = progressData && typeof progressData === 'object' ? progressData : {};
                const {
                    downloaded = 0,
                    percentage: rawPercentage = 0,
                    status,
                    totalSize
                } = safeProgressData;
                const downloadedMB = (downloaded / 1048576).toFixed(2);
                let percentage = rawPercentage;

                switch (status) {
                    case 'downloading':
                        break;
                    case 'extracting':
                        percentage = Math.max(100, percentage);
                        break;
                    case 'completed':
                        percentage = 100;
                        break;
                    default:
                        break;
                }

                const displayPercentage = Math.max(0, Math.min(100, percentage || 0));
                const displayTitle = theme.title || theme.name;

                const totalMB = totalSize && totalSize > 0 ? (totalSize / 1048576).toFixed(2) : null;
                sizeLabel.set_text(
                    totalMB
                        ? `${downloadedMB} / ${totalMB} MB — ${displayTitle} (${displayPercentage}%)`
                        : `${downloadedMB} MB — ${displayTitle} (${displayPercentage}%)`
                );

                progressBar.set_fraction(displayPercentage / 100);
            }
        };
    }
}

export function applyThemeSelectorControllerOpsDownloads(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsDownloads.prototype);
}
