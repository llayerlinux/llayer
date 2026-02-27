import Gtk from 'gi://Gtk?version=3.0';
import { applyOptionalSetters } from '../../common/ViewUtils.js';

export const TweaksPluginsUIBase = {
    createLabel(text, {halign = Gtk.Align.START, xalign = null, wrap = false, className = null, marginEnd = null, marginTop = null, marginBottom = null} = {}) {
        const label = new Gtk.Label({label: text, halign, wrap});
        applyOptionalSetters([
            [xalign, (value) => label.set_xalign(value)],
            [marginEnd, (value) => label.set_margin_end(value)],
            [marginTop, (value) => label.set_margin_top(value)],
            [marginBottom, (value) => label.set_margin_bottom(value)],
            [className, (value) => label.get_style_context().add_class(value), Boolean]
        ]);
        return label;
    },

    createLinkButton(uri, label, {className = null, halign = Gtk.Align.START, hexpand = false} = {}) {
        const button = new Gtk.LinkButton({
            uri,
            label,
            halign
        });
        button.set_relief(Gtk.ReliefStyle.NONE);
        button.set_hexpand(hexpand);
        applyOptionalSetters([[className, (value) => button.get_style_context().add_class(value), Boolean]]);
        return button;
    },

    getAllWidgetsInContainer(container) {
        const widgets = [];

        function collectWidgets(widget) {
            widgets.push(widget);
            widget?.get_children?.().forEach(child => collectWidgets(child));
        }

        container?.get_children?.().forEach(child => collectWidgets(child));

        return widgets;
    },

    appendTerminalProcessOutput(stdout, success, code) {
        if (!this.terminalBuffer) {
            return;
        }
        const cleanOutput = String(stdout || '')
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/\x1b\[2K/g, '');
        this.terminalBuffer.insert(this.terminalBuffer.get_end_iter(), cleanOutput, -1);
        this.terminalBuffer.insert(
            this.terminalBuffer.get_end_iter(),
            `\n[${success ? 'OK' : 'Error'}, code ${code}]\n`,
            -1
        );
    }
};
