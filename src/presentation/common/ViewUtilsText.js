import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';

export function applyOptionalSetters(setters = [], defaultPredicate = (value) => value !== null && value !== undefined) {
    for (const [value, apply, predicate = defaultPredicate] of setters) {
        predicate(value) && apply(value);
    }
}

function createInlineLinkValueWidget(value, valueStyle) {
    const linkButton = new Gtk.LinkButton({
        uri: value.url,
        label: value.text,
        halign: Gtk.Align.START
    });
    linkButton.set_relief(Gtk.ReliefStyle.NONE);
    linkButton.set_halign(Gtk.Align.START);
    linkButton.set_hexpand(true);
    linkButton.get_style_context().add_class('inline-link');
    const linkLabel = linkButton.get_child?.();
    linkLabel && (
        linkLabel.set_line_wrap(true),
        linkLabel.set_xalign(0),
        valueStyle && applyLabelAttributes(linkLabel, valueStyle)
    );
    return linkButton;
}

function createInlinePlainValueLabel(value, valueStyle) {
    const plainValueLabel = new Gtk.Label({
        label: value,
        halign: Gtk.Align.START,
        xalign: 0,
        wrap: true
    });
    valueStyle && applyLabelAttributes(plainValueLabel, valueStyle);
    return plainValueLabel;
}

export function createInlineLinkRow(options = {}) {
    const {
        labelText = '',
        valueText = '',
        url = '',
        cssClass = '',
        separator = ': ',
        prefixStyle = null,
        valueStyle = null,
        containerHalign = null
    } = options;

    const container = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
        hexpand: true
    });
    applyOptionalSetters([
        [containerHalign, (value) => container.set_halign(value)],
        [cssClass, (value) => container.get_style_context().add_class(value), Boolean]
    ]);

    const prefixLabel = new Gtk.Label({
        label: `${labelText || ''}${separator}`,
        halign: Gtk.Align.START,
        xalign: 0
    });
    prefixStyle && applyLabelAttributes(prefixLabel, prefixStyle);
    container.pack_start(prefixLabel, false, false, 0);

    const value = valueText !== null && valueText !== undefined ? String(valueText) : '';
    const valueWidget = url
        ? createInlineLinkValueWidget({ url, text: value }, valueStyle)
        : createInlinePlainValueLabel(value, valueStyle);
    container.pack_start(valueWidget, true, true, 0);
    return container;
}

function parseHexColor(value) {
    let trimmed = typeof value === 'string' ? value.trim() : '';
    let match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
    if (typeof value !== 'string' || !match) return null;
    let hex = match[1].length === 3
        ? match[1].split('').map((ch) => ch + ch).join('')
        : match[1];
    return {
        r: parseInt(hex.slice(0, 2), 16) * 257,
        g: parseInt(hex.slice(2, 4), 16) * 257,
        b: parseInt(hex.slice(4, 6), 16) * 257
    };
}

export function applyLabelAttributes(label, options = {}) {
    if (!label || typeof label.set_attributes !== 'function') return label;
    const attrs = new Pango.AttrList();
    let hasAttr = false;
    const attrFactories = [
        [options.bold, () => Pango.attr_weight_new(Pango.Weight.BOLD)],
        [options.italic, () => Pango.attr_style_new(Pango.Style.ITALIC)],
        [options.underline, () => Pango.attr_underline_new(Pango.Underline.SINGLE)],
        [options.scale, () => Pango.attr_scale_new(options.scale)],
        [options.size, () => Pango.attr_size_new(options.size * Pango.SCALE)],
        [options.family, () => Pango.attr_family_new(options.family)],
        [options.color, () => {
            const rgb = parseHexColor(options.color);
            return rgb ? Pango.attr_foreground_new(rgb.r, rgb.g, rgb.b) : null;
        }]
    ];
    for (const [enabled, createAttr] of attrFactories) {
        enabled && (() => {
            const attr = createAttr();
            attr && (attrs.insert(attr), hasAttr = true);
        })();
    }

    hasAttr && label.set_attributes(attrs);
    return label;
}
