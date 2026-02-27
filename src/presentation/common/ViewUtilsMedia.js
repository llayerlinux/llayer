import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gtk from 'gi://Gtk?version=3.0';
import cairo from 'gi://cairo';

const ICON_SIZE_THRESHOLDS = [
    [16, Gtk.IconSize.SMALL_TOOLBAR],
    [24, Gtk.IconSize.BUTTON],
    [32, Gtk.IconSize.LARGE_TOOLBAR]
];

function isLoadablePixbuf(path) {
    const filePath = typeof path === 'string' ? path : '';
    const [format, width, height] = (filePath && Gio.File.new_for_path(filePath).query_exists(null))
        ? GdkPixbuf.Pixbuf.get_file_info(filePath)
        : [null, 0, 0];
    return Boolean(format) && width > 0 && height > 0;
}

function createRoundedPixbuf(path, size = 96, radius = 12) {
    if (!isLoadablePixbuf(path)) {
        return null;
    }

    let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, size, size),
        surface = new cairo.ImageSurface(cairo.Format.ARGB32, size, size),
        cr = new cairo.Context(surface);

    cr.newSubPath();
    cr.arc(radius, radius, radius, Math.PI, 3 * Math.PI / 2);
    cr.arc(size - radius, radius, radius, 3 * Math.PI / 2, 0);
    cr.arc(size - radius, size - radius, radius, 0, Math.PI / 2);
    cr.arc(radius, size - radius, radius, Math.PI / 2, Math.PI);
    cr.closePath();
    cr.clip();

    Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
    cr.paint();
    return Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size);
}

export const IconUtils = {
    customIcons: ['list-add-symbolic', 'document-send-symbolic', 'view-refresh-symbolic', 'window-close-symbolic', 'preferences-system-symbolic', 'preferences-other-symbolic'],

    tryLoadCustomIcon(iconName, size, dir) {
        const iconPath = GLib.build_filenamev([dir, 'assets', 'icons', `${iconName}.svg`]),
            exists = this.customIcons.includes(iconName) && Gio.File.new_for_path(iconPath).query_exists(null),
            pixbuf = exists ? GdkPixbuf.Pixbuf.new_from_file_at_size(iconPath, size, size) : null;
        return pixbuf
            ? (() => {
                const img = new Gtk.Image();
                img.set_from_pixbuf(pixbuf);
                return img;
            })()
            : null;
    },

    createIcon(iconName, size, widthRequest, heightRequest, currentDir) {
        const icon = this.tryLoadCustomIcon(iconName, size, currentDir || GLib.get_current_dir())
            || new Gtk.Image({icon_name: iconName, icon_size: this.getIconSize(size)});
        widthRequest && icon.set_size_request(widthRequest, heightRequest || widthRequest);
        return icon;
    },

    getIconSize(size) {
        return ICON_SIZE_THRESHOLDS.find(([threshold]) => size <= threshold)?.[1] ?? Gtk.IconSize.DIALOG;
    }
};

export const PixbufUtils = {
    makeRoundedPixbuf(path, size = 96, radius = 12) {
        return createRoundedPixbuf(path, size, radius);
    },

    makeCircularPixbuf(path, displaySize = 64, imageSize = 128) {
        if (!isLoadablePixbuf(path)) return null;
        const pix = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, imageSize, imageSize, true),
            surface = new cairo.ImageSurface(cairo.Format.ARGB32, displaySize, displaySize),
            cr = new cairo.Context(surface);
        cr.arc(displaySize / 2, displaySize / 2, displaySize / 2, 0, 2 * Math.PI);
        cr.clip();
        cr.scale(displaySize / imageSize, displaySize / imageSize);
        Gdk.cairo_set_source_pixbuf(cr, pix, 0, 0);
        cr.paint();
        return Gdk.pixbuf_get_from_surface(surface, 0, 0, displaySize, displaySize);
    }
};

export { createRoundedPixbuf as makeRoundedPixbuf };

export function createRoundedImage(path, options = {}) {
    const {
        size = 40,
        radius = 12,
        placeholderIcon = 'image-missing',
        placeholderSize = Gtk.IconSize.LARGE_TOOLBAR
    } = options;

    const image = new Gtk.Image();
    const rounded = createRoundedPixbuf(path, size, radius);
    rounded
        ? (
            image.set_from_pixbuf(rounded),
            image.set_halign(Gtk.Align.CENTER),
            image.set_valign(Gtk.Align.CENTER)
        )
        : image.set_from_icon_name(placeholderIcon, placeholderSize);

    return image;
}
