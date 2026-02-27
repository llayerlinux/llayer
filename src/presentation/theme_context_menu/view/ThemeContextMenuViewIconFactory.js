import Gtk from 'gi://Gtk?version=3.0';
import cairo from 'cairo';

function createLightningIcon(size = 12, startColor = [0.4, 0.8, 0.9], endColor = [0.25, 0.6, 0.8]) {
    const drawingArea = new Gtk.DrawingArea();
    drawingArea.set_size_request(size, size);

    drawingArea.connect('draw', (_widget, cr) => {
        const gradient = new cairo.LinearGradient(0, 0, size, size);
        gradient.addColorStopRGB(0, startColor[0], startColor[1], startColor[2]);
        gradient.addColorStopRGB(1, endColor[0], endColor[1], endColor[2]);

        cr.setSource(gradient);

        const scale = size / 20;
        cr.save();
        cr.scale(scale, scale);

        cr.moveTo(12, 0);
        cr.lineTo(3, 11);
        cr.lineTo(8, 11);
        cr.lineTo(5, 20);
        cr.lineTo(17, 8);
        cr.lineTo(11, 8);
        cr.lineTo(15, 0);
        cr.closePath();

        cr.fill();
        cr.restore();

        return false;
    });

    return drawingArea;
}

export { createLightningIcon };
