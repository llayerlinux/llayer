import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { applyOptionalSetters } from '../../common/ViewUtils.js';

export function applyTweaksViewWidgets(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewWidgets.prototype);
}

class TweaksViewWidgets {
    Box(props = {}) {
        const {
            vertical = false,
            spacing = 0,
            hexpand = false,
            vexpand = false,
            margin_top = 0,
            margin_bottom = 0,
            margin_start = 0,
            margin_end = 0,
            children = null
        } = props;
        const box = new Gtk.Box({
            orientation: vertical ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL,
            spacing,
            hexpand,
            vexpand,
            margin_top,
            margin_bottom,
            margin_start,
            margin_end
        });

        (children && Array.isArray(children))
            && children.forEach(child => child && box.pack_start(child, true, true, 0));

        return box;
    }

    Label(props = {}) {
        const {
            label: labelText = '',
            use_markup = false,
            halign = Gtk.Align.START,
            valign = Gtk.Align.CENTER,
            margin_end = 0,
            className = null
        } = props;
        const label = new Gtk.Label({
            label: labelText,
            use_markup,
            halign,
            valign,
            margin_end
        });

        applyOptionalSetters([[className, (value) => label.get_style_context().add_class(value), Boolean]]);

        return label;
    }

    checkbox(opts) {
        const check = new Gtk.CheckButton({label: opts.label});
        applyOptionalSetters([[opts.active, (value) => check.set_active(value), (value) => value != null]]);
        check.set_halign(Gtk.Align.START);
        applyOptionalSetters([[opts.onChange, (handler) => this.connectTweaksHandler(check, 'toggled', () => handler(check.get_active())), (value) => typeof value === 'function']]);
        return check;
    }
}
