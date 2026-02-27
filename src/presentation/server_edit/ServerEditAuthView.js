import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor, applyOptionalSetters, setupPointerCursors} from '../common/ViewUtils.js';

export class ServerEditAuthView {
    constructor() {
        this.dialog = null;
        this.loginEntry = null;
        this.passwordEntry = null;
        this.errorLabel = null;
        this.loginButton = null;
        this.cancelButton = null;
        this.translator = (key) => key;
        this.handlers = {
            submit: null,
            cancel: null
        };
        this.busy = false;
    }

    createFieldLabel(text) {
        return new Gtk.Label({
            label: text,
            halign: Gtk.Align.START,
            xalign: 0
        });
    }

    open(options = {}) {
        const {theme, translator, onSubmit, onCancel} = options;

        this.destroy();

        this.translator = translator || ((key) => key);
        this.handlers.submit = onSubmit || null;
        this.handlers.cancel = onCancel || null;

        const dialog = new Gtk.Dialog({
            title: this.t('AUTH_DIALOG_TITLE'),
            modal: true,
            resizable: false,
            default_width: 420,
            use_header_bar: true
        });
        dialog.set_position(Gtk.WindowPosition.CENTER_ALWAYS);

        const content = dialog.get_content_area();
        content.set_margin_top(24);
        content.set_margin_bottom(8);
        content.set_margin_start(24);
        content.set_margin_end(24);

        const root = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 14
        });
        content.add(root);

        const titleLabel = new Gtk.Label({
            label: this.t('AUTH_REQUEST_TITLE'),
            halign: Gtk.Align.CENTER
        });
        titleLabel.get_style_context().add_class('header-label');
        root.pack_start(titleLabel, false, false, 0);

        const authorLabel = this.createFieldLabel(this.t('AUTHOR_NAME'));
        root.pack_start(authorLabel, false, false, 0);

        const loginEntry = new Gtk.Entry({hexpand: true});
        loginEntry.set_placeholder_text(this.t('ENTER_AUTHOR_NAME'));
        const themeAuthor = this.getThemeAuthor(theme);
        applyOptionalSetters([[themeAuthor, (value) => loginEntry.set_text(value), Boolean]]);
        root.pack_start(loginEntry, false, false, 0);

        const passwordLabel = this.createFieldLabel(this.t('PASSWORD'));
        root.pack_start(passwordLabel, false, false, 0);

        const passwordEntry = new Gtk.Entry({
            hexpand: true,
            visibility: false,
            input_purpose: Gtk.InputPurpose.PASSWORD
        });
        passwordEntry.set_placeholder_text(this.t('ENTER_PASSWORD'));
        root.pack_start(passwordEntry, false, false, 0);

        const errorLabel = new Gtk.Label({
            halign: Gtk.Align.CENTER,
            visible: false,
            wrap: true,
            max_width_chars: 48
        });
        errorLabel.get_style_context().add_class('error-text');
        root.pack_start(errorLabel, false, false, 0);

        const buttonRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            halign: Gtk.Align.END,
            margin_top: 12,
            margin_bottom: 0
        });
        root.pack_end(buttonRow, false, false, 0);

        const cancelButton = new Gtk.Button({label: this.t('CANCEL')});
        const loginButton = new Gtk.Button({label: this.t('LOGIN')});
        loginButton.get_style_context().add_class('suggested-action');
        addPointerCursor(cancelButton);
        addPointerCursor(loginButton);

        buttonRow.pack_start(cancelButton, false, false, 0);
        buttonRow.pack_start(loginButton, false, false, 0);

        loginEntry.connect('activate', () => passwordEntry.grab_focus());
        passwordEntry.connect('activate', () => this.handleSubmit());
        cancelButton.connect('clicked', () => this.handleCancel());
        loginButton.connect('clicked', () => this.handleSubmit());

        dialog.connect('delete-event', () => {
            this.handleCancel();
            return true;
        });

        dialog.show_all();
        setupPointerCursors(dialog);

        this.dialog = dialog;
        this.loginEntry = loginEntry;
        this.passwordEntry = passwordEntry;
        this.errorLabel = errorLabel;
        this.loginButton = loginButton;
        this.cancelButton = cancelButton;

        this.busy = false;
        this.hideError();
        this.applyBusyState();
        this.loginEntry.grab_focus();
    }

    showError(message) {
        this.errorLabel && (() => {
            const text = message || this.t('AUTH_FAILED');
            this.errorLabel.set_text(text);
            this.errorLabel.show();
        })();
    }

    setBusy(isBusy) {
        this.busy = Boolean(isBusy);
        this.applyBusyState();
    }

    close() {
        this.destroy();
    }

    destroy() {
        this.dialog?.destroy?.();
        this.dialog = this.loginEntry = this.passwordEntry = this.errorLabel = null;
        this.loginButton = this.cancelButton = null;
        this.busy = false;
        this.handlers.submit = this.handlers.cancel = null;
    }

    handleSubmit() {
        if (this.busy) return;

        const login = (this.loginEntry?.get_text?.() || '').trim(), password = (this.passwordEntry?.get_text?.() || '').trim();
        if (!login || !password) return void this.showError(this.t('FILL_ALL_FIELDS'));

        this.hideError();
        this.setBusy(true);
        this.handlers.submit?.({login, password})?.catch?.((error) => logError(error));
    }

    handleCancel() {
        this.busy && this.setBusy(false);
        const handler = this.handlers.cancel;
        this.destroy();
        handler && handler();
    }

    applyBusyState() {
        const controls = [
            this.loginEntry,
            this.passwordEntry,
            this.loginButton
        ];

        controls.forEach((widget) => {
            widget?.set_sensitive?.(!this.busy);
        });

        this.cancelButton?.set_sensitive?.(true);
    }

    hideError() {
        this.errorLabel && (this.errorLabel.hide(), this.errorLabel.set_text(''));
    }

    getThemeAuthor(theme) {
        if (!theme) {
            return '';
        }
        const author = theme.author || theme.authorName || theme.author_label;
        return typeof author === 'string'
            ? author
            : (author && typeof author === 'object')
            ? (author.label || author.name || author.login || '')
            : '';
    }

    t(key) {
        return this.translator(key);
    }
}
