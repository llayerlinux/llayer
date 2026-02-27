import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';
import {addPointerCursor} from '../../common/ViewUtils.js';

export class BottomBar {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.createIcon = deps.createIcon || (() => null);
        this.onClose = deps.onClose || (() => {
        });
        this.onAddTheme = deps.onAddTheme || (() => {
        });
        this.onUploadTheme = deps.onUploadTheme || (() => {
        });
        this.onOpenSettings = deps.onOpenSettings || (() => {
        });
        this.onRefresh = deps.onRefresh || (() => {
        });
        this.onOpenCurrentState = deps.onOpenCurrentState || (() => {
        });
        this.registerTranslation = deps.registerTranslation || (() => {
        });
        this.showNotification = deps.showNotification || (() => {
        });
        this.Box = deps.Box;
        this.isUploadInProgress = false;
        this.closeBtn = null;
        this.addButton = null;
        this.uploadButton = null;
        this.uploadButtonIcon = null;
        this.uploadButtonSpinner = null;
        this.bottomSettingsButton = null;
        this.refreshButton = null;
        this.infoButton = null;
        this.donationLabel = null;
        this.autoCloseLabel = null;
    }

    createIconButton(iconName, tooltipKey, onClick, extraClass = null) {
        const button = new Gtk.Button();
        button.set_image(this.createIcon(iconName, 24));
        button.get_style_context().add_class('my-theme-selector-icon-button');
        extraClass && button.get_style_context().add_class(extraClass);
        button.set_tooltip_text(this.t(tooltipKey));
        button.connect('clicked', onClick);
        this.registerTranslation(button, tooltipKey, (w, txt) => w.set_tooltip_text(txt));
        addPointerCursor(button);
        return button;
    }

    build() {
        this.closeBtn = this.createIconButton(
            'window-close-symbolic',
            'CLOSE_ICON_TOOLTIP',
            () => this.onClose(),
            'my-theme-selector-bottom-icon-button'
        );

        this.donationLabel = new Gtk.Label({
            label: '',
            visible: false,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            ellipsize: Pango.EllipsizeMode.END,
            max_width_chars: 40
        });
        this.donationLabel.get_style_context().add_class('bottom-donation-text');

        this.addButton = this.createIconButton(
            'list-add-symbolic',
            'ADD_LOCAL_THEME_TOOLTIP',
            () => this.onAddTheme(),
            'my-theme-selector-bottom-icon-button'
        );

        this.uploadButton = new Gtk.Button();
        this.uploadButtonIcon = this.createIcon('document-send-symbolic', 24);
        this.uploadButtonIcon?.show?.();
        this.uploadButtonSpinner = new Gtk.Spinner();
        this.uploadButtonSpinner.set_size_request(20, 20);
        this.uploadButtonSpinner.set_no_show_all(true);

        const uploadOverlay = new Gtk.Overlay();
        uploadOverlay.add(this.uploadButtonIcon);
        uploadOverlay.add_overlay(this.uploadButtonSpinner);
        uploadOverlay.set_halign(Gtk.Align.CENTER);
        uploadOverlay.set_valign(Gtk.Align.CENTER);
        uploadOverlay.show_all();

        this.uploadButton.add(uploadOverlay);
        this.uploadButtonOverlay = uploadOverlay;
        this.uploadButton.get_style_context().add_class('my-theme-selector-icon-button');
        this.uploadButton.get_style_context().add_class('my-theme-selector-bottom-icon-button');
        this.uploadButton.set_tooltip_text(this.t('UPLOAD_ICON_TOOLTIP'));
        this.uploadButton.connect('clicked', () => this.handleUploadClick());
        this.registerTranslation(this.uploadButton, 'UPLOAD_ICON_TOOLTIP', (w, txt) => w.set_tooltip_text(txt));
        addPointerCursor(this.uploadButton);

        this.bottomSettingsButton = this.createIconButton(
            'preferences-system-symbolic',
            'SETTINGS_ICON_TOOLTIP',
            () => this.onOpenSettings(),
            'my-theme-selector-bottom-icon-button'
        );

        this.refreshButton = this.createIconButton(
            'view-refresh-symbolic',
            'REFRESH_ICON_TOOLTIP',
            () => this.onRefresh(),
            'my-theme-selector-bottom-icon-button'
        );
        this.infoButton = this.createIconButton(
            'dialog-information-symbolic',
            'INFO_GENERIC',
            () => this.onOpenCurrentState(),
            'my-theme-selector-bottom-icon-button'
        );
        this.refreshButton.set_no_show_all(true);
        this.infoButton.set_no_show_all(true);

        this.autoCloseLabel = new Gtk.Label({label: '', visible: false});
        this.autoCloseLabel.get_style_context().add_class('my-theme-selector-autoclose');

        const buttonsBox = this.Box({
            vertical: false,
            spacing: 8,
            children: [this.addButton, this.uploadButton, this.bottomSettingsButton]
        });
        const rightElementsBox = this.Box({
            vertical: false,
            spacing: 5,
            children: [this.autoCloseLabel, buttonsBox, this.refreshButton, this.infoButton]
        });
        this.setContextTab('installed');
        return this.Box({
            vertical: false,
            className: 'my-theme-selector-bottom-bar',
            spacing: 0,
            vexpand: false,
            valign: Gtk.Align.END,
            margin_bottom: 0,
            margin_top: 0,
            children: [this.closeBtn, this.Box({hexpand: true}), this.donationLabel, this.Box({hexpand: true}), rightElementsBox]
        });
    }

    handleUploadClick() {
        return this.isUploadInProgress
            ? this.showNotification(this.t('UPLOAD_IN_PROGRESS'), 'info')
            : this.onUploadTheme();
    }

    setUploadInProgress(inProgress) {
        this.isUploadInProgress = inProgress;
        return inProgress
            ? (
                this.uploadButtonSpinner?.start(),
                this.uploadButtonSpinner?.show(),
                this.uploadButtonIcon?.show?.()
            )
            : (
                this.uploadButtonSpinner?.stop(),
                this.uploadButtonSpinner?.hide(),
                this.uploadButtonIcon?.show?.(),
                this.uploadButtonOverlay?.show_all?.()
            );
    }

    setInfoButtonAlert(active) {
        const ctx = this.infoButton?.get_style_context?.();
        switch (true) {
        case Boolean(active):
            ctx?.add_class?.('info-button-alert');
            break;
        default:
            ctx?.remove_class?.('info-button-alert');
            break;
        }
    }

    setContextTab(tabName) {
        const isNetwork = tabName === 'network';
        const isInstalled = tabName === 'installed' || tabName === 'local';
        this.refreshButton?.set_visible?.(isNetwork);
        this.infoButton?.set_visible?.(isInstalled);
    }

    getWidgets() {
        return {
            closeBtn: this.closeBtn,
            addButton: this.addButton,
            uploadButton: this.uploadButton,
            uploadButtonIcon: this.uploadButtonIcon,
            uploadButtonSpinner: this.uploadButtonSpinner,
            bottomSettingsButton: this.bottomSettingsButton,
            settingsButton: this.bottomSettingsButton,
            refreshButton: this.refreshButton,
            infoButton: this.infoButton,
            donationLabel: this.donationLabel,
            autoCloseLabel: this.autoCloseLabel
        };
    }
}
