import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor, applyOptionalSetters} from '../../common/ViewUtils.js';

export class Placeholders {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
    }

    createPlaceholderLabel(text, centered = false) {
        const placeholder = new Gtk.Label({
            label: text,
            sensitive: false,
            margin: 50,
            justify: Gtk.Justification.CENTER
        });
        applyOptionalSetters([[
            centered,
            () => {
                placeholder.set_halign(Gtk.Align.CENTER);
                placeholder.set_valign(Gtk.Align.CENTER);
            },
            Boolean
        ]]);
        placeholder.get_style_context().add_class('placeholder-text');
        return placeholder;
    }

    createLoadingSpinner(labelKey = 'LOADING_NETWORK_THEMES') {
        const loadingBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin: 80
        });
        const spinner = new Gtk.Spinner({width_request: 48, height_request: 48, halign: Gtk.Align.CENTER});
        spinner.start();
        const label = new Gtk.Label({label: this.t(labelKey), halign: Gtk.Align.CENTER});
        label.get_style_context().add_class('loading-label');
        loadingBox.pack_start(spinner, false, false, 0);
        loadingBox.pack_start(label, false, false, 4);
        return loadingBox;
    }

    createPlaceholder(text) {
        return this.createPlaceholderLabel(text, false);
    }

    createCenteredPlaceholder(text) {
        return this.createPlaceholderLabel(text, true);
    }

    createErrorState(errorKey, onRetry = null) {
        const errorBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin: 50
        });
        const icon = new Gtk.Image({
            icon_name: 'dialog-error-symbolic',
            icon_size: Gtk.IconSize.DIALOG,
            halign: Gtk.Align.CENTER
        });
        icon.get_style_context().add_class('error-icon');
        const label = new Gtk.Label({
            label: this.t(errorKey),
            halign: Gtk.Align.CENTER,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            max_width_chars: 40
        });
        label.get_style_context().add_class('error-label');
        errorBox.pack_start(icon, false, false, 0);
        errorBox.pack_start(label, false, false, 0);
        applyOptionalSetters([[onRetry, (handler) => {
            const retryBtn = new Gtk.Button({label: this.t('RETRY_BUTTON')});
            retryBtn.get_style_context().add_class('retry-button');
            addPointerCursor(retryBtn);
            retryBtn.connect('clicked', handler);
            errorBox.pack_start(retryBtn, false, false, 8);
        }, Boolean]]);
        return errorBox;
    }

    createEmptyState(emptyKey, iconName = 'folder-symbolic') {
        const emptyBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin: 50
        });
        const icon = new Gtk.Image({icon_name: iconName, icon_size: Gtk.IconSize.DIALOG, halign: Gtk.Align.CENTER});
        icon.get_style_context().add_class('empty-icon');
        icon.set_opacity(0.5);
        const label = new Gtk.Label({
            label: this.t(emptyKey),
            halign: Gtk.Align.CENTER,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            max_width_chars: 40
        });
        label.get_style_context().add_class('empty-label');
        emptyBox.pack_start(icon, false, false, 0);
        emptyBox.pack_start(label, false, false, 0);
        return emptyBox;
    }

    showLoading(container, labelKey = 'LOADING_NETWORK_THEMES') {
        container.pack_start(this.createLoadingSpinner(labelKey), true, true, 0);
        container.show_all();
    }

    showPlaceholder(container, text) {
        container.pack_start(this.createPlaceholder(text), true, true, 0);
        container.show_all();
    }

    showError(container, errorKey, onRetry = null) {
        container.pack_start(this.createErrorState(errorKey, onRetry), true, true, 0);
        container.show_all();
    }

    showEmpty(container, emptyKey, iconName = 'folder-symbolic') {
        container.pack_start(this.createEmptyState(emptyKey, iconName), true, true, 0);
        container.show_all();
    }
}
