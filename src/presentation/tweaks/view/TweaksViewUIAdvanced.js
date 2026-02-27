import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';

export function applyTweaksViewUIAdvanced(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewUIAdvanced.prototype);
}

class TweaksViewUIAdvanced {
    appendAdvancedWidgets(container, widgets) {
        widgets.forEach((widget) => container.pack_start(widget, false, false, 0));
    }

    createAdvancedTab() {
        this.advancedOuterGlobal = this.Box({
            vertical: true,
            hexpand: true,
            vexpand: true,
            margin_start: 2,
            margin_end: 2
        });
        this.advancedOuterGlobal.get_style_context().add_class('tweaks-advanced-container');

        const advancedBox = this.Box({
            vertical: true,
            spacing: 4,
            margin_top: 6,
            margin_start: 6,
            margin_end: 6,
            margin_bottom: 6,
            hexpand: false,
            vexpand: true
        });

        const advancedScrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        advancedScrolled.get_style_context().add_class('tweaks-advanced-container');

        const advancedHeaderLabel = this.Label({
            label: this.translate('PLUGINS_ADVANCED_TITLE'),
            margin_start: 0,
            margin_top: 4,
            margin_bottom: 8,
            halign: Gtk.Align.START,
            className: 'tweaks-accent-header'
        });
        advancedBox.pack_start(advancedHeaderLabel, false, false, 0);

        const infoFrame = new Gtk.Frame();
        infoFrame.set_shadow_type(Gtk.ShadowType.IN);
        infoFrame.get_style_context().add_class('tweaks-info-frame');

        const infoContainer = this.Box({
            vertical: true,
            spacing: 2,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const infoHeaderText = this.translate('PLUGINS_ADVANCED_INFO_HEADER_MARKUP');
        const infoHeaderBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
        infoHeaderBox.set_hexpand(true);

        const colonIndex = infoHeaderText.indexOf(':');
        if (colonIndex !== -1) {
            const prefixText = infoHeaderText.slice(0, colonIndex + 1);
            const restText = infoHeaderText.slice(colonIndex + 1).replace(/^[\s\u00A0]+/, '');

            const prefixLabel = this.Label({
                label: prefixText,
                className: 'orange-accent',
                halign: Gtk.Align.START
            });
            infoHeaderBox.pack_start(prefixLabel, false, false, 0);

            restText && (() => {
                const restLabel = new Gtk.Label({
                    label: restText,
                    wrap: true,
                    halign: Gtk.Align.START,
                    xalign: 0
                });
                infoHeaderBox.pack_start(restLabel, true, true, 0);
            })();
        } else {
            const headerLabel = new Gtk.Label({
                label: infoHeaderText,
                wrap: true,
                halign: Gtk.Align.START,
                xalign: 0
            });
            infoHeaderBox.pack_start(headerLabel, true, true, 0);
        }

        const infoSecondLineLabel = this.Label({
            label: this.translate('PLUGINS_ADVANCED_INFO_LINE_ONE'),
            wrap: false,
            margin_start: 0,
            halign: Gtk.Align.START
        });

        const subInfoLabel = this.Label({
            label: this.translate('PLUGINS_ADVANCED_INFO_LINE_TWO'),
            margin_start: 0,
            margin_top: 4,
            wrap: false,
            halign: Gtk.Align.START
        });

        infoContainer.pack_start(infoHeaderBox, false, false, 0);
        infoContainer.pack_start(infoSecondLineLabel, false, false, 0);
        infoContainer.pack_start(subInfoLabel, false, false, 0);

        infoFrame.add(infoContainer);
        advancedBox.pack_start(infoFrame, false, false, 0);

        this.appendAdvancedWidgets(advancedBox, [
            this.createCategory(this.translate('PLUGINS_ADVANCED_BORDER_COLORS')),
            this.createSliderEntry(this.translate('ADV_BORDER_SIZE'), 'general:border_size', 0, 10, 1, this.translate('ADV_BORDER_SIZE_DESC')),
            this.createColorEntry(this.translate('ADV_ACTIVE_BORDER_COLOR'), 'general:col.active_border', '0xffffffff', this.translate('ADV_ACTIVE_BORDER_COLOR_DESC')),
            this.createColorEntry(this.translate('ADV_INACTIVE_BORDER_COLOR'), 'general:col.inactive_border', '0xff444444', this.translate('ADV_INACTIVE_BORDER_COLOR_DESC')),

            this.createCategory(this.translate('PLUGINS_ADVANCED_SHADOWS')),
            this.createSwitch(this.translate('ADV_ENABLE_SHADOWS'), 'decoration:drop_shadow', '1', this.translate('ADV_ENABLE_SHADOWS_DESC')),
            this.createSliderEntry(this.translate('ADV_SHADOW_WIDTH'), 'decoration:shadow:range', 0, 100, 4, this.translate('ADV_SHADOW_WIDTH_DESC')),
            this.createColorEntry(this.translate('ADV_INACTIVE_SHADOW_COLOR'), 'decoration:shadow:color_inactive', '0xee1a1a1a', this.translate('ADV_INACTIVE_SHADOW_COLOR_DESC')),
            this.createColorEntry(this.translate('ADV_ACTIVE_SHADOW_COLOR'), 'decoration:shadow:color', '0xee1a1a1a', this.translate('ADV_ACTIVE_SHADOW_COLOR_DESC')),
            this.createSwitch(this.translate('ADV_SHARP_SHADOWS'), 'decoration:shadow:sharp', '0', this.translate('ADV_SHARP_SHADOWS_DESC')),
            this.createSwitch(this.translate('ADV_IGNORE_WINDOW'), 'decoration:shadow:ignore_window', '1', this.translate('ADV_IGNORE_WINDOW_DESC')),

            this.createCategory(this.translate('PLUGINS_ADVANCED_BLUR')),
            this.createSwitch(this.translate('ADV_IGNORE_OPACITY'), 'decoration:blur:ignore_opacity', '1', this.translate('ADV_IGNORE_OPACITY_DESC')),
            this.createSwitch(this.translate('ADV_XRAY_MODE'), 'decoration:blur:xray', '0', this.translate('ADV_XRAY_MODE_DESC')),
            this.createSliderEntry(this.translate('ADV_BLUR_NOISE'), 'decoration:blur:noise', 0, 100, 1, this.translate('ADV_BLUR_NOISE_DESC')),
            this.createSliderEntry(this.translate('ADV_CONTRAST'), 'decoration:blur:contrast', 0, 200, 89, this.translate('ADV_CONTRAST_DESC')),
            this.createSliderEntry(this.translate('ADV_BRIGHTNESS'), 'decoration:blur:brightness', 0, 200, 82, this.translate('ADV_BRIGHTNESS_DESC')),
            this.createSliderEntry(this.translate('ADV_SATURATION'), 'decoration:blur:vibrancy', 0, 100, 17, this.translate('ADV_SATURATION_DESC')),

            this.createCategory(this.translate('PLUGINS_ADVANCED_INPUT')),
            this.createSwitch(this.translate('ADV_LEFT_HANDED'), 'input:left_handed', '0', this.translate('ADV_LEFT_HANDED_DESC')),

            this.createCategory(this.translate('ADV_TOUCHPAD_GESTURES')),
            this.createSwitch(this.translate('ADV_WORKSPACE_SWIPE'), 'gestures:workspace_swipe', '0', this.translate('ADV_WORKSPACE_SWIPE_DESC')),
            this.createSliderEntry(this.translate('ADV_SWIPE_FINGERS'), 'gestures:workspace_swipe_fingers', 3, 5, 3, this.translate('ADV_SWIPE_FINGERS_DESC')),
            this.createSliderEntry(this.translate('ADV_SWIPE_DISTANCE'), 'gestures:workspace_swipe_distance', 100, 1000, 300, this.translate('ADV_SWIPE_DISTANCE_DESC')),
            this.createSwitch(this.translate('ADV_INVERT_SWIPE'), 'gestures:workspace_swipe_invert', '1', this.translate('ADV_INVERT_SWIPE_DESC')),

            this.createCategory(this.translate('ADV_KEY_BINDINGS')),
            this.createSwitch(this.translate('ADV_WORKSPACE_BACK_FORTH'), 'binds:workspace_back_and_forth', '0', this.translate('ADV_WORKSPACE_BACK_FORTH_DESC')),
            this.createSwitch(this.translate('ADV_HIDE_SPECIAL_WORKSPACE'), 'binds:hide_special_on_workspace_change', '0', this.translate('ADV_HIDE_SPECIAL_WORKSPACE_DESC')),
            this.createSliderEntry(this.translate('ADV_CURSOR_CENTERING'), 'binds:workspace_center_on', 0, 1, 0, this.translate('ADV_CURSOR_CENTERING_DESC')),

            this.createCategory(this.translate('ADV_CURSOR')),
            this.createSliderEntry(this.translate('ADV_HARDWARE_CURSORS'), 'cursor:no_hardware_cursors', 0, 2, 2, this.translate('ADV_HARDWARE_CURSORS_DESC')),
            this.createSliderEntry(this.translate('ADV_EDGE_PADDING'), 'cursor:hotspot_padding', 0, 20, 1, this.translate('ADV_EDGE_PADDING_DESC')),
            this.createSliderEntry(this.translate('ADV_HIDE_TIMEOUT'), 'cursor:inactive_timeout', 0, 60, 0, this.translate('ADV_HIDE_TIMEOUT_DESC')),
            this.createSwitch(this.translate('ADV_SYNC_GSETTINGS'), 'cursor:sync_gsettings_theme', '1', this.translate('ADV_SYNC_GSETTINGS_DESC')),
            this.createSwitch(this.translate('ADV_HIDE_ON_KEY_PRESS'), 'cursor:hide_on_key_press', '0', this.translate('ADV_HIDE_ON_KEY_PRESS_DESC')),
            this.createSwitch(this.translate('ADV_HIDE_ON_TOUCH'), 'cursor:hide_on_touch', '1', this.translate('ADV_HIDE_ON_TOUCH_DESC')),

            this.createCategory(this.translate('ADV_XWAYLAND')),
            this.createSwitch(this.translate('ADV_ENABLE_XWAYLAND'), 'xwayland:enabled', '1', this.translate('ADV_ENABLE_XWAYLAND_DESC')),
            this.createSwitch(this.translate('ADV_NEAREST_NEIGHBOR'), 'xwayland:use_nearest_neighbor', '1', this.translate('ADV_NEAREST_NEIGHBOR_DESC')),
            this.createSwitch(this.translate('ADV_FORCE_ZERO_SCALING'), 'xwayland:force_zero_scaling', '0', this.translate('ADV_FORCE_ZERO_SCALING_DESC')),

            this.createCategory(this.translate('ADV_MISC')),
            this.createSwitch(this.translate('ADV_DISABLE_HYPRLAND_LOGO'), 'misc:disable_hyprland_logo', '0', this.translate('ADV_DISABLE_HYPRLAND_LOGO_DESC')),
            this.createSwitch(this.translate('ADV_VFR'), 'misc:vfr', '1', this.translate('ADV_VFR_DESC')),
            this.createSliderEntry(this.translate('ADV_VRR_MODE'), 'misc:vrr', 0, 3, 0, this.translate('ADV_VRR_MODE_DESC')),
            this.createColorEntry(this.translate('ADV_BACKGROUND_COLOR'), 'misc:background_color', '0x111111', this.translate('ADV_BACKGROUND_COLOR_DESC'))
        ]);

        advancedScrolled.add(advancedBox);
        this.advancedOuterGlobal.pack_start(advancedScrolled, true, true, 0);

        return this.advancedOuterGlobal;
    }

    createPluginsTab() {
        return null;
    }
}
