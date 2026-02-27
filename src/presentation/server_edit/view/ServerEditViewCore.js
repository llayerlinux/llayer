import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import * as ViewUtils from '../../common/ViewUtils.js';

export function applyServerEditViewCore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ServerEditViewCore.prototype);
}

class ServerEditViewCore {
    showPropertiesHelp() {
        const translator = this.getTranslator();
        const cssProvider = this.getThemeSelectorView()?.cssProvider || null;
        ViewUtils?.showPropertiesHelp
            ? ViewUtils.showPropertiesHelp({
                translator,
                parent: this.dialog,
                cssProvider
            })
            : (() => {
                const t = translator || ((key) => key);
                ViewUtils.showMessageDialog({
                    parent: this.dialog,
                    messageType: Gtk.MessageType.INFO,
                    buttons: Gtk.ButtonsType.OK,
                    title: t('PROPERTIES_HELP_TITLE'),
                    secondaryText: t('PROPERTIES_HELP')
                });
            })();
    }

    notify(message) {
        this.showError(message);
    }

    showDialog() {
        this.dialog && (this.dialog.show_all(), ViewUtils.setupPointerCursors(this.dialog));
    }

    hideDialog() {
        this.dialog.hide();
        this.dialog.destroy();
        this.dialog = this.applyButton = this.cancelButton = this.deleteButton = null;
    }

    onCommitCallback(callback) {
        this.onCommit = callback;
    }

    onCloseCallback(callback) {
        this.onClose = callback;
    }

    onDeleteCallback(callback) {
        this.onDelete = callback;
    }

    showError(message) {
        this.errorLabel && (
            this.errorLabel.set_text(message),
            this.errorLabel.get_style_context().add_class('error-text'),
            this.errorLabel.show()
        );
    }

    hideError() {
        this.errorLabel && this.errorLabel.hide();
    }

    setBusy(busy) {
        const disabled = Boolean(busy);
        [this.applyButton, this.cancelButton, this.deleteButton].forEach((button) => {
            button?.set_sensitive?.(!disabled);
        });
        const applySpinnerState = disabled
            ? () => {
                this.spinnerBox.show();
                this.spinner.show();
                this.spinnerLabel?.show?.();
                this.spinner.start();
            }
            : () => {
                this.spinner.stop();
                this.spinnerBox.hide();
            };
        this.spinnerBox && this.spinner && applySpinnerState();
    }

    handleCommit(updateData) {
        return typeof this.onCommit === 'function' ? this.onCommit(updateData) : this.hideDialog();
    }

    handleClose() {
        typeof this.onClose === 'function' && this.onClose();
    }

    handleDelete(password) {
        return typeof this.onDelete === 'function' ? this.onDelete(password) : this.hideDialog();
    }

    validateRequiredFields(required = []) {
        const missing = required.find((field) => !String(field.value ?? '').trim());
        return missing ? missing.msg : null;
    }

    buildUpdatePayload({entries = {}, toggles = {}, originalAuthorName = '', originalAuthorUrl = ''} = {}) {
        const newPassword = this.readEntry(entries.newPassEntry);
        return {
            name: this.readEntry(entries.nameEntry),
            repoUrl: this.readEntry(entries.repoEntry),
            published: this.readEntry(entries.publishedEntry),
            youtubeLink: this.readEntry(entries.youtubeLinkEntry),
            author: {
                label: originalAuthorName,
                url: originalAuthorUrl
            },
            adaptedBy: this.parseLinkEntry(this.readEntry(entries.adaptedEntry)),
            properties: this.buildPropertiesPayload(toggles),
            tags: this.parseCommaSeparated(entries.tagsEntry, {returnArray: false}),
            packageSupport: this.parseCommaSeparated(entries.packagesEntry, {returnArray: true}),
            editPassword: this.readEntry(entries.passEntry),
            newPassword: newPassword || null,
            archivePath: this.archivePath,
            previewPath: this.previewPath
        };
    }

    buildPropertiesPayload(toggles = {}) {
        const readToggle = (key) => Boolean(toggles[key]?.get_active?.());
        return {
            multiConfig: readToggle('chkMulti'),
            desktopPlus: readToggle('chkDesktopPlus'),
            familiar: readToggle('chkFamiliar'),
            widgets: readToggle('chkWidgets'),
            unique: readToggle('chkUnique')
        };
    }

    parseLinkEntry(text = '') {
        const [rawLabel = '', rawUrl = ''] = text.split('|');
        const label = rawLabel.trim();
        const url = rawUrl.trim();
        return label || url ? {label, url} : null;
    }

    parseCommaSeparated(entry, {returnArray = true} = {}) {
        const raw = this.readEntry(entry);
        const parts = raw ? raw.split(',').map((t) => t.trim()).filter(Boolean) : [];
        return returnArray ? parts : parts.join(',');
    }

    readEntry(entry) {
        return typeof entry?.get_text === 'function' ? entry.get_text().trim() : '';
    }

    getFromContainer(name) {
        const candidate = this.container;
        return candidate?.has?.(name) ? candidate.get(name) : null;
    }

    getTranslator() {
        return this.getFromContainer('translator') || ((key) => key);
    }

    getThemeSelectorView() {
        return this.getFromContainer('themeSelectorView');
    }
}
