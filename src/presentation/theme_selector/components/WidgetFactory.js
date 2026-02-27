import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor, applyOptionalSetters} from '../../common/ViewUtils.js';

export function applyProps(w, p = {}) {
    applyOptionalSetters([
        [p.className, (value) => w.get_style_context().add_class(value), Boolean],
        [p.visible, (value) => {
            w.visible = value;
        }, () => Object.prototype.hasOwnProperty.call(p, 'visible')],
        [null, () => {
            w.set_size_request(p.widthRequest ?? -1, p.heightRequest ?? -1);
        }, () => ('widthRequest' in p || 'heightRequest' in p)]
    ]);
    Object.entries({
        hexpand: 'set_hexpand',
        vexpand: 'set_vexpand',
        halign: 'set_halign',
        valign: 'set_valign',
        margin_top: 'set_margin_top',
        margin_bottom: 'set_margin_bottom',
        margin_left: 'set_margin_left',
        margin_right: 'set_margin_right',
        margin_start: 'set_margin_start',
        margin_end: 'set_margin_end',
        sensitive: 'set_sensitive',
        tooltipText: 'set_tooltip_text'
    }).forEach(([prop, method]) => {
        Object.prototype.hasOwnProperty.call(p, prop) && w[method](p[prop]);
    });
    return w;
}

export function defineChildren(box) {
    Object.defineProperty(box, 'children', {
        get() {
            return typeof box.get_children === 'function' ? box.get_children() : [];
        },
        set(arr) {
            const children = typeof box.get_children === 'function' ? box.get_children() : [],
                incoming = Array.isArray(arr) ? arr : [];
            children.forEach(child => box.remove?.(child));
            incoming.forEach(ch => {
                const oldParent = ch?.get_parent?.();
                oldParent && oldParent !== box && oldParent.remove?.(ch);
                !ch?.get_parent?.() && box.pack_start(ch, false, false, 0);
            });
            box.show_all();
        }
    });
}

export function Box(p = {}) {
    const b = new Gtk.Box({
        orientation: p.vertical ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL,
        spacing: p.spacing ?? 0
    });
    defineChildren(b);
    applyProps(b, p);
    p.children && (b.children = p.children);
    return b;
}

export function Button(p = {}) {
    const b = new Gtk.Button({label: p.label ?? null});
    applyProps(b, p);
    p.child && b.add(p.child);
    addPointerCursor(b);
    return b;
}

function determinePolicy(value) {
    return ({
        never: Gtk.PolicyType.NEVER,
        always: Gtk.PolicyType.ALWAYS
    })[value] ?? Gtk.PolicyType.AUTOMATIC;
}

export function Scrollable(p = {}) {
    const sw = new Gtk.ScrolledWindow();
    sw.set_policy(determinePolicy(p.hscroll), determinePolicy(p.vscroll));
    p.child && sw.add(p.child);
    applyProps(sw, p);
    return sw;
}
