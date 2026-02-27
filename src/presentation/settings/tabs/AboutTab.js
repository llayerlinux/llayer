import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=3.0';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import WebKit2 from 'gi://WebKit2?version=4.0';
import { Commands } from '../../../infrastructure/constants/Commands.js';
import { APP_URLS, DEFAULT_SUPPORT_URL } from '../../../infrastructure/constants/AppUrls.js';
import {addPointerCursor, applyLabelAttributes, applyOptionalSetters} from '../../common/ViewUtils.js';

const CONTACT_SCHEMES = ['http://', 'https://', 'tg://'];

export class AboutTab {
    constructor({t, makeRoundedPixbuf, loadStartupData, isUpdateVersionIgnored, playSupportClickSound, assetsPath, thanksUrl}) {
        this.t = t;
        this.makeRoundedPixbuf = makeRoundedPixbuf;
        this.loadStartupData = loadStartupData;
        this.isUpdateVersionIgnored = isUpdateVersionIgnored;
        this.playSupportClickSound = playSupportClickSound;
        this.assetsPath = assetsPath;
        this.thanksUrl = thanksUrl;

        this.currentUpdateInfo = null;
        this.developerLabel = null;
        this.developerLabelTitle = null;
        this.developerLabelValue = null;
        this.feedbackBox = null;
        this.feedbackContainer = null;
        this.updateContainer = null;
        this.updateFrame = null;
        this.updateMessageLabel = null;
        this.thanksWeb = null;
    }

