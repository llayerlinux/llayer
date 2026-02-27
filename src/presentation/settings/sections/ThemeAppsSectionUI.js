import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { createRoundedImage } from '../../common/ViewUtils.js';

class ThemeAppsSectionUI {
    applyTransparentBackground(widgets, color) {
        widgets.forEach((widget) => {
            widget && (
                widget.override_background_color(Gtk.StateFlags.NORMAL, color),
                widget.override_background_color(Gtk.StateFlags.ACTIVE, color)
            );
        });
    }

    build() {
        const frame = new Gtk.Frame({
            shadow_type: Gtk.ShadowType.NONE
        });
        frame.set_border_width(0);
        frame.get_style_context().add_class('theme-apps-frame');

        const title = new Gtk.Label({
            label: this.t('THEME_APPS_INSTALL_FRAME_LABEL'),
            xalign: 0,
            halign: Gtk.Align.START,
            margin_left: 8,
            margin_right: 8,
            margin_top: 6,
            margin_bottom: 4
        });
        frame.set_label_widget(title);

        const container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 8,
            margin_end: 8
        });
        container.set_border_width(0);
        container.get_style_context().add_class('theme-apps');

        this.listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4
        });
        this.listBox.set_border_width(1);
        this.listBox.get_style_context().add_class('theme-apps');

        const viewport = new Gtk.Viewport({shadow_type: Gtk.ShadowType.NONE});
        viewport.set_border_width(1);
        viewport.get_style_context().add_class('theme-apps');
        viewport.add(this.listBox);

        this.scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            margin_top: 0,
            margin_bottom: 0,
            margin_start: 0,
            margin_end: 0
        });
        this.scrolled.set_size_request(-1, 200);
        this.scrolled.set_border_width(1);
        this.scrolled.set_shadow_type(Gtk.ShadowType.NONE);
        this.scrolled.add(viewport);

        const loadingBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 4,
            margin_end: 4,
            halign: Gtk.Align.CENTER
        });

        this.loadingSpinner = new Gtk.Spinner();
        this.loadingSpinner.set_size_request(16, 16);
        loadingBox.pack_start(this.loadingSpinner, false, false, 0);

        this.loadingLabel = new Gtk.Label({
            label: this.t('LOADING'),
            wrap: true,
            xalign: 0
        });
        loadingBox.pack_start(this.loadingLabel, false, false, 0);

        this.stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.CROSSFADE,
            transition_duration: 150
        });
        this.stack.add_named(loadingBox, 'loading');
        this.stack.add_named(this.scrolled, 'content');
        this.stack.set_visible_child_name('loading');
        this.stack.get_style_context().add_class('theme-apps');

        container.pack_start(this.stack, true, true, 0);

        const transparentColor = new Gdk.RGBA({red: 0, green: 0, blue: 0, alpha: 0});
        this.applyTransparentBackground(
            [container, this.stack, loadingBox, this.listBox, viewport, this.scrolled],
            transparentColor
        );

        frame.add(container);

        this.widgets.themeCheckButtons = this.checkboxes;

        return {frame, checkboxes: this.checkboxes};
    }

    buildNote() {
        return new Gtk.Label({
            label: this.t('THEME_APPS_INSTALL_NOTE'),
            wrap: true,
            xalign: 0,
            margin_top: 2,
            margin_bottom: 10
        });
    }

    createPreviewImage(theme) {
        const previewPath = theme.icon || `${theme.path}/preview.png`;

        const image = createRoundedImage(previewPath, {
            size: 40,
            radius: 8,
            placeholderIcon: 'image-missing',
            placeholderSize: Gtk.IconSize.LARGE_TOOLBAR
        });

        const frame = new Gtk.Frame({
            shadow_type: Gtk.ShadowType.OUT
        });
        frame.set_margin_start(4);
        frame.set_margin_end(6);
        frame.set_margin_top(2);
        frame.set_margin_bottom(2);
        frame.get_style_context().add_class('rice-preview-frame');
        frame.add(image);

        return frame;
    }
}

export function applyThemeAppsSectionUI(prototype) {
    copyPrototypeDescriptors(prototype, ThemeAppsSectionUI.prototype);
}
