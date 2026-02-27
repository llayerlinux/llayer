import Gtk from 'gi://Gtk?version=3.0';
import {
    getHyprlandSliderRange,
    parseHyprlandColorValue,
    rgbaToHyprlandValue,
    syncColorButtonValue
} from '../../../common/HyprlandParamUiShared.js';
import { applyOptionalSetters } from '../../../common/ViewUtils.js';
import { applyHyprlandParamPredicates } from '../../../common/HyprlandParamPredicates.js';

export function applyHyprlandTabBuildUtils(prototype) {
    applyHyprlandParamPredicates(prototype);

    prototype.getSliderRange = function(param) {
        return getHyprlandSliderRange(param);
    };

    prototype.parseHyprlandColor = function(colorStr) {
        return parseHyprlandColorValue(colorStr);
    };

    prototype.rgbaToHyprland = function(rgba) {
        return rgbaToHyprlandValue(rgba);
    };

    prototype.updateColorButton = function(colorBtn, colorStr) {
        syncColorButtonValue(colorBtn, colorStr, this.parseHyprlandColor.bind(this));
    };

    prototype.createDimLabel = function(text, cssClass) {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        label.get_style_context().add_class('dim-label');
        applyOptionalSetters([[cssClass, (value) => label.get_style_context().add_class(value), Boolean]]);
        return label;
    };

    prototype.getPlaceholderForParam = function(param) {
        const type = param.type || 'str';
        const def = param.defaultValue;
        return (def !== null && def !== undefined) ? `${type}: ${def}` : type;
    };
}
