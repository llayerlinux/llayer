import Gtk from 'gi://Gtk?version=3.0';
import { applyLabelAttributes } from './ViewUtils.js';

function parseHexColorToRgb(hexColor = '') {
    const hex = String(hexColor || '').replace('#', '');
    if (hex.length !== 6) {
        return [0.5, 0.5, 0.5];
    }
    return [
        parseInt(hex.substring(0, 2), 16) / 255,
        parseInt(hex.substring(2, 4), 16) / 255,
        parseInt(hex.substring(4, 6), 16) / 255
    ];
}

function buildContentContainer(options = {}) {
    return new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: options.spacing ?? 12,
        margin_top: options.margin_top ?? 12,
        margin_bottom: options.margin_bottom ?? 12,
        margin_start: options.margin_start ?? 12,
        margin_end: options.margin_end ?? 12
    });
}

function buildTextBlock(item = {}, maxWidthChars = 45) {
    const textBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2
    });
    const titleLabel = new Gtk.Label({
        label: item.title || '',
        halign: Gtk.Align.START
    });
    applyLabelAttributes(titleLabel, { bold: true });
    textBox.pack_start(titleLabel, false, false, 0);

    const descLabel = new Gtk.Label({
        label: item.desc || '',
        halign: Gtk.Align.START,
        wrap: true,
        max_width_chars: maxWidthChars
    });
    descLabel.get_style_context().add_class('dim-label');
    textBox.pack_start(descLabel, false, false, 0);
    return textBox;
}

function appendHelpItem(contentBox, item = {}, options = {}) {
    const leadingWidth = options.leadingWidth ?? 24;
    const maxWidthChars = options.maxWidthChars ?? 45;
    const rowSpacing = options.rowSpacing ?? 8;
    const hasLeading = !!(item.icon || item.label);

    if (!hasLeading) {
        contentBox.pack_start(buildTextBlock(item, maxWidthChars), false, false, 0);
        return;
    }

    const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: rowSpacing
    });

    if (item.icon) {
        const icon = Gtk.Image.new_from_icon_name(item.icon, Gtk.IconSize.BUTTON);
        icon.set_size_request(leadingWidth, -1);
        row.pack_start(icon, false, false, 0);
    } else {
        const label = new Gtk.Label({ label: item.label || '' });
        label.set_size_request(leadingWidth, -1);
        label.get_style_context().add_class('monospace');
        row.pack_start(label, false, false, 0);
    }

    row.pack_start(buildTextBlock(item, maxWidthChars), true, true, 0);
    contentBox.pack_start(row, false, false, 0);
}

function appendColorLegend(contentBox, options = {}) {
    const colorItems = Array.isArray(options.colorItems) ? options.colorItems : [];
    if (colorItems.length === 0) {
        return;
    }

    const legendTitle = new Gtk.Label({
        label: options.colorLegendTitle || 'Color Legend',
        halign: Gtk.Align.START,
        margin_top: options.colorLegendMarginTop ?? 8
    });
    applyLabelAttributes(legendTitle, { bold: true });
    contentBox.pack_start(legendTitle, false, false, 0);

    const parseColor = typeof options.parseColor === 'function'
        ? options.parseColor
        : parseHexColorToRgb;

    for (const item of colorItems) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: options.colorRowSpacing ?? 8
        });
        const colorBox = new Gtk.DrawingArea();
        colorBox.set_size_request(options.colorBoxSize ?? 16, options.colorBoxSize ?? 16);
        colorBox.connect('draw', (_widget, cr) => {
            const [r, g, b] = parseColor(item.color);
            cr.setSourceRGB(r, g, b);
            cr.rectangle(0, 0, options.colorBoxSize ?? 16, options.colorBoxSize ?? 16);
            cr.fill();
            return false;
        });
        row.pack_start(colorBox, false, false, 0);

        const label = new Gtk.Label({
            label: item.text || '',
            halign: Gtk.Align.START
        });
        row.pack_start(label, true, true, 0);
        contentBox.pack_start(row, false, false, 0);
    }
}

export function showHelpPopover(options = {}) {
    const popover = new Gtk.Popover();
    popover.set_relative_to(options.relativeTo);
    popover.set_position(options.position ?? Gtk.PositionType.BOTTOM);

    const contentBox = buildContentContainer(options.contentOptions);
    const title = new Gtk.Label({
        label: options.title || '',
        halign: Gtk.Align.START
    });
    applyLabelAttributes(title, { bold: true });
    contentBox.pack_start(title, false, false, 0);

    for (const item of options.helpItems || []) {
        appendHelpItem(contentBox, item, {
            leadingWidth: options.leadingWidth,
            maxWidthChars: options.maxWidthChars,
            rowSpacing: options.rowSpacing
        });
    }

    appendColorLegend(contentBox, {
        colorLegendTitle: options.colorLegendTitle,
        colorLegendMarginTop: options.colorLegendMarginTop,
        colorItems: options.colorItems,
        parseColor: options.parseColor,
        colorRowSpacing: options.colorRowSpacing,
        colorBoxSize: options.colorBoxSize
    });

    popover.add(contentBox);
    contentBox.show_all();
    popover.popup();
    return popover;
}
