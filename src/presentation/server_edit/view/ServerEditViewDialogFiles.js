import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import { SUPPORTED_ARCHIVE_PATTERNS, SUPPORTED_IMAGE_PATTERNS } from '../../common/FileFilters.js';
import { addPointerCursor, openFileChooserDialog, showMessageDialog } from '../../common/ViewUtils.js';

class ServerEditViewDialogFiles {
    showErrorDialog(title, secondaryText) {
        showMessageDialog({
            parent: this.dialog,
            messageType: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.OK,
            title,
            secondaryText
        });
    }

    createFileSelector(config) {
        let {labelText, isPreview = false, t, onPathSelected, previewSizes = null} = config;
        let column = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        column.set_hexpand(true);
        column.set_halign(Gtk.Align.FILL);

        let label = new Gtk.Label({label: labelText, halign: Gtk.Align.CENTER, xalign: 0.5});
        label.get_style_context().add_class('field-label');
        column.pack_start(label, false, false, 2);

        let btnContainer = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        btnContainer.set_margin_top(8);
        btnContainer.set_halign(Gtk.Align.CENTER);

        let plusIcon = new Gtk.Image({icon_name: 'list-add-symbolic', icon_size: Gtk.IconSize.BUTTON}),
            refreshIcon = new Gtk.Image({icon_name: 'view-refresh-symbolic', icon_size: Gtk.IconSize.BUTTON});

        let btn = new Gtk.Button();
        btn.set_image(plusIcon);
        btn.set_always_show_image(true);
        btn.set_size_request(42, 42);
        btn.get_style_context().add_class('plus-btn');
        addPointerCursor(btn);
        btnContainer.pack_start(btn, false, false, 0);

        let nameContainer = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        nameContainer.set_halign(Gtk.Align.CENTER);
        let nameLabel = new Gtk.Label({label: '', margin_top: 6});
        nameContainer.pack_start(nameLabel, false, false, 0);

        let imageContainer = isPreview ? new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}) : null;
        imageContainer && (imageContainer.set_halign(Gtk.Align.CENTER), imageContainer.set_margin_top(8));

        let previewImage = null;
        let state = {path: null};
        function ensurePreviewImage() {
            previewImage || (
                previewImage = new Gtk.Image(),
                previewImage.set_size_request(140, 100),
                previewImage.set_halign(Gtk.Align.CENTER),
                previewImage.set_valign(Gtk.Align.CENTER),
                imageContainer.pack_start(previewImage, false, false, 0)
            );
            return previewImage;
        }

        function applyPath(path) {
            if (!path) {
                return;
            }
            state.path = path;
            nameLabel.set_text(GLib.path_get_basename(path) || '');
            btn.set_image(refreshIcon);
            onPathSelected?.(path);

            isPreview && imageContainer && (() => {
                let targetImage = ensurePreviewImage(),
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 140, 100, true);
                targetImage.set_from_pixbuf(pixbuf);
                targetImage.show_all();
            })();
        }

        btn.connect('clicked', () => {
            let homeDir = GLib.get_home_dir(),
                themesDir = GLib.build_filenamev([homeDir, '.config', 'themes']);

            openFileChooserDialog({
                title: isPreview ? t('UPLOAD_PREVIEW_DIALOG_TITLE') : t('UPLOAD_ARCHIVE_DIALOG_TITLE'),
                action: Gtk.FileChooserAction.OPEN,
                parent: this.dialog,
                showHidden: !isPreview,
                currentFolder: isPreview
                    ? homeDir
                    : (GLib.file_test(themesDir, GLib.FileTest.IS_DIR) ? themesDir : homeDir),
                filters: [{
                    name: isPreview ? t('UPLOAD_PREVIEW_FILTER_NAME') : t('UPLOAD_ARCHIVE_FILTER_NAME'),
                    patterns: isPreview ? SUPPORTED_IMAGE_PATTERNS : SUPPORTED_ARCHIVE_PATTERNS
                }],
                buttons: [
                    {label: t('CANCEL'), response: Gtk.ResponseType.CANCEL},
                    {label: t('OPEN'), response: Gtk.ResponseType.ACCEPT}
                ],
                onResponse: (chooser, response) => {
                    if (response !== Gtk.ResponseType.ACCEPT) {
                        return;
                    }

                    let selectedPath = chooser.get_filename(),
                        shouldValidatePreview = isPreview && Array.isArray(previewSizes) && previewSizes.length > 0,
                        pixbuf = shouldValidatePreview ? GdkPixbuf.Pixbuf.new_from_file(selectedPath) : null;

                    let previewValidationPassed = !shouldValidatePreview || (
                        pixbuf
                            ? (() => {
                                let width = pixbuf.get_width(),
                                    height = pixbuf.get_height(),
                                    validSize = previewSizes.some(([w, h]) => w === width && h === height);
                                !validSize && this.showErrorDialog(
                                    t('UPLOAD_IMAGE_SIZE_ERROR_TITLE'),
                                    t('UPLOAD_IMAGE_SIZE_ERROR_TEXT', {width, height})
                                );
                                return validSize;
                            })()
                            : (this.showErrorDialog(t('ERROR'), t('UPLOAD_IMAGE_LOAD_ERROR', {error: selectedPath})), false)
                    );
                    if (!previewValidationPassed) {
                        return false;
                    }

                    applyPath(selectedPath);
                    return true;
                }
            });
        });

        column.pack_start(btnContainer, false, false, 4);
        column.pack_start(nameContainer, false, false, 0);
        imageContainer && column.pack_start(imageContainer, false, false, 0);

        return {column, state, applyPath};
    }

    applyTestData() {
        const archivePath = GLib.getenv('LLAYER_TEST_UPLOAD_ARCHIVE');
        const previewPath = GLib.getenv('LLAYER_TEST_UPLOAD_PREVIEW');
        archivePath && GLib.file_test(archivePath, GLib.FileTest.EXISTS) && this.applyArchivePath?.(archivePath);
        previewPath && GLib.file_test(previewPath, GLib.FileTest.EXISTS) && this.applyPreviewPath?.(previewPath);
    }
}

export function applyServerEditViewDialogFiles(prototype) {
    copyPrototypeDescriptors(prototype, ServerEditViewDialogFiles.prototype);
}
