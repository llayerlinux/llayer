import Gtk from 'gi://Gtk?version=3.0';
import {
    parseHyprlandColorValue,
    rgbaToHyprlandValue,
    syncColorButtonValue
} from '../../../common/HyprlandParamUiShared.js';

export function applyHyprlandOverridePopupRowsColors(prototype) {
    prototype.parseHyprlandColor = function(colorStr) {
        return parseHyprlandColorValue(colorStr);
    };

    prototype.rgbaToHyprland = function(rgba) {
        return rgbaToHyprlandValue(rgba);
    };

    prototype.createColorPreview = function(colorStr, size = 16) {
        const rgba = this.parseHyprlandColor(colorStr);
        return rgba
            ? (() => {
                const drawing = new Gtk.DrawingArea();
                drawing.set_size_request(size, size);
                drawing.connect('draw', (widget, cr) => {
                    const width = widget.get_allocated_width();
                    const height = widget.get_allocated_height();

                    cr.arc(width / 2, height / 2, Math.min(width, height) / 2 - 1, 0, 2 * Math.PI);
                    cr.setSourceRGBA(rgba.red, rgba.green, rgba.blue, rgba.alpha);
                    cr.fill();

                    cr.arc(width / 2, height / 2, Math.min(width, height) / 2 - 1, 0, 2 * Math.PI);
                    cr.setSourceRGBA(0.5, 0.5, 0.5, 0.5);
                    cr.setLineWidth(1);
                    cr.stroke();

                    return false;
                });

                return drawing;
            })()
            : null;
    };

    prototype.updateColorButton = function(colorBtn, colorStr) {
        syncColorButtonValue(colorBtn, colorStr, this.parseHyprlandColor.bind(this));
    };
}
