import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import * as ViewUtils from '../../common/ViewUtils.js';

export function applyThemeSelectorViewWindowRestorePointsDetails(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewWindowRestorePointsDetails.prototype);
}

class ThemeSelectorViewWindowRestorePointsDetails {
    showRestorePointDetailsDialog(pointId) {
        this.restorePointDetailsDialog?.destroy?.();

        const parentDialog = this.defaultRestorePointsDialog || this.window || null;
        const dialog = new Gtk.Dialog({
            title: this.translate('RESTORE_POINT_DETAILS_TITLE'),
            transient_for: parentDialog,
            modal: true,
            window_position: Gtk.WindowPosition.CENTER,
            default_width: 760,
            default_height: 560,
            resizable: true
        });
        dialog.get_style_context().add_class('theme-repo-dialog');
        dialog.get_style_context().add_class('restore-points-shell');
        dialog.get_style_context().add_class('restore-points-dialog');
        this._restorePointsTypewriterMode && dialog.get_style_context().add_class('tw-dialog');
        dialog.add_button(this.translate('CLOSE'), Gtk.ResponseType.CLOSE);

        const contentArea = dialog.get_content_area();
        contentArea.get_style_context().add_class('restore-points-content');
        dialog.get_action_area?.()?.get_style_context?.()?.add_class('restore-points-content');
        contentArea.set_spacing(10);
        contentArea.set_margin_left(16);
        contentArea.set_margin_right(16);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        headerBox.get_style_context().add_class('restore-point-details-header');

        const timestampLabel = new Gtk.Label({label: '', xalign: 0});
        const metaLabel = new Gtk.Label({label: '', xalign: 0});
        const sizeLabel = new Gtk.Label({label: '', xalign: 0});
        const foldersLabel = new Gtk.Label({label: '', xalign: 0});
        headerBox.pack_start(timestampLabel, false, false, 0);
        headerBox.pack_start(metaLabel, false, false, 0);
        headerBox.pack_start(sizeLabel, false, false, 0);
        headerBox.pack_start(foldersLabel, false, false, 0);

        const previewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        previewBox.get_style_context().add_class('restore-point-preview-box');

        const previewTitle = new Gtk.Label({
            label: this.translate('RESTORE_POINT_WALLPAPER_PREVIEW'),
            xalign: 0
        });
        previewTitle.get_style_context().add_class('field-label');

        const previewImage = new Gtk.Image();
        previewImage.set_hexpand?.(true);
        previewImage.set_halign?.(Gtk.Align.START);
        previewImage.set_size_request?.(420, 220);
        previewImage.get_style_context?.().add_class?.('restore-point-preview-image');

        const previewTextView = new Gtk.TextView({
            editable: false,
            cursor_visible: false,
            monospace: true,
            wrap_mode: Gtk.WrapMode.WORD_CHAR
        });
        previewTextView.set_size_request?.(420, 220);
        previewTextView.get_style_context?.().add_class?.('restore-point-preview-text');
        const previewTextScroll = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 220
        });
        previewTextScroll.get_style_context?.().add_class?.('restore-point-preview-text-scrolled');
        previewTextScroll.add(previewTextView);

        const previewHint = new Gtk.Label({label: '', xalign: 0});
        previewHint.get_style_context().add_class('field-label');
        previewHint.get_style_context().add_class('restore-point-preview-hint');

        previewBox.pack_start(previewTitle, false, false, 0);
        previewBox.pack_start(previewImage, false, false, 0);
        previewBox.pack_start(previewTextScroll, false, false, 0);
        previewBox.pack_start(previewHint, false, false, 0);
        previewBox.hide?.();

        const treeContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            hexpand: true,
            vexpand: true
        });

        const actionsRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });
        actionsRow.get_style_context().add_class('restore-point-actions');
        actionsRow.get_style_context().add_class('restore-point-editor-actions');

        const addFolderBtn = new Gtk.Button({label: this.translate('RESTORE_POINT_ACTION_ADD_FOLDER')});
        const addFileBtn = new Gtk.Button({label: this.translate('RESTORE_POINT_ACTION_ADD_FILE')});
        const editSelectedBtn = new Gtk.Button({label: this.translate('RESTORE_POINT_ACTION_EDIT_SELECTED')});

        [addFolderBtn, addFileBtn, editSelectedBtn].forEach((button) => {
            button.get_style_context().add_class('restore-point-editor-btn');
            ViewUtils.addPointerCursor?.(button);
            actionsRow.pack_start(button, false, false, 0);
        });

        let currentTreeView = null;
        let currentPointRootPath = '';
        let previewSelection = null;
        let previewSelectionSignal = null;
        let rowActivatedSignal = null;
        const hidePreview = () => {
            previewImage.clear?.();
            previewImage.hide?.();
            previewTextScroll.hide?.();
            previewTextView.get_buffer?.()?.set_text?.('', -1);
            previewHint.set_text('');
            previewBox.hide?.();
        };
        const openPathWithDefaultApp = (absolutePath) => {
            const path = String(absolutePath || '').trim(),
                file = path.length ? Gio.File.new_for_path(path) : null,
                uri = file?.query_exists(null) ? file.get_uri?.() : null;
            uri && (() => {
                try {
                    Gio.app_info_launch_default_for_uri(uri, null);
                } catch (_error) {
                    try {
                        GLib.spawn_command_line_async(`xdg-open ${GLib.shell_quote(path)}`);
                    } catch (fallbackError) {
                        const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                        console.debug(`[ThemeSelectorViewWindow] openPathWithDefaultApp failed: ${message}`);
                    }
                }
            })();
        };
        const buildTextPreview = (value = '') => {
            const text = String(value || '');
            const maxLen = 12000;
            return text.length > maxLen
                ? `${text.slice(0, maxLen)}\n\n...`
                : text;
        };
        const updateImagePreview = (selection) => {
            let relativePath = String(selection?.relativePath || '').trim(),
                shouldShowPreview = selection?.typeRaw === 'file'
                    && currentPointRootPath.length > 0
                    && relativePath.length > 0;
            if (!shouldShowPreview) return hidePreview();

            let absolutePath = GLib.build_filenamev([currentPointRootPath, relativePath]),
                isValidFile = GLib.file_test(absolutePath, GLib.FileTest.EXISTS)
                    && !GLib.file_test(absolutePath, GLib.FileTest.IS_DIR);
            if (!isValidFile) return hidePreview();

            try {
                let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(absolutePath, 420, 220, true);
                if (!pixbuf) throw new Error('pixbuf-null');
                previewImage.set_from_pixbuf?.(pixbuf);
                previewHint.set_text(relativePath);
                previewTitle.show?.();
                previewImage.show?.();
                previewTextScroll.hide?.();
                previewBox.show?.();
                previewHint.show?.();
                return;
            } catch (_error) {
                let textContent = this.controller?.loadRestorePointFileText?.(pointId, relativePath);
                if (textContent === null) return hidePreview();
                previewTextView.get_buffer?.()?.set_text?.(buildTextPreview(textContent), -1);
                previewHint.set_text(relativePath);
                previewTitle.show?.();
                previewImage.hide?.();
                previewTextScroll.show?.();
                previewBox.show?.();
                previewHint.show?.();
            }
        };
        const withSelection = (handler) => {
            const selection = this.getRestorePointTreeSelection(currentTreeView);
            return handler(selection);
        };

        const refreshDetails = () => {
            let details = this.controller?.getRestorePointDetails?.(pointId, {maxNodes: 20000});
            if (!details) return (
                this.showNotification(this.translate('RESTORE_POINT_DETAILS_LOAD_ERROR'), 'error'),
                dialog.destroy?.(),
                undefined
            );

            let timestamp = details?.point?.timestamp || this.translate('UNKNOWN');
            let typeText = details?.point?.type === 'automatic'
                ? this.translate('RESTORE_POINT_TYPE_AUTOMATIC')
                : this.translate('RESTORE_POINT_TYPE_MANUAL');
            let sourceTheme = details?.point?.sourceTheme || 'default',
                folders = Array.isArray(details?.topFolders) && details.topFolders.length > 0
                ? details.topFolders.join(', ')
                : '-';

            timestampLabel.set_text(timestamp);
            metaLabel.set_text(this.translate('RESTORE_POINT_META', {
                type: typeText,
                source: sourceTheme
            }));
            sizeLabel.set_text(this.translate('RESTORE_POINT_DETAILS_TOTAL_SIZE', {size: details?.totalSizeLabel || '0 B'}));
            foldersLabel.set_text(this.translate('RESTORE_POINT_DETAILS_TOP_FOLDERS', {folders}));
            currentPointRootPath = String(details?.path || '');

            (treeContainer.get_children?.() || []).forEach((child) => treeContainer.remove(child));
            let treeData = this.buildRestorePointTreeView(details.tree),
                treeWidget = treeData?.widget || treeData;
            currentTreeView = treeData?.treeView || null;
            treeContainer.pack_start(treeWidget, true, true, 0);
            treeContainer.show_all();
            this.primeRestorePointTreeView(currentTreeView);
            previewSelection && previewSelectionSignal && previewSelection.disconnect?.(previewSelectionSignal);
            previewSelection = currentTreeView?.get_selection?.() || null;
            previewSelectionSignal = previewSelection?.connect?.('changed', () => {
                let selected = this.getRestorePointTreeSelection(currentTreeView);
                updateImagePreview(selected);
            }) || null;
            rowActivatedSignal && currentTreeView?.disconnect?.(rowActivatedSignal);
            rowActivatedSignal = currentTreeView?.connect?.('row-activated', () => {
                let selected = this.getRestorePointTreeSelection(currentTreeView),
                    isFileSelection = Boolean(selected) && selected.typeRaw === 'file',
                    relative = String(selected.relativePath || '').trim();
                isFileSelection
                    && relative
                    && currentPointRootPath
                    && openPathWithDefaultApp(GLib.build_filenamev([currentPointRootPath, relative]));
            }) || null;
            updateImagePreview(this.getRestorePointTreeSelection(currentTreeView));
        };

        editSelectedBtn.connect('clicked', () => withSelection((selection) => {
            switch (true) {
            case !selection || selection.typeRaw !== 'file':
                this.showNotification(this.translate('RESTORE_POINT_EDIT_SELECT_FILE_FIRST'), 'info');
                return;
            default:
                break;
            }

            const fileText = this.controller?.loadRestorePointFileText?.(pointId, selection.relativePath);
            switch (true) {
            case fileText === null:
                this.showNotification(this.translate('RESTORE_POINT_EDIT_UNSUPPORTED_FILE'), 'error');
                return;
            default:
                break;
            }

            const updatedTextContent = this.askRestorePointFileContent({
                title: this.translate('RESTORE_POINT_EDIT_FILE_TITLE'),
                label: this.translate('RESTORE_POINT_EDIT_FILE_LABEL', {path: selection.relativePath}),
                defaultValue: fileText
            });
            switch (true) {
            case updatedTextContent === null:
                return;
            default:
                break;
            }

            const ok = this.controller?.saveRestorePointFileText?.(pointId, selection.relativePath, updatedTextContent);
            switch (true) {
            case Boolean(ok):
                this.showNotification(this.translate('RESTORE_POINT_EDIT_SAVED'), 'info');
                refreshDetails();
                return;
            default:
                this.showNotification(this.translate('RESTORE_POINT_EDIT_SAVE_ERROR'), 'error');
            }
        }));

        addFolderBtn.connect('clicked', () => withSelection((selection) => {
            const baseDir = this.resolveRestoreTargetDir(selection);
            const folderName = this.askRestorePointPathInput({
                title: this.translate('RESTORE_POINT_ADD_FOLDER_TITLE'),
                label: this.translate('RESTORE_POINT_ADD_FOLDER_LABEL'),
                defaultValue: ''
            });
            const hasFolderName = Boolean(folderName);
            return hasFolderName
                ? (() => {
                    const targetRelativePath = this.joinRestoreRelativePath(baseDir, folderName);
                    const ok = this.controller?.createRestorePointFolder?.(pointId, targetRelativePath);
                    switch (true) {
                    case Boolean(ok):
                        this.showNotification(this.translate('RESTORE_POINT_FOLDER_ADDED'), 'info');
                        refreshDetails();
                        return;
                    default:
                        this.showNotification(this.translate('RESTORE_POINT_FOLDER_ADD_ERROR'), 'error');
                    }
                })()
                : undefined;
        }));

        addFileBtn.connect('clicked', () => {
            const selection = this.getRestorePointTreeSelection(currentTreeView);
            const sourcePath = this.pickRestorePointImportFile();
            const hasSourcePath = Boolean(sourcePath);
            return hasSourcePath
                ? (() => {
                    const baseDir = this.resolveRestoreTargetDir(selection) || 'configs';
                    const imported = this.controller?.importFileIntoRestorePoint?.(pointId, sourcePath, baseDir)
                        || this.controller?.importFileIntoRestorePoint?.(pointId, sourcePath, '');
                    switch (true) {
                    case Boolean(imported):
                        this.showNotification(this.translate('RESTORE_POINT_FILE_IMPORTED', {path: imported}), 'info');
                        refreshDetails();
                        return;
                    default:
                        this.showNotification(this.translate('RESTORE_POINT_FILE_IMPORT_ERROR'), 'error');
                    }
                })()
                : undefined;
        });

        contentArea.pack_start(headerBox, false, false, 0);
        contentArea.pack_start(previewBox, false, false, 0);
        contentArea.pack_start(actionsRow, false, false, 0);
        contentArea.pack_start(treeContainer, true, true, 0);
        refreshDetails();

        dialog.connect('response', () => dialog.destroy?.());
        dialog.connect('destroy', () => {
            previewSelection && previewSelectionSignal && previewSelection.disconnect?.(previewSelectionSignal);
            rowActivatedSignal && currentTreeView?.disconnect?.(rowActivatedSignal);
            this.restorePointDetailsDialog = null;
        });

        this.restorePointDetailsDialog = dialog;
        dialog.show_all();
        hidePreview();
        ViewUtils.setupPointerCursors?.(dialog);
    }
}
