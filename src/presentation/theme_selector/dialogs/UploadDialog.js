import { applyUploadDialogFiles } from './UploadDialogFiles.js';
import { applyUploadDialogShortcuts } from './UploadDialogShortcuts.js';
import { applyUploadDialogUI } from './UploadDialogUI.js';
import { applyUploadDialogUpload } from './UploadDialogUpload.js';

export class UploadDialog {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.parentWindow = deps.parentWindow || null;
        this.onUpload = deps.onUpload || (() => {
        });
        this.showNotification = deps.showNotification || (() => {
        });
        this.translateWidgets = deps.translateWidgets || (() => {
        });
        this.onClose = deps.onClose || (() => {
        });
        this.cssProvider = deps.cssProvider || null;
        this.dialog = null;
        this.fields = {};
        this.archiveState = {path: null};
        this.previewState = {path: null, image: null};
        this.currentUpload = null;
        this.isUploading = false;
        this.cancelUpload = null;
        this.lastArchivePath = null;
        this.lastPreviewPath = null;
        this.isDisposed = false;
    }

    destroy() {
        this.dialog?.destroy();
        this.dialog = null;
    }
}

[
    applyUploadDialogUI,
    applyUploadDialogFiles,
    applyUploadDialogShortcuts,
    applyUploadDialogUpload
].forEach((applyMixin) => applyMixin(UploadDialog.prototype));
