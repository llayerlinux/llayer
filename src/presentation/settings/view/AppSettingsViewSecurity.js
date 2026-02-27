import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor, applyLabelAttributes, applyOptionalSetters} from '../../common/ViewUtils.js';

export function applyAppSettingsViewSecurity(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AppSettingsViewSecurity.prototype);
}

class AppSettingsViewSecurity {
    createSectionLabel(text, {bold = false} = {}) {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.START,
            wrap: true
        });
        bold && applyLabelAttributes(label, { bold: true });
        label.set_line_wrap(true);
        return label;
    }

    createTextView({editable = true, extraClasses = []} = {}) {
        const textView = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD,
            accepts_tab: false,
            monospace: true,
            editable
        });
        textView.get_style_context().add_class('security-textview');
        extraClasses.forEach((className) => textView.get_style_context().add_class(className));
        return textView;
    }

    createScrolledTextView(textView, {hexpand = true, vexpand = true, heightRequest = null, classes = []} = {}) {
        const scrolled = new Gtk.ScrolledWindow({
            hexpand,
            vexpand
        });
        applyOptionalSetters([[heightRequest, (value) => scrolled.set_size_request(-1, value), (value) => value !== null]]);
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        scrolled.get_style_context().add_class('security-scrolled');
        classes.forEach((className) => scrolled.get_style_context().add_class(className));
        scrolled.add(textView);
        return scrolled;
    }

    createSectionFrame() {
        const frame = new Gtk.Frame({label: null});
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin: 12
        });
        frame.add(box);
        return {frame, box};
    }

    createHelpLabel(text) {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.START,
            wrap: true
        });
        label.set_line_wrap(true);
        label.get_style_context().add_class('dim-label');
        return label;
    }

    buildSecurityTab(t, settings) {
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        let {frame: patternsFrame, buffer: patternsBuffer} = this.buildSecurityPatterns(t, settings);
        this.securityBuffer = patternsBuffer;
        box.pack_start(patternsFrame, true, true, 0);

        let {frame: exceptionsFrame, buffer: exceptionsBuffer} = this.buildSecurityExceptions(t, settings);
        this.exceptionsBuffer = exceptionsBuffer;
        box.pack_start(exceptionsFrame, true, true, 0);

        let {frame: criticalFrame} = this.buildCriticalPatterns(t);
        box.pack_start(criticalFrame, false, false, 0);

        let tabLabel = new Gtk.Label({label: t('SECURITY_TAB')});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return {box, tabLabel};
    }

    buildSecurityPatterns(t, settings) {
        const {frame, box} = this.createSectionFrame();

        box.pack_start(this.createSectionLabel(t('SECURITY_PATTERNS_LABEL')), false, false, 0);
        box.pack_start(this.createHelpLabel(t('SECURITY_PATTERNS_HELP')), false, false, 0);

        const textView = this.createTextView(),
            buffer = textView.get_buffer(),
            currentPatterns = Array.isArray(settings.dangerousPatterns) && settings.dangerousPatterns.length > 0
                ? settings.dangerousPatterns
                : this.loadDefaultDangerousPatterns();
        buffer.set_text(currentPatterns.join('\n'), -1);

        box.pack_start(this.createScrolledTextView(textView, {
            heightRequest: 70,
            classes: ['security-scrolled-danger']
        }), true, true, 0);

        const resetButton = new Gtk.Button({
            label: t('SECURITY_RESET_TO_DEFAULTS'),
            margin_top: 5
        });
        addPointerCursor(resetButton);
        resetButton.connect('clicked', () => {
            buffer.set_text(this.loadDefaultDangerousPatterns().join('\n'), -1);
        });
        box.pack_start(resetButton, false, false, 0);

        return {frame, buffer};
    }

    buildSecurityExceptions(t, settings) {
        const {frame, box} = this.createSectionFrame();

        box.pack_start(this.createSectionLabel(t('SECURITY_EXCEPTIONS_LABEL'), {bold: true}), false, false, 0);
        box.pack_start(this.createHelpLabel(t('SECURITY_EXCEPTIONS_HELP')), false, false, 0);

        const textView = this.createTextView();
        const buffer = textView.get_buffer();
        buffer.set_text(
            (Array.isArray(settings.securityExceptions) ? settings.securityExceptions : []).join('\n'), -1
        );

        box.pack_start(this.createScrolledTextView(textView, {
            heightRequest: 70,
            classes: ['security-scrolled-safe']
        }), true, true, 0);

        return {frame, buffer};
    }

    buildCriticalPatterns(t) {
        const {frame, box} = this.createSectionFrame();

        box.pack_start(this.createSectionLabel(t('SECURITY_CRITICAL_LABEL'), {bold: true}), false, false, 0);
        box.pack_start(this.createHelpLabel(t('SECURITY_CRITICAL_HELP')), false, false, 0);

        const textView = this.createTextView({editable: false, extraClasses: ['critical-textview']});
        textView.get_buffer().set_text(this.getCriticalPatterns().join('\n'), -1);

        box.pack_start(this.createScrolledTextView(textView, {
            vexpand: false,
            heightRequest: 50,
            classes: ['security-scrolled-critical']
        }), false, false, 0);

        return {frame};
    }
}
