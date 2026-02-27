import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, setupPointerCursors } from '../../common/ViewUtils.js';
import { THEME_PROPERTY_DEFINITIONS } from '../../../infrastructure/constants/ThemeProperties.js';

class ServerEditViewDialogUI {
    createFootnoteLabel(text) {
        const label = new Gtk.Label({
            label: text,
            wrap: true,
            xalign: 0,
        });
        label.get_style_context().add_class('footnote');
        return label;
    }

    createPropertiesCheckboxes(t, theme, box) {
        const fields = {},
            properties = theme?.properties ?? {},
            propsLabelBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6}),
            propsLabel = new Gtk.Label({label: t('PROPERTIES'), halign: Gtk.Align.START});
        propsLabel.get_style_context().add_class('field-label');
        propsLabelBox.pack_start(propsLabel, false, false, 0);

        const helpBtn = new Gtk.Button();
        helpBtn.set_image(new Gtk.Image({icon_name: 'dialog-information-symbolic', icon_size: Gtk.IconSize.SMALL_TOOLBAR}));
        helpBtn.get_style_context().add_class('circular');
        helpBtn.get_style_context().add_class('flat');
        helpBtn.set_tooltip_text(t('PROPERTIES_HELP'));
        addPointerCursor(helpBtn);
        helpBtn.connect('clicked', () => this.showPropertiesHelp());
        propsLabelBox.pack_start(helpBtn, false, false, 0);
        box.pack_start(propsLabelBox, false, false, 0);

        THEME_PROPERTY_DEFINITIONS.forEach(({labelKey, code, accentClass, key, checkboxField}) => {
            const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6}),
                chk = new Gtk.CheckButton({label: t(labelKey)}),
                accentLabel = new Gtk.Label({label: code});
            chk.set_active(properties[key] === true);
            fields[checkboxField] = chk;
            accentLabel.get_style_context().add_class(accentClass);
            row.pack_start(chk, false, false, 0);
            row.pack_start(accentLabel, false, false, 0);
            box.pack_start(row, false, false, 0);
        });

        return fields;
    }

    createDialog(theme, login, password, settings, t = (key) => key) {
        this.theme = theme;
        this.login = login;
        this.password = password;
        this.settings = settings;
        this.archivePath = null;
        this.previewPath = null;
        this.applyArchivePath = null;
        this.applyPreviewPath = null;

        this.dialog = new Gtk.Dialog({
            title: t('EDIT_THEME_DIALOG_TITLE'),
            modal: true,
            resizable: false,
            default_width: 400
        });
        this.dialog.get_style_context().add_class('config-dialog');

        this.setupKeyboardShortcuts();

        const content = this.dialog.get_content_area();

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 16,
            margin_bottom: 24,
            margin_start: 18,
            margin_end: 24,
        });

        const header = new Gtk.Label({
            label: t('EDIT_THEME_DIALOG_TITLE'),
            halign: Gtk.Align.START,
            xalign: 0,
        });
        header.get_style_context().add_class('header-label');
        box.pack_start(header, false, false, 4);

        const addLabel = (txt, targetBox = box) => {
            const l = new Gtk.Label({label: txt, halign: Gtk.Align.START, xalign: 0});
            l.get_style_context().add_class('field-label');
            targetBox.pack_start(l, false, false, 2);
            return l;
        };
        const addEntry = ph => {
            const e = new Gtk.Entry({hexpand: true});
            ph && e.set_placeholder_text(ph);
            box.pack_start(e, false, false, 2);
            return e;
        };

        const selectorsRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 24,
            hexpand: true
        });
        selectorsRow.set_halign(Gtk.Align.FILL);
        selectorsRow.set_margin_bottom(12);
        box.pack_start(selectorsRow, false, false, 0);

        const archiveSelector = this.createFileSelector({
            labelText: t('EDIT_REPLACE_ARCHIVE'),
            isPreview: false,
            t,
            onPathSelected: (path) => { this.archivePath = path; }
        });
        this.applyArchivePath = archiveSelector.applyPath;
        selectorsRow.pack_start(archiveSelector.column, true, true, 0);

        const previewColumn = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        previewColumn.set_hexpand(true);
        previewColumn.set_halign(Gtk.Align.FILL);
        selectorsRow.pack_start(previewColumn, true, true, 0);

        const previewSelector = this.createFileSelector({
            labelText: t('EDIT_REPLACE_PREVIEW'),
            isPreview: true,
            t,
            previewSizes: [[512, 512], [1024, 1024]],
            onPathSelected: (path) => { this.previewPath = path; }
        });
        this.applyPreviewPath = previewSelector.applyPath;
        previewColumn.pack_start(previewSelector.column, true, true, 0);

        const previewNotice = this.createFootnoteLabel(t('PREVIEW_NOTICE'));
        previewNotice.set_margin_top(6);
        previewNotice.set_margin_bottom(8);
        previewColumn.pack_start(previewNotice, false, false, 0);

        addLabel(t('CONFIG_NAME'));
        const nameEntry = addEntry('');
        nameEntry.set_text(theme.name || '');

        addLabel(t('REPO_ADDRESS'));
        const repoEntry = addEntry('https://...');
        repoEntry.set_text(theme.repoUrl || '');

        addLabel(t('PUBLISHED_OPTIONAL'));
        const publishedEntry = addEntry('https://...');
        publishedEntry.set_text(theme.published || '');

        addLabel(t('YOUTUBE_LINK_OPTIONAL'));
        const youtubeLinkEntry = addEntry('https://youtube.com/...');
        youtubeLinkEntry.set_text(theme.youtubeLink || '');

        const originalAuthorName = theme.author?.label || theme.author?.name || theme.author || '';
        const originalAuthorUrl = theme.author?.url || theme.author_url || '';

        addLabel(t('ADAPTED_BY'));
        const adaptedEntry = addEntry(t('ADAPTED_BY_PLACEHOLDER'));
        const adaptedText = theme.adaptedBy
            ? `${theme.adaptedBy.label || theme.adaptedBy.name || theme.adaptedBy} | ${theme.adaptedBy.url || theme.adapted_by_url || ''}`
            : '';
        adaptedEntry.set_text(adaptedText);

        box.pack_start(this.createFootnoteLabel(t('ADAPTED_NOTICE')), false, false, 0);

        const propFields = this.createPropertiesCheckboxes(t, theme, box);
        const {chkMulti, chkDesktopPlus, chkFamiliar, chkWidgets, chkUnique} = propFields;

        addLabel(t('TAGS'));
        const tagsEntry = addEntry(t('TAGS_PLACEHOLDER'));
        tagsEntry.set_text(Array.isArray(theme.tags) ? theme.tags.join(', ') : (theme.tags || ''));

        addLabel(t('PACKAGE_SUPPORT'));
        const packagesEntry = addEntry(t('PACKAGE_SUPPORT_PLACEHOLDER'));
        packagesEntry.set_text(Array.isArray(theme.packageSupport) ? theme.packageSupport.join(', ') : (theme.packageSupport || ''));

        box.pack_start(this.createFootnoteLabel(t('PACKAGE_NOTICE')), false, false, 0);

        addLabel(t('EDIT_PASSWORD'));
        const passEntry = new Gtk.Entry({visibility: false});
        passEntry.set_text(password || '');
        box.pack_start(passEntry, false, false, 2);

        box.pack_start(this.createFootnoteLabel(t('PASSWORD_NOTICE')), false, false, 0);

        addLabel(t('CHANGE_PASSWORD'));
        const newPassEntry = new Gtk.Entry({visibility: false});
        newPassEntry.set_placeholder_text(t('NEW_PASSWORD_PLACEHOLDER'));
        box.pack_start(newPassEntry, false, false, 2);

        box.pack_start(this.createFootnoteLabel(t('CHANGE_PASSWORD_NOTICE')), false, false, 0);

        const btnRowOuter = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        btnRowOuter.set_hexpand(true);

        const trashIcon = new Gtk.Image({icon_name: 'user-trash-symbolic', icon_size: Gtk.IconSize.BUTTON});
        const btnDelete = new Gtk.Button();
        btnDelete.set_image(trashIcon);
        btnDelete.set_always_show_image(true);
        btnDelete.set_tooltip_text(t('DELETE_THEME'));
        btnDelete.get_style_context().add_class('delete-btn');
        btnDelete.get_style_context().add_class('destructive-action');
        addPointerCursor(btnDelete);

        const btnRowRight = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        btnRowRight.set_halign(Gtk.Align.END);

        const btnApply = new Gtk.Button({label: t('UPDATE_ON_SERVER')});
        btnApply.get_style_context().add_class('commit-btn');
        btnApply.get_style_context().add_class('suggested-action');
        addPointerCursor(btnApply);

        const btnCancel = new Gtk.Button({label: t('CANCEL')});
        btnCancel.get_style_context().add_class('cancel-btn');
        addPointerCursor(btnCancel);

        btnRowRight.pack_start(btnApply, false, false, 0);
        btnRowRight.pack_start(btnCancel, false, false, 0);

        btnRowOuter.pack_start(btnDelete, false, false, 0);
        btnRowOuter.pack_end(btnRowRight, false, false, 0);
        box.pack_end(btnRowOuter, false, false, 0);

        this.applyButton = btnApply;
        this.cancelButton = btnCancel;
        this.deleteButton = btnDelete;

        btnApply.connect('clicked', () => {
            const requiredError = this.validateRequiredFields([
                {value: nameEntry.get_text(), msg: t('ERROR_NAME_REQUIRED')},
                {value: repoEntry.get_text(), msg: t('ERROR_REPO_REQUIRED')},
                {value: passEntry.get_text(), msg: t('ERROR_PASSWORD_REQUIRED')},
            ]);
            if (requiredError) {
                this.showError(requiredError);
                return;
            }

            const updatePayload = this.buildUpdatePayload({
                entries: {
                    nameEntry,
                    repoEntry,
                    publishedEntry,
                    youtubeLinkEntry,
                    adaptedEntry,
                    tagsEntry,
                    packagesEntry,
                    passEntry,
                    newPassEntry
                },
                toggles: {
                    chkMulti,
                    chkDesktopPlus,
                    chkFamiliar,
                    chkWidgets,
                    chkUnique
                },
                originalAuthorName,
                originalAuthorUrl
            });

            this.handleCommit(updatePayload);
        });

        btnCancel.connect('clicked', () => {
            this.hideDialog();
            this.handleClose();
        });

        btnDelete.connect('clicked', () => {
            const currentPassword = passEntry.get_text();
            if (!currentPassword) {
                this.showError(t('ERROR_PASSWORD_REQUIRED'));
                return;
            }
            this.handleDelete(currentPassword);
        });

        const errorLabel = new Gtk.Label({
            label: '',
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        errorLabel.get_style_context().add_class('error-label');
        errorLabel.set_no_show_all(true);
        errorLabel.hide();
        this.errorLabel = errorLabel;
        box.pack_start(errorLabel, false, false, 0);

        const spinnerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 10,
            halign: Gtk.Align.START
        });
        const spinner = new Gtk.Spinner();
        const spinnerLabel = new Gtk.Label({
            label: t('UPLOADING'),
            halign: Gtk.Align.START,
            xalign: 0
        });
        spinnerBox.pack_start(spinner, false, false, 0);
        spinnerBox.pack_start(spinnerLabel, false, false, 0);
        spinnerBox.set_no_show_all(true);
        spinnerBox.hide();
        this.spinnerBox = spinnerBox;
        this.spinner = spinner;
        this.spinnerLabel = spinnerLabel;
        box.pack_start(spinnerBox, false, false, 0);

        content.add(box);

        this.dialog.connect('delete-event', () => {
            this.hideDialog();
            this.handleClose();
            return true;
        });
        this.dialog.show_all();
        setupPointerCursors(this.dialog);
        spinnerBox.hide();
        errorLabel.hide();
    }
}

export function applyServerEditViewDialogUI(prototype) {
    copyPrototypeDescriptors(prototype, ServerEditViewDialogUI.prototype);
}
