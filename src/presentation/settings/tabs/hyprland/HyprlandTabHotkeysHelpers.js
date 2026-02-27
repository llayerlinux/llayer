import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from '../../../common/ViewUtils.js';
import { GlobalRecommendationsPopup } from '../../dialogs/GlobalRecommendationsPopup.js';

export function applyHyprlandTabHotkeysHelpers(prototype) {

    prototype.createIconButton = function(iconName, tooltip, classNames = []) {
        const btn = new Gtk.Button();
        btn.set_image(Gtk.Image.new_from_icon_name(iconName, Gtk.IconSize.BUTTON));
        classNames.forEach((className) => btn.get_style_context().add_class(className));
        applyOptionalSetters([[tooltip, (value) => btn.set_tooltip_text(value), Boolean]]);
        addPointerCursor(btn);
        return btn;
    };

    prototype.createDimLabel = function(text, {halign = Gtk.Align.START, wrap = true, xalign = 0, marginTop = null} = {}) {
        const label = new Gtk.Label({
            label: text,
            halign,
            wrap,
            xalign
        });
        label.get_style_context().add_class('dim-label');
        applyOptionalSetters([[marginTop, (value) => label.set_margin_top(value)]]);
        return label;
    };

    prototype.buildHotkeyOverridesButton = function() {
        const btn = new Gtk.Button({
            label: this.t('HOTKEY_OVERRIDES_BTN') || 'Hotkey Overrides'
        });
        btn.get_style_context().add_class('hotkey-overrides-btn');
        btn.set_tooltip_text(this.t('HOTKEY_OVERRIDES_TOOLTIP') || 'Configure global hotkey overrides');
        addPointerCursor(btn);
        btn.connect('clicked', () => this.showHotkeyOverridesDialog());
        return btn;
    };

    prototype.buildRecommendationsButton = function() {
        const btn = new Gtk.Button({
            label: this.t('RECOMMENDATIONS_BTN') || 'Recommendations'
        });
        btn.get_style_context().add_class('recommendations-btn');
        btn.set_tooltip_text(this.t('RECOMMENDATIONS_TOOLTIP') || 'Apply recommended global settings');
        addPointerCursor(btn);
        btn.connect('clicked', () => this.showRecommendationsPopup());
        return btn;
    };

    prototype.showRecommendationsPopup = function() {
        const popup = new GlobalRecommendationsPopup({
            t: this.t,
            parentWindow: this.parentWindow,
            settingsManager: this.settingsManager,
            eventBus: this.eventBus,
            parameterService: this.parameterService,
            themeRepository: this.themeRepository
        });
        popup.show();
    };
}
