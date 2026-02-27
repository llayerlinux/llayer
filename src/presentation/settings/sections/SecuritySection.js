import Gtk from 'gi://Gtk?version=3.0';
import { DEFAULT_DANGEROUS_PATTERNS } from '../../../infrastructure/proc/SecurityDefaults.js';

export class SecuritySection {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings ?? {};
        this.defaults = deps.defaults ?? {};
        this.styleSeparator = deps.styleSeparator || ((sep) => sep);

        this.securityBuffer = null;
        this.exceptionsBuffer = null;
        this.criticalBuffer = null;
    }

    createLabel(text) {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.START
        });
        label.set_margin_bottom(4);
        return label;
    }

    createHelpLabel(text) {
        const helpText = new Gtk.Label({
            label: text,
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        helpText.get_style_context().add_class('dim-label');
        helpText.set_margin_bottom(4);
        return helpText;
    }

    createTextView({editable = true} = {}) {
        return new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.NONE,
            editable,
            monospace: true
        });
    }

    createScrolledTextView(textView, height) {
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        scrolled.set_size_request(-1, height);
        scrolled.set_shadow_type(Gtk.ShadowType.IN);
        scrolled.add(textView);
        return scrolled;
    }

    build(parentBox) {
        this.addSeparator(parentBox);
        this.buildSecurityPatternsSection(parentBox);
        this.addSeparator(parentBox);
        this.buildSecurityExceptionsSection(parentBox);
        this.addSeparator(parentBox);
        this.buildCriticalPatternsSection(parentBox);

        return {
            securityBuffer: this.securityBuffer,
            exceptionsBuffer: this.exceptionsBuffer
        };
    }

    buildSecurityPatternsSection(box) {
        box.pack_start(this.createLabel(this.t('SECURITY_PATTERNS_LABEL')), false, false, 0);
        box.pack_start(this.createHelpLabel(this.t('SECURITY_PATTERNS_HELP')), false, false, 0);

        const storedPatterns = Array.isArray(this.settings.dangerousPatterns) &&
                               this.settings.dangerousPatterns.length > 0
            ? this.settings.dangerousPatterns
            : this.defaults.dangerousPatterns ?? [],
            textView = this.createTextView({editable: true});

        this.securityBuffer = textView.get_buffer();
        this.securityBuffer.set_text(storedPatterns.join('\n'), -1);

        box.pack_start(this.createScrolledTextView(textView, 100), false, false, 0);
    }

    buildSecurityExceptionsSection(box) {
        box.pack_start(this.createLabel(this.t('SECURITY_EXCEPTIONS_LABEL')), false, false, 0);
        box.pack_start(this.createHelpLabel(this.t('SECURITY_EXCEPTIONS_HELP')), false, false, 0);

        const storedExceptions = Array.isArray(this.settings.securityExceptions) &&
                                 this.settings.securityExceptions.length > 0
            ? this.settings.securityExceptions
            : this.defaults.securityExceptions ?? [],
            textView = this.createTextView({editable: true});

        this.exceptionsBuffer = textView.get_buffer();
        this.exceptionsBuffer.set_text(storedExceptions.join('\n'), -1);

        box.pack_start(this.createScrolledTextView(textView, 80), false, false, 0);
    }

    buildCriticalPatternsSection(box) {
        box.pack_start(this.createLabel(this.t('SECURITY_CRITICAL_LABEL')), false, false, 0);
        box.pack_start(this.createHelpLabel(this.t('SECURITY_CRITICAL_HELP')), false, false, 0);

        const textView = this.createTextView({editable: false});
        textView.set_sensitive(false);

        this.criticalBuffer = textView.get_buffer();
        this.criticalBuffer.set_text(DEFAULT_DANGEROUS_PATTERNS.join('\n'), -1);

        box.pack_start(this.createScrolledTextView(textView, 80), false, false, 0);
    }

    addSeparator(box) {
        const sep = this.styleSeparator(new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL
        }));
        sep.set_margin_top(12);
        sep.set_margin_bottom(12);
        box.pack_start(sep, false, false, 0);
    }

    static readBufferLines(buffer) {
        if (!buffer) return [];

        return buffer.get_text(buffer.get_start_iter(), buffer.get_end_iter(), false)
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    getDangerousPatterns() {
        return SecuritySection.readBufferLines(this.securityBuffer);
    }

    getSecurityExceptions() {
        return SecuritySection.readBufferLines(this.exceptionsBuffer);
    }

    applyToSettings() {
        const dangerousPatterns = this.getDangerousPatterns();
        const securityExceptions = this.getSecurityExceptions();

        dangerousPatterns.length > 0 && (this.settings.dangerousPatterns = dangerousPatterns);
        securityExceptions.length > 0 && (this.settings.securityExceptions = securityExceptions);

        return {dangerousPatterns, securityExceptions};
    }
}