    build() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24
        });

        this.buildMainSection(box);
        this.buildUpdateSection(box);
        this.addSeparator(box);
        this.buildSupportSection(box);

        this.updateDeveloperInfo(null, false);
        this.updateFeedbackInfo(null, false);
        this.updateAboutUpdateInfo(null, false);

        this.loadRemoteData();

        const tabLabel = new Gtk.Label({label: this.t('ABOUT_TAB')});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return {box, tabLabel};
    }

    createLabel(text, {halign = Gtk.Align.START, wrap = false, xalign = null, marginTop = null, marginBottom = null, noShowAll = false} = {}) {
        const label = new Gtk.Label({
            label: text,
            halign,
            wrap
        });
        applyOptionalSetters([
            [xalign, (value) => label.set_xalign(value)],
            [marginTop, (value) => label.set_margin_top(value)],
            [marginBottom, (value) => label.set_margin_bottom(value)],
            [noShowAll, () => label.set_no_show_all(true), Boolean]
        ]);
        return label;
    }

    buildMainSection(box) {
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            halign: Gtk.Align.START
        });

        const icon = new Gtk.Image();
        const iconPath = `${this.assetsPath}/icon.png`;
        const iconPixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(iconPath, 80, 80, true);
        icon.set_from_pixbuf(iconPixbuf);
        icon.set_halign(Gtk.Align.CENTER);
        icon.set_valign(Gtk.Align.START);
        icon.set_margin_right(16);

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            halign: Gtk.Align.START,
            hexpand: true
        });

        const descLabel = this.createLabel(this.t('ABOUT_DESCRIPTION'), {wrap: false, xalign: 0});

        const versionBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
            halign: Gtk.Align.START
        });
        versionBox.set_margin_top(8);
        const versionPrefix = this.createLabel(this.t('ABOUT_VERSION'), {xalign: 0});
        applyLabelAttributes(versionPrefix, { bold: true });
        const versionValue = this.createLabel('1.1', {xalign: 0});
        versionBox.pack_start(versionPrefix, false, false, 0);
        versionBox.pack_start(versionValue, false, false, 0);

        this.developerLabel = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
            halign: Gtk.Align.START,
            no_show_all: true
        });
        this.developerLabel.set_margin_top(4);
        this.developerLabelTitle = this.createLabel(this.t('ABOUT_DEVELOPER'), {xalign: 0});
        applyLabelAttributes(this.developerLabelTitle, { bold: true });
        this.developerLabelValue = this.createLabel('', {xalign: 0});
        this.developerLabel.pack_start(this.developerLabelTitle, false, false, 0);
        this.developerLabel.pack_start(this.developerLabelValue, false, false, 0);
        this.developerLabel.hide();

        this.feedbackBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4
        });

        const feedbackLabel = this.createLabel(this.t('ABOUT_FEEDBACK'), {xalign: 0});
        applyLabelAttributes(feedbackLabel, { bold: true });

        this.feedbackContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
            hexpand: true
        });

        this.feedbackBox.pack_start(feedbackLabel, false, false, 0);
        this.feedbackBox.pack_start(this.feedbackContainer, true, true, 0);
        this.feedbackBox.hide();

        textBox.pack_start(descLabel, false, false, 0);
        textBox.pack_start(versionBox, false, false, 0);
        textBox.pack_start(this.developerLabel, false, false, 0);
        textBox.pack_start(this.feedbackBox, false, false, 0);

        mainBox.pack_start(icon, false, false, 0);
        mainBox.pack_start(textBox, true, true, 0);
        box.pack_start(mainBox, false, false, 0);
    }

    buildUpdateSection(box) {
        this.updateContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 16,
            margin_bottom: 8,
            no_show_all: true
        });
        this.updateContainer.hide();

        this.updateFrame = new Gtk.Frame({
            label: null,
            no_show_all: true
        });
        this.updateFrame.get_style_context().add_class('update-notification-frame');

        const updateBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin: 12
        });

        const updateIcon = new Gtk.Image();
        updateIcon.set_from_icon_name('software-update-available', Gtk.IconSize.LARGE_TOOLBAR);
        updateBox.pack_start(updateIcon, false, false, 0);

        const updateTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: true
        });

        const updateTitleLabel = this.createLabel(this.t('UPDATE_AVAILABLE_TITLE'));
        applyLabelAttributes(updateTitleLabel, { bold: true });

        this.updateMessageLabel = this.createLabel('', {wrap: true});
        this.updateMessageLabel.set_max_width_chars(40);

        updateTextBox.pack_start(updateTitleLabel, false, false, 0);
        updateTextBox.pack_start(this.updateMessageLabel, false, false, 0);
        updateBox.pack_start(updateTextBox, true, true, 0);

        const updateButton = new Gtk.Button({
            label: this.t('UPDATE_BUTTON'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER
        });
        updateButton.get_style_context().add_class('suggested-action');
        addPointerCursor(updateButton);
        updateButton.connect('clicked', () => this.onUpdateClick());
        updateBox.pack_start(updateButton, false, false, 0);

        this.updateFrame.add(updateBox);
        this.updateContainer.pack_start(this.updateFrame, false, false, 0);
        box.pack_start(this.updateContainer, false, false, 0);
    }

    buildSupportSection(box) {
        const container = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 16,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 16,
            margin_end: 16
        });

        const supportButton = new Gtk.Button({
            label: this.t('SUPPORT_BUTTON'),
            halign: Gtk.Align.CENTER
        });
        supportButton.get_style_context().add_class('support-button');
        addPointerCursor(supportButton);
        supportButton.connect('clicked', () => {
            this.playSupportClickSound();
            GLib.spawn_command_line_async(`${Commands.XDG_OPEN} ${DEFAULT_SUPPORT_URL}`);
        });

        const kofiIcon = new Gtk.Image();
        const kofiPixbuf = this.makeRoundedPixbuf
            ? this.makeRoundedPixbuf(`${this.assetsPath}/kofi.png`, 40, 12)
            : null;
        if (kofiPixbuf) {
            kofiIcon.set_from_pixbuf(kofiPixbuf);
            kofiIcon.set_halign(Gtk.Align.CENTER);
            kofiIcon.set_valign(Gtk.Align.CENTER);
        } else {
            kofiIcon.set_from_icon_name('heart-symbolic', Gtk.IconSize.LARGE_TOOLBAR);
        }

        const kofiWrapper = new Gtk.EventBox();
        kofiWrapper.add(kofiIcon);
        kofiWrapper.connect('realize', () => {
            const display = kofiWrapper.get_display();
            const cursor = Gdk.Cursor.new_from_name(display, 'default');
            kofiWrapper.get_window()?.set_cursor(cursor);
        });

        container.pack_start(supportButton, false, false, 0);
        container.pack_start(kofiWrapper, false, false, 0);
        box.pack_start(container, false, false, 0);

        this.thanksWeb = new WebKit2.WebView();
        this.thanksWeb.get_style_context().add_class('rounded-webview');
        this.thanksWeb.set_can_focus(false);
        this.thanksWeb.connect('focus-in-event', () => true);
        this.thanksWeb.set_size_request(320, 200);
        const thanksUrl = (this.thanksUrl || APP_URLS.thanks).trim();
        this.thanksWeb.load_uri(thanksUrl);
        this.thanksWeb.connect('load-changed', (webview, loadEvent) => {
            loadEvent === WebKit2.LoadEvent.FINISHED &&
                webview.run_javascript('window.scrollTo(0, 0);', null, null);
        });

        const thanksFrame = new Gtk.Frame({
            shadow_type: Gtk.ShadowType.ETCHED_IN
        });
        thanksFrame.set_margin_top(4);
        thanksFrame.set_margin_bottom(4);
        thanksFrame.add(this.thanksWeb);
        box.pack_start(thanksFrame, true, true, 0);
    }

    addSeparator(box) {
        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        separator.set_margin_top(16);
        separator.set_margin_bottom(16);
        box.pack_start(separator, false, false, 0);
    }

    updateDeveloperInfo(appSettings, serverAvailable = true) {
        if (!this.developerLabel) return;
        if (!(serverAvailable && appSettings?.showDeveloperInfo && appSettings?.isActive && appSettings?.developerName)) {
            this.developerLabel.hide();
            this.developerLabel.set_no_show_all(true);
            return;
        }

        this.developerLabelTitle && (
            this.developerLabelTitle.set_text(this.t('ABOUT_DEVELOPER')),
            applyLabelAttributes(this.developerLabelTitle, { bold: true })
        );
        applyOptionalSetters([[this.developerLabelValue, (valueLabel) => valueLabel.set_text(appSettings.developerName)]]);
        this.developerLabel.show_all();
        this.developerLabel.show();
    }

    updateFeedbackInfo(appSettings, serverAvailable = true) {
        if (!(this.feedbackContainer && this.feedbackBox)) return;

        this.feedbackContainer.foreach((child) => this.feedbackContainer.remove(child));

        const contacts = !serverAvailable
            ? ['llayerfb@gmail.com']
            : (appSettings?.showFeedbackInfo && appSettings?.isActive && appSettings?.feedbackContacts)
                ? appSettings.feedbackContacts.split(',').map(c => c.trim()).filter(c => c.length > 0)
                : [];

        contacts.length > 0
            ? (contacts.forEach((contact, index) => {
                const element = this.createContactElement(contact);
                element && (
                    this.feedbackContainer.pack_start(element, false, false, 0),
                    index < contacts.length - 1 && this.feedbackContainer.pack_start(this.createLabel(', '), false, false, 0)
                );
            }), this.feedbackBox.show_all())
            : this.feedbackBox.hide();
    }

    updateAboutUpdateInfo(updateData, serverAvailable = true) {
        if (this.updateContainer && this.updateFrame) {
            const hideAll = () => {
                this.updateContainer.hide();
                this.updateContainer.set_no_show_all(true);
                this.updateFrame.hide();
                this.updateFrame.set_no_show_all(true);
            };

            if (
                !serverAvailable
                || !updateData
                || !updateData.hasUpdate
                || !updateData.update
                || this.isUpdateVersionIgnored(updateData.update.version)
            ) {
                hideAll();
                return;
            }

            this.updateMessageLabel?.set_text(
                this.t('UPDATE_MESSAGE').replace('{version}', updateData.update.version)
            );
            this.updateContainer.show_all();
            this.updateFrame.show_all();
        }
    }

    createContactElement(contact) {
        const trimmed = contact.trim();
        if (!trimmed) return null;
        return (trimmed.includes('://') || trimmed.includes('@'))
            ? this.createContactButton(trimmed)
            : this.createLabel(trimmed);
    }

    createContactButton(text) {
        const button = new Gtk.Button({
            label: text,
            halign: Gtk.Align.START,
            relief: Gtk.ReliefStyle.NONE
        });
        button.get_style_context().add_class('link-button');
        addPointerCursor(button);
        button.connect('clicked', () => this.openContact(text));
        return button;
    }

    openContact(contact) {
        const trimmed = contact.trim(),
            url = CONTACT_SCHEMES.some(prefix => trimmed.startsWith(prefix)) ? trimmed
                : (trimmed.includes('@') && !trimmed.includes('://')) ? `mailto:${trimmed}`
                : null;
        url && GLib.spawn_command_line_async(`${Commands.XDG_OPEN} "${url}"`);
        return !!url;
    }

    onUpdateClick() {
        this.currentUpdateInfo?.updateUrl
            && GLib.spawn_command_line_async(`${Commands.XDG_OPEN} "${this.currentUpdateInfo.updateUrl}"`);
    }

    loadRemoteData() {
        this.loadStartupData()
            .then((data) => {
                const {updateData, appSettings} = data;
                updateData && (this.updateAboutUpdateInfo(updateData, true), this.currentUpdateInfo = updateData.update);
                appSettings && (this.updateDeveloperInfo(appSettings, true), this.updateFeedbackInfo(appSettings, true));
            });
    }
}
