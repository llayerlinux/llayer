import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import WebKit2 from 'gi://WebKit2?version=4.0';
import { createRoundedImage, addPointerCursor } from '../common/ViewUtils.js';
import { Commands } from '../../infrastructure/constants/Commands.js';
import { DEFAULT_SUPPORT_URL, appPageUrl } from '../../infrastructure/constants/AppUrls.js';
import { suppressedError } from '../../infrastructure/utils/ErrorUtils.js';

export class AboutView {
    constructor(controller, logger = null) {
        this.controller = controller;
        this.logger = logger;
        this.notebook = null;
        this.infoWeb = null;
        this.thanksWeb = null;
        this.thanksLabel = null;
        this.thanksOuter = null;
        this.currentDir = controller?.container?.get('currentDir') || '';
    }

    createContent() {
        this.notebook = new Gtk.Notebook({
            hexpand: true,
            vexpand: true,
            show_border: true,
            show_tabs: true,
            tab_pos: Gtk.PositionType.TOP
        });

        this.notebook.set_margin_top(4);
        this.notebook.set_margin_bottom(4);
        this.notebook.set_margin_start(4);
        this.notebook.set_margin_end(4);
        this.notebook.set_size_request(360, 160 * 4);

        this.notebook.connect('switch-page', (notebook, page, pageNum) => {
            this.resetScrollPosition();
            switch (pageNum) {
                case 0:
                    this.infoWeb && this.scrollWebviewToTop(this.infoWeb);
                    break;
                case 1:
                    this.thanksWeb && this.scrollWebviewToTop(this.thanksWeb);
                    break;
                default:
                    break;
            }
        });

        this.createAboutTab();
        this.createThanksTab();

        return this.notebook;
    }

    getWebUrl(settingKey, fallbackPath) {
        const settings = this.controller?.store?.getState()?.settings ?? {};
        const fallbackUrl = appPageUrl(fallbackPath);
        return (settings[settingKey] || fallbackUrl).trim();
    }

    createConfiguredWebView(url) {
        const webView = new WebKit2.WebView();
        this.setWebViewFocusBehavior(webView);
        this.attachRoundedCss(webView);
        webView.set_size_request(360, 160 * 4);
        webView.load_uri(url);
        webView.connect('load-changed', (view, loadEvent) => {
            loadEvent === WebKit2.LoadEvent.FINISHED && this.scrollWebviewToTop(view);
        });
        return webView;
    }

