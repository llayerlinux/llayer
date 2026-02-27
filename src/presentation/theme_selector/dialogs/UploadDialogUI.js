import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import * as ViewUtils from '../../common/ViewUtils.js';
import { THEME_PROPERTY_DEFINITIONS } from '../../../infrastructure/constants/ThemeProperties.js';
import {
    SUPPORTED_ARCHIVE_PATTERNS,
    SUPPORTED_IMAGE_PATTERNS,
    SUPPORTED_PREVIEW_SIZES
} from '../../common/FileFilters.js';

class UploadDialogUI {
    open() {
        this.dialog = new Gtk.Dialog({
            title: this.t('ADD_CONFIG_DIALOG_TITLE'),
            transient_for: this.parentWindow,
            modal: true
        });
        this.isDisposed = false;
        this.dialog.connect('destroy', () => {
            this.isDisposed = true;
            this.onClose?.();
        });
        this.dialog.set_resizable(false);
        this.dialog.set_default_size(340, 680);
        this.dialog.get_style_context().add_class('config-dialog');
        this.cssProvider && this.dialog.get_style_context().add_provider(this.cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        this.dialog.get_content_area().add(this.buildContent());
        this.setupKeyboardShortcuts();
        this.translateWidgets(this.dialog);
        this.dialog.show_all();
        ViewUtils.setupPointerCursors(this.dialog);
    }

    buildContent() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_top: 16,
            margin_bottom: 24,
            margin_start: 18,
            margin_end: 24
        });
        const header = new Gtk.Label({label: this.t('ADD_CONFIG_DIALOG_TITLE'), halign: Gtk.Align.START, xalign: 0});
        header.get_style_context().add_class('header-label');
        box.pack_start(header, false, false, 4);

        const selectorsRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 24, hexpand: true});
        selectorsRow.set_halign(Gtk.Align.FILL);
        selectorsRow.set_margin_bottom(12);
        selectorsRow.pack_start(this.createArchiveSelector(), true, true, 0);
        selectorsRow.pack_start(this.createPreviewSelector(), true, true, 0);
        box.pack_start(selectorsRow, false, false, 0);

        this.addLabel(box, this.t('CONFIG_NAME'));
        this.fields.nameEntry = this.addEntry(box, '');
        this.addLabel(box, this.t('REPO_ADDRESS'));
        this.fields.repoEntry = this.addEntry(box, 'https://...');
        this.addLabel(box, this.t('PUBLISHED_OPTIONAL'));
        this.fields.publishedEntry = this.addEntry(box, 'https://...');
        this.addLabel(box, this.t('YOUTUBE_LINK_OPTIONAL'));
        this.fields.youtubeLinkEntry = this.addEntry(box, 'https://youtube.com/...');
        this.addLabel(box, `${this.t('AUTHOR_LABEL')}:`);
        this.fields.authorEntry = this.addEntry(box, this.t('AUTHOR_FIELD_PLACEHOLDER'));
        this.addLabel(box, this.t('ADAPTED_BY'));
        this.fields.adaptedEntry = this.addEntry(box, this.t('ADAPTED_BY_PLACEHOLDER'));
        this.addFootnote(box, this.t('ADAPTED_NOTICE'));
        this.createPropertiesSection(box);
        this.addLabel(box, this.t('TAGS'));
        this.fields.tagsEntry = this.addEntry(box, this.t('TAGS_PLACEHOLDER'));
        this.addLabel(box, this.t('PACKAGE_SUPPORT'));
        this.fields.packagesEntry = this.addEntry(box, this.t('PACKAGE_SUPPORT_PLACEHOLDER'));
        this.addFootnote(box, this.t('PACKAGE_NOTICE'));
        this.addLabel(box, this.t('EDIT_PASSWORD'));
        this.fields.passEntry = new Gtk.Entry({visibility: false, hexpand: true});
        this.fields.passEntry.set_margin_bottom(4);
        box.pack_start(this.fields.passEntry, false, false, 0);
        this.addFootnote(box, this.t('PASSWORD_NOTICE'));

        this.statusLabel = new Gtk.Label({label: '', wrap: true, xalign: 0, halign: Gtk.Align.START, visible: false});
        this.statusLabel.get_style_context().add_class('upload-status-label');
        box.pack_start(this.statusLabel, false, false, 0);
        box.pack_end(this.createButtonRow(), false, false, 0);
        return box;
    }

    createArchiveSelector() {
        const { column, button } = this.createUploadSelectorColumn({
            label: this.t('UPLOAD_SELECT_ARCHIVE'),
            buttonField: 'archiveBtn',
            refreshIconField: 'archiveRefreshIcon',
            nameLabelField: 'archiveNameLabel'
        });

        button.connect('clicked', () => {
            const homeDir = GLib.get_home_dir();
            const themesDir = GLib.build_filenamev([homeDir, '.config', 'themes']);
            this.openUploadFileChooser({
                title: this.t('UPLOAD_ARCHIVE_DIALOG_TITLE'),
                filterName: this.t('UPLOAD_ARCHIVE_FILTER_NAME'),
                patterns: SUPPORTED_ARCHIVE_PATTERNS,
                showHidden: true,
                currentFolder: GLib.file_test(themesDir, GLib.FileTest.IS_DIR) ? themesDir : homeDir,
                onAccept: (path) => this.applyArchivePath(path, { suggestName: false })
            });
        });

        return column;
    }

    createPreviewSelector() {
        const { column, button } = this.createUploadSelectorColumn({
            label: this.t('UPLOAD_SELECT_PREVIEW'),
            buttonField: 'previewBtn',
            refreshIconField: 'previewRefreshIcon',
            nameLabelField: 'previewNameLabel'
        });

        this.previewImageContainer = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        this.previewImageContainer.set_halign(Gtk.Align.CENTER);
        this.previewImageContainer.set_margin_top(8);

        button.connect('clicked', () => {
            this.openUploadFileChooser({
                title: this.t('UPLOAD_PREVIEW_DIALOG_TITLE'),
                filterName: this.t('UPLOAD_PREVIEW_FILTER_NAME'),
                patterns: SUPPORTED_IMAGE_PATTERNS,
                currentFolder: GLib.get_home_dir(),
                onAccept: (path) => {
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
                    if (!pixbuf) {
                        return (this.showImageError(path), false);
                    }

                    const width = pixbuf.get_width();
                    const height = pixbuf.get_height();
                    const isSupportedSize = SUPPORTED_PREVIEW_SIZES.some(([supportedWidth, supportedHeight]) =>
                        width === supportedWidth && height === supportedHeight
                    );
                    if (!isSupportedSize) {
                        return (this.showImageSizeError(width, height), false);
                    }

                    this.applyPreviewPath(path);
                    return true;
                }
            });
        });
        column.pack_start(this.previewImageContainer, false, false, 0);
        const footnote = new Gtk.Label({label: this.t('PREVIEW_NOTICE'), wrap: true, xalign: 0});
        footnote.get_style_context().add_class('footnote');
        footnote.set_margin_top(6);
        footnote.set_margin_bottom(8);
        column.pack_start(footnote, false, false, 0);
        return column;
    }

    createUploadSelectorColumn({ label, buttonField, refreshIconField, nameLabelField }) {
        const column = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        column.set_hexpand(true);
        column.set_halign(Gtk.Align.FILL);

        const title = new Gtk.Label({label, halign: Gtk.Align.CENTER, xalign: 0.5});
        title.get_style_context().add_class('field-label');
        title.set_margin_top(6);
        title.set_margin_bottom(2);
        column.pack_start(title, false, false, 0);

        const buttonContainer = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        buttonContainer.set_margin_top(8);
        buttonContainer.set_halign(Gtk.Align.CENTER);

        const plusIcon = new Gtk.Image({icon_name: 'list-add-symbolic', icon_size: Gtk.IconSize.BUTTON});
        this[refreshIconField] = new Gtk.Image({icon_name: 'view-refresh-symbolic', icon_size: Gtk.IconSize.BUTTON});
        this[buttonField] = new Gtk.Button();
        this[buttonField].set_image(plusIcon);
        this[buttonField].set_always_show_image(true);
        this[buttonField].set_size_request(42, 42);
        this[buttonField].get_style_context().add_class('plus-btn');
        ViewUtils.addPointerCursor(this[buttonField]);
        buttonContainer.pack_start(this[buttonField], false, false, 0);
        column.pack_start(buttonContainer, false, false, 4);

        const nameContainer = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        nameContainer.set_halign(Gtk.Align.CENTER);
        this[nameLabelField] = new Gtk.Label({label: '', margin_top: 6});
        nameContainer.pack_start(this[nameLabelField], false, false, 0);
        column.pack_start(nameContainer, false, false, 0);

        return {
            column,
            button: this[buttonField]
        };
    }

    openUploadFileChooser({
        title,
        filterName,
        patterns,
        currentFolder = null,
        showHidden = false,
        onAccept = null
    }) {
        ViewUtils.openFileChooserDialog({
            title,
            action: Gtk.FileChooserAction.OPEN,
            parent: this.dialog,
            showHidden,
            currentFolder,
            filters: [{name: filterName, patterns}],
            buttons: [
                {label: this.t('CANCEL'), response: Gtk.ResponseType.CANCEL},
                {label: this.t('OPEN'), response: Gtk.ResponseType.ACCEPT}
            ],
            translateWidgets: (widget) => this.translateWidgets(widget),
            onResponse: (chooser, response) => {
                if (response !== Gtk.ResponseType.ACCEPT) {
                    return;
                }
                const path = chooser.get_filename();
                return typeof onAccept === 'function' ? onAccept(path) !== false : true;
            }
        });
    }

    createPropertiesSection(box) {
        const propsLabelBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        propsLabelBox.set_margin_top(6);
        propsLabelBox.set_margin_bottom(2);
        const propsLabel = new Gtk.Label({label: `${this.t('PROPERTIES')}:`, halign: Gtk.Align.START});
        propsLabel.get_style_context().add_class('field-label');
        propsLabelBox.pack_start(propsLabel, false, false, 0);
        const helpBtn = new Gtk.Button();
        helpBtn.set_image(new Gtk.Image({
            icon_name: 'dialog-information-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        }));
        helpBtn.get_style_context().add_class('circular');
        helpBtn.get_style_context().add_class('flat');
        helpBtn.set_tooltip_text(this.t('PROPERTIES_HELP'));
        ViewUtils.addPointerCursor(helpBtn);
        helpBtn.connect('clicked', () => this.showPropertiesHelp());
        propsLabelBox.pack_start(helpBtn, false, false, 0);
        box.pack_start(propsLabelBox, false, false, 0);

        THEME_PROPERTY_DEFINITIONS.forEach(({labelKey, code, accentClass, checkboxField}) => {
            const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
            row.set_margin_bottom(2);
            const chk = new Gtk.CheckButton({label: this.t(labelKey)});
            this.fields[checkboxField] = chk;
            const accent = new Gtk.Label({label: code});
            accent.get_style_context().add_class(accentClass);
            row.pack_start(chk, false, false, 0);
            row.pack_start(accent, false, false, 0);
            box.pack_start(row, false, false, 0);
        });
    }

    createButtonRow() {
        const btnRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 16, margin_top: 12});
        btnRow.set_halign(Gtk.Align.END);
        this.progressSpinner = new Gtk.Spinner();
        this.progressSpinner.set_no_show_all(true);
        this.btnUpload = new Gtk.Button();
        const btnUploadBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 0});
        btnUploadBox.set_halign(Gtk.Align.FILL);
        btnUploadBox.set_hexpand(true);

        const labelBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        labelBox.set_halign(Gtk.Align.CENTER);
        this.btnUploadText = new Gtk.Label({label: this.t('UPLOAD_TO_SERVER')});
        labelBox.pack_start(this.btnUploadText, false, false, 0);
        btnUploadBox.pack_start(labelBox, true, true, 0);

        this.btnUploadProgress = new Gtk.ProgressBar({show_text: false});
        this.btnUploadProgress.set_no_show_all(true);
        this.btnUploadProgress.hide();
        this.btnUploadProgress.set_hexpand(true);
        this.btnUploadProgress.set_halign(Gtk.Align.FILL);
        this.btnUploadProgress.set_margin_start(10);
        this.btnUploadProgress.set_margin_end(10);
        this.btnUploadProgress.set_margin_bottom(8);
        this.btnUploadProgress.set_fraction(0);
        this.btnUploadProgress.set_size_request(-1, 6);
        this.btnUploadProgress.get_style_context().add_class('upload-btn-progress');
        btnUploadBox.pack_end(this.btnUploadProgress, false, false, 0);

        this.btnUpload.add(btnUploadBox);
        this.btnUpload.get_style_context().add_class('upload-btn');
        this.btnUpload.get_style_context().add_class('suggested-action');
        ViewUtils.addPointerCursor(this.btnUpload);
        this.btnUpload.connect('clicked', () => this.handleUpload());
        this.btnCancel = new Gtk.Button({label: this.t('CANCEL')});
        this.btnCancel.get_style_context().add_class('cancel-btn');
        ViewUtils.addPointerCursor(this.btnCancel);
        this.btnCancel.connect('clicked', () => {
            (this.isUploading && this.cancelUpload) && this.cancelUpload();
            this.dialog?.destroy();
        });
        btnRow.pack_start(this.progressSpinner, false, false, 0);
        btnRow.pack_start(this.btnUpload, false, false, 0);
        btnRow.pack_start(this.btnCancel, false, false, 0);
        return btnRow;
    }

    showPropertiesHelp() {
        ViewUtils.showPropertiesHelp({ translator: this.t, parent: this.dialog, cssProvider: this.cssProvider });
    }

    addLabel(box, text) {
        const l = new Gtk.Label({label: text, halign: Gtk.Align.START, xalign: 0});
        l.get_style_context().add_class('field-label');
        l.set_margin_top(6);
        l.set_margin_bottom(2);
        box.pack_start(l, false, false, 0);
        return l;
    }

    addEntry(box, placeholder) {
        const e = new Gtk.Entry({hexpand: true});
        placeholder && e.set_placeholder_text(placeholder);
        e.set_margin_bottom(4);
        box.pack_start(e, false, false, 0);
        return e;
    }

    addFootnote(box, text) {
        const f = new Gtk.Label({label: text, wrap: true, xalign: 0});
        f.get_style_context().add_class('footnote');
        f.set_margin_top(2);
        f.set_margin_bottom(4);
        box.pack_start(f, false, false, 0);
        return f;
    }
}

export function applyUploadDialogUI(prototype) {
    copyPrototypeDescriptors(prototype, UploadDialogUI.prototype);
}
