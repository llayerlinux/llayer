import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import { showMessageDialog } from '../../common/ViewUtils.js';

class UploadDialogFiles {
    showImageError(path) {
        this.showErrorDialog(this.t('ERROR'), this.t('UPLOAD_IMAGE_LOAD_ERROR', {error: path}));
    }

    showImageSizeError(width, height) {
        this.showErrorDialog(
            this.t('UPLOAD_IMAGE_SIZE_ERROR_TITLE'),
            this.t('UPLOAD_IMAGE_SIZE_ERROR_TEXT', {width, height})
        );
    }

    applyArchivePath(path, {suggestName = false} = {}) {
        path && (
            this.archiveState.path = path,
            this.lastArchivePath = path,
            this.archiveNameLabel?.set_text(GLib.path_get_basename(path) || ''),
            this.archiveBtn?.set_image(this.archiveRefreshIcon),
            suggestName && (() => {
                const currentName = this.fields.nameEntry?.get_text?.()?.trim?.() || '';
                !currentName && (() => {
                    const base = GLib.path_get_basename(path) || '';
                    const suggested = base.replace(/\.(tar\.gz|tgz|tar\.xz|tar|zip)$/i, '');
                    suggested && this.fields.nameEntry?.set_text?.(suggested);
                })();
            })()
        );
    }

    applyPreviewPath(path) {
        path && (
            this.previewState.path = path,
            this.lastPreviewPath = path,
            this.previewNameLabel?.set_text(GLib.path_get_basename(path) || ''),
            this.previewBtn?.set_image(this.previewRefreshIcon),
            !this.previewState.image && (() => {
                this.previewState.image = new Gtk.Image();
                this.previewState.image.set_size_request(180, 120);
                this.previewState.image.set_halign(Gtk.Align.CENTER);
                this.previewImageContainer?.pack_start(this.previewState.image, false, false, 0);
            })(),
            this.previewState.image.set_from_pixbuf(GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 180, 120, true)),
            this.previewState.image.show_all()
        );
    }

    showErrorDialog(title, secondaryText) {
        showMessageDialog({
            parent: this.dialog,
            messageType: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.OK,
            title,
            secondaryText,
            translateWidgets: (dialog) => this.translateWidgets(dialog)
        });
    }
}

export function applyUploadDialogFiles(prototype) {
    copyPrototypeDescriptors(prototype, UploadDialogFiles.prototype);
}