    createAboutTab() {
        const infoOuter = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: true,
            margin_start: 2,
            margin_end: 2
        });

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            margin_top: 0,
            margin_bottom: 0,
            margin_start: 0,
            margin_end: 0
        });

        this.infoWeb = this.createConfiguredWebView(this.getWebUrl('aboutUrl', 'about'));

        infoBox.pack_start(this.infoWeb, true, true, 0);
        infoOuter.pack_start(infoBox, true, true, 0);

        const infoLabel = new Gtk.Label({
            label: this.getTranslation('ABOUT_TAB')
        });
        infoLabel.set_margin_left(10);
        infoLabel.set_margin_right(10);

        this.notebook.append_page(infoOuter, infoLabel);
    }

    createThanksTab() {
        this.thanksOuter = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: true,
            margin_start: 2,
            margin_end: 2
        });

        const thanksBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            margin_top: 0,
            margin_bottom: 0,
            margin_start: 0,
            margin_end: 0
        });

        this.thanksWeb = this.createConfiguredWebView(this.getWebUrl('thanksUrl', 'thanks'));

        const thanksButtons = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 10,
            margin_top: 8,
            margin_bottom: 8
        });

        const supportBtn = new Gtk.Button({label: this.getTranslation('SUPPORT_BUTTON')});
        supportBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(supportBtn);
        supportBtn.connect('clicked', () => this.handleSupportButtonClick());

        const kofiBtn = new Gtk.Button({label: 'Ko-fi'});
        addPointerCursor(kofiBtn);
        kofiBtn.connect('clicked', () => this.handleSupportButtonClick());

        thanksButtons.pack_start(supportBtn, false, false, 0);
        thanksButtons.pack_start(kofiBtn, false, false, 0);

        thanksBox.pack_start(thanksButtons, false, false, 0);
        thanksBox.pack_start(this.thanksWeb, true, true, 0);
        this.thanksOuter.pack_start(thanksBox, true, true, 0);

        this.thanksLabel = new Gtk.Label({
            label: this.getTranslation('THANKS_TAB')
        });
        this.thanksLabel.set_margin_left(10);
        this.thanksLabel.set_margin_right(10);

        this.notebook.append_page(this.thanksOuter, this.thanksLabel);
    }

    addSupportExtras(supportBox) {
        const infoText = this.getSupportInfoText();

        const infoLabel = new Gtk.Label({
            label: infoText,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            margin_top: 8,
            margin_bottom: 8,
            wrap: true,
            max_width_chars: 50
        });
        infoLabel.get_style_context().add_class('support-info-text');
        supportBox.pack_start(infoLabel, false, false, 0);

        const supportButtonContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 16,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 16,
            margin_end: 16
        });

        const supportButton = new Gtk.Button({
            label: this.getTranslation('SUPPORT_BUTTON'),
            halign: Gtk.Align.CENTER
        });

        supportButton.get_style_context().add_class('support-button');
        addPointerCursor(supportButton);

        supportButton.connect('clicked', () => this.handleSupportButtonClick());

        const kofiIcon = this.createKofiIcon();

        supportButtonContainer.pack_start(supportButton, false, false, 0);
        kofiIcon && supportButtonContainer.pack_start(kofiIcon, false, false, 0);

        supportBox.pack_start(supportButtonContainer, false, false, 0);
    }

    getSupportInfoText() {
        return this.getTranslation('SUPPORT_INFO_DETAILS');
    }

    createKofiIcon() {
        const kofiPath = `${this.currentDir}/assets/kofi.png`;
        return createRoundedImage
	            ? createRoundedImage(kofiPath, {
	                size: 40,
	                radius: 12,
	                placeholderIcon: 'heart-symbolic',
	                placeholderSize: Gtk.IconSize.LARGE_TOOLBAR
	            })
            : (() => {
                const img = new Gtk.Image();
                img.set_from_icon_name('heart-symbolic', Gtk.IconSize.LARGE_TOOLBAR);
                return img;
            })();
    }

    playSupportClickSound() {
        const soundService = this.controller?.container?.get?.('soundService');
        const primaryPromise = soundService?.playSupportClickSound?.();
        if (primaryPromise && typeof primaryPromise.catch === 'function') {
            primaryPromise.catch((error) => suppressedError('AboutView.playSupportClickSound.primary', error));
            return;
        }
        soundService?.playSound?.('support_click.wav')
            ?.catch?.((error) => suppressedError('AboutView.playSupportClickSound.fallback', error));
    }

    handleSupportButtonClick() {
        this.playSupportClickSound();
        GLib.spawn_command_line_async(`${Commands.XDG_OPEN} ${DEFAULT_SUPPORT_URL}`);
    }

    getTranslation(key, defaultText = key) {
        const translated = this.controller?.container?.get?.('translator')?.(key);
        if (typeof translated === 'string' && translated !== key) return translated;
        const translations = this.controller?.translations ?? {};
        if (!Object.keys(translations).length) return defaultText;
        const found = ((lang) => lang && [lang, lang.toLowerCase(), lang.toLowerCase().split(/[-_]/)[0]].find(c => c && translations[c]?.[key]))(this.controller?.store?.getState?.()?.settings?.language);
        return found ? translations[found][key] : defaultText;
    }

    show() {
        this.notebook?.show_all();
    }

    hide() {
        this.notebook?.hide();
    }

    destroy() {
        [this.infoWeb, this.thanksWeb, this.notebook].forEach(w => w?.destroy?.());
        this.infoWeb = this.thanksWeb = this.notebook = this.controller = this.logger = null;
    }

    withWidget(widget, action) {
        return widget ? action(widget) : null;
    }

    attachRoundedCss(widget) {
        this.withWidget(widget, (w) => w.get_style_context().add_class('rounded-webview'));
    }

    setWebViewFocusBehavior(webview) {
        this.withWidget(webview, (view) => {
            view.set_can_focus(false);
            view.connect('focus-in-event', () => true);
        });
    }

    resetScrollPosition() {
        const scrolled = this.findParentScrolledWindow(this.notebook);
        const vadj = scrolled?.get_vadjustment?.();
        vadj && GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            vadj.set_value(0);
            return GLib.SOURCE_REMOVE;
        });
    }

    findParentScrolledWindow(widget) {
        let current = widget;
        while (current && current.get_parent) {
            if (current instanceof Gtk.ScrolledWindow) {
                return current;
            }
            current = current.get_parent();
        }
        return null;
    }

    scrollWebviewToTop(webview) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            webview.run_javascript('window.scrollTo(0, 0);', null, null);
            return GLib.SOURCE_REMOVE;
        });
    }
}
