import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { SUPPORTED_ARCHIVE_EXTENSIONS } from '../../common/FileFilters.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

class UploadDialogUpload {
    handleUpload() {
        if (this.isDisposed) {
            return;
        }
        const lowerPath = (this.archiveState.path || '').toLowerCase();
        const validArchive = SUPPORTED_ARCHIVE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
        const VALIDATIONS = [
            [!this.archiveState.path, 'ARCHIVE_REQUIRED'], [!this.previewState.path, 'PREVIEW_REQUIRED'],
            [this.archiveState.path && !validArchive, 'SUPPORTED_ARCHIVES_HINT'],
            [!this.fields.nameEntry?.get_text().trim(), 'NAME_REQUIRED'],
            [!this.fields.authorEntry?.get_text().trim(), 'AUTHOR_REQUIRED'],
            [!this.fields.passEntry?.get_text().trim(), 'PASSWORD_REQUIRED']
        ];
        const failed = VALIDATIONS.find(([condition]) => condition);
        if (failed) {
            this.showNotification(this.t(failed[1]), 'error');
            return;
        }

        const parseLink = txt => {
            const [label = '', url = ''] = (txt ? txt.split('|') : ['', '']).map(s => s.trim());
            return { label, url };
        };
        const metadata = {
            name: this.fields.nameEntry.get_text().trim(),
            repoUrl: this.fields.repoEntry?.get_text().trim() || '',
            published: this.fields.publishedEntry?.get_text().trim() || '',
            youtubeLink: this.fields.youtubeLinkEntry?.get_text().trim() || '',
            author: parseLink(this.fields.authorEntry.get_text()),
            adaptedBy: parseLink(this.fields.adaptedEntry?.get_text() || ''),
            properties: {
                multiConfig: this.fields.chkMulti?.get_active() || false,
                desktopPlus: this.fields.chkDesktopPlus?.get_active() || false,
                familiar: this.fields.chkFamiliar?.get_active() || false,
                widgets: this.fields.chkWidgets?.get_active() || false,
                unique: this.fields.chkUnique?.get_active() || false
            },
            tags: (this.fields.tagsEntry?.get_text() || '').split(',').map(t => t.trim()).filter(Boolean),
            packageSupport: (this.fields.packagesEntry?.get_text() || '').split(',').map(t => t.trim()).filter(Boolean),
            editPassword: this.fields.passEntry.get_text().trim()
        };

        this.setUploading(true);
        const uploadingLabel = this.t('UPLOADING');
        this.statusLabel?.get_style_context().remove_class('error');
        this.statusLabel?.get_style_context().remove_class('success');
        this.statusLabel?.set_text(`${uploadingLabel}... 0%`);
        this.statusLabel?.show();

        let errorHandled = false;
        this.cancelUpload = null;
        const opts = {
            onProgress: (p) => {
                this.isDisposed || (() => {
                    const fraction = Math.max(0, Math.min(1, Number(p) || 0));
                    this.statusLabel?.set_text(`${uploadingLabel}... ${Math.round(fraction * 100)}%`);
                    this.btnUploadProgress?.set_fraction?.(fraction);
                })();
            },
            onSuccess: () => this.finalize('success'),
            onError: (e) => {
                errorHandled = true;
                this.finalize('error', e?.message || this.t('UPLOAD_ERROR_UNKNOWN'));
            },
            onRegisterCancel: (cancelFn) => { this.cancelUpload = cancelFn; }
        };

        const promise = tryOrNull(
            'UploadDialogUpload.handleUpload',
            () => this.onUpload({archivePath: this.archiveState.path, previewPath: this.previewState.path, metadata}, opts)
        );
        if (!promise) {
            this.finalize('error', this.t('UPLOAD_ERROR_UNKNOWN'));
            return;
        }
        Promise.resolve(promise).catch((e) => {
            !errorHandled && this.finalize('error', e?.message || this.t('UPLOAD_ERROR_UNKNOWN'));
        });
    }

    setUploading(uploading) {
        return this.isDisposed
            ? undefined
            : (
                this.isUploading = uploading,
                tryOrNull('setUploading', () => {
                    this.btnUpload?.set_sensitive(!uploading);
                    uploading
                        ? (
                            this.progressSpinner?.show(),
                            this.progressSpinner?.start(),
                            this.btnUploadText?.set_opacity?.(0),
                            this.btnUploadProgress?.set_fraction?.(0),
                            this.btnUploadProgress?.show()
                        )
                        : (
                            this.progressSpinner?.stop(),
                            this.progressSpinner?.hide(),
                            this.btnUploadProgress?.hide(),
                            this.btnUploadText?.set_opacity?.(1)
                        );
                })
            );
    }

    finalize(status, message = null) {
        return this.isDisposed
            ? undefined
            : (
                this.setUploading(false),
                status === 'success'
                    ? (
                        this.statusLabel?.set_text(this.t('UPLOAD_FINISH')),
                        this.statusLabel?.get_style_context().add_class('success'),
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_LONG_MS, () => {
                            !this.isDisposed && this.dialog?.destroy();
                            return GLib.SOURCE_REMOVE;
                        })
                    )
                    : (
                        this.statusLabel?.set_text(message || this.t('UPLOAD_ERROR')),
                        this.statusLabel?.get_style_context().add_class('error')
                    )
            );
    }
}

export function applyUploadDialogUpload(prototype) {
    copyPrototypeDescriptors(prototype, UploadDialogUpload.prototype);
}
