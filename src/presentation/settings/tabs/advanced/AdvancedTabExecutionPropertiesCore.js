import Gtk from 'gi://Gtk?version=3.0';
import { applyOptionalSetters } from '../../../common/ViewUtils.js';

export function applyAdvancedTabExecutionPropertiesCore(targetPrototype) {
    targetPrototype.createClassedLabel = function(text, className, {halign = Gtk.Align.START, wrap = false, xalign = null} = {}) {
        const label = new Gtk.Label({
            label: text,
            halign,
            wrap
        });
        applyOptionalSetters([
            [xalign, (value) => label.set_xalign(value)],
            [className, (value) => label.get_style_context().add_class(value), Boolean]
        ]);
        return label;
    };

    targetPrototype.createTabLabel = function(text) {
        return new Gtk.Label({label: text});
    };
}
