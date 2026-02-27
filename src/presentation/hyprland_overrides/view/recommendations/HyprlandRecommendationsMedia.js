import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

export function createRoundedGifWidget(gifPath, width, height, radius) {
    const drawingArea = new Gtk.DrawingArea();
    drawingArea.set_size_request(width, height);

    let animation = null;
    let animationIter = null;
    let isDestroyed = false;
    let timeoutId = 0;

    const loaded = tryOrNull('createRoundedGifWidget.load', () => {
        animation = GdkPixbuf.PixbufAnimation.new_from_file(gifPath);
        animationIter = animation.get_iter(null);
        return true;
    });

    loaded && drawingArea.connect('draw', (_widget, cr) => {
        const pixbuf = !isDestroyed && animationIter && animationIter.get_pixbuf();
        const scaled = pixbuf && pixbuf.scale_simple(width, height, GdkPixbuf.InterpType.BILINEAR);
        return scaled
            ? (
                cr.newPath(),
                cr.moveTo(radius, 0),
                cr.lineTo(width - radius, 0),
                cr.arc(width - radius, radius, radius, -Math.PI / 2, 0),
                cr.lineTo(width, height - radius),
                cr.arc(width - radius, height - radius, radius, 0, Math.PI / 2),
                cr.lineTo(radius, height),
                cr.arc(radius, height - radius, radius, Math.PI / 2, Math.PI),
                cr.lineTo(0, radius),
                cr.arc(radius, radius, radius, Math.PI, 3 * Math.PI / 2),
                cr.closePath(),
                cr.clip(),
                Gdk.cairo_set_source_pixbuf(cr, scaled, 0, 0),
                cr.paint(),
                true
            )
            : false;
    });

    drawingArea.connect('destroy', () => {
        isDestroyed = true;
        animationIter = null;
        timeoutId > 0 && (GLib.source_remove(timeoutId), timeoutId = 0);
    });

    const advanceFrame = () => {
        const canAdvance = !isDestroyed && animationIter;
        const advanceResult = canAdvance
            ? tryOrNull('createRoundedGifWidget.advance', () => animationIter.advance(null))
            : null;
        return advanceResult === null
            ? false
            : (
                !isDestroyed && drawingArea.queue_draw(),
                (() => {
                    const delay = animationIter?.get_delay_time?.() || 0;
                    delay > 0 && !isDestroyed
                        && (timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, advanceFrame));
                })(),
                false
            );
    };
    const initialDelay = loaded ? (animationIter?.get_delay_time?.() || 0) : 0;
    loaded
        && !animation.is_static_image()
        && initialDelay > 0
        && (timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, initialDelay, advanceFrame));

    return loaded ? drawingArea : null;
}

export function getDemoBasePath() {
    return GLib.get_current_dir() + '/src/assets/demos';
}
