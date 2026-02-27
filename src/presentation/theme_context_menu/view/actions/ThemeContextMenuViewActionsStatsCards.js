import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import cairo from 'cairo';
import { createLightningIcon } from '../ThemeContextMenuViewIconFactory.js';
import { applyOptionalSetters } from '../../../common/ViewUtils.js';
import { toNonNegativeNumber } from '../../../../infrastructure/utils/Utils.js';

class ThemeContextMenuViewActionsStatsCards {
    createStatsLabel(text, className, {xalign = 0, halign = Gtk.Align.START} = {}) {
        const label = new Gtk.Label({
            label: text,
            xalign,
            halign
        });
        applyOptionalSetters([[className, (value) => label.get_style_context().add_class(value), Boolean]]);
        return label;
    }

    buildStatsCard(theme) {
        const frame = new Gtk.Frame({
            width_request: 100,
            height_request: 90
        });
        frame.set_shadow_type(Gtk.ShadowType.OUT);
        frame.get_style_context().add_class('menu-stats-card-frame');

        const darkBg = new Gtk.EventBox();
        darkBg.set_visible_window(true);
        darkBg.get_style_context().add_class('menu-stats-card-bg');
        const card = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_left: 10,
            margin_right: 10,
            margin_top: 10,
            margin_bottom: 12
        });

        const applyRow = this.createStatsCardRow(
            'lightning-bolt',
            this.formatPerformanceValue(theme.averageApplyMs),
            this.translate('THEME_CONTEXT_APPLY_AVG_TITLE'),
            'lightning-icon-colored'
        );

        const installRow = this.createStatsCardRow(
            'clock-time',
            this.formatPerformanceValue(theme.averageInstallMs),
            this.translate('THEME_CONTEXT_INSTALL_AVG_TITLE')
        );

        const downloadsRow = this.createStatsCardRow(
            'document-save-symbolic',
            this.formatDownloadsCount(toNonNegativeNumber(theme.downloadCount, 0)),
            null
        );

        applyOptionalSetters([[downloadsRow?.container, (container) => container.set_margin_top(6)]]);

        const rows = [applyRow, installRow, downloadsRow].filter(Boolean);

        rows.forEach((row, index) => {
            card.pack_start(row.container, false, false, 0);

            index === 0 && (() => {
                const separatorBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
                separatorBox.set_halign(Gtk.Align.START);
                separatorBox.set_margin_start(26);
                separatorBox.set_margin_top(4);
                separatorBox.set_margin_bottom(4);

                const separatorLine = new Gtk.DrawingArea();
                separatorLine.set_size_request(50, 1);
                separatorLine.connect('draw', (widget, cr) => {
                    const gradient = new cairo.LinearGradient(0, 0, 50, 0);
                    gradient.addColorStopRGBA(0, 0.6, 0.65, 0.7, 0.6);
                    gradient.addColorStopRGBA(1, 0.5, 0.55, 0.6, 0.15);
                    cr.setSource(gradient);
                    cr.rectangle(0, 0, 50, 1);
                    cr.fill();
                    return false;
                });

                separatorBox.pack_start(separatorLine, false, false, 0);
                card.pack_start(separatorBox, false, false, 0);
            })();
        });

        darkBg.add(card);
        frame.add(darkBg);

        return {
            container: frame,
            labels: {
                downloadsPrimary: downloadsRow?.primaryLabel || null,
                installPrimary: installRow?.primaryLabel || null,
                applyPrimary: applyRow?.primaryLabel || null
            }
        };
    }

    loadCustomIcon(iconName, size = 18) {
        const relativeIconPath = `${GLib.get_current_dir()}/assets/icons/${iconName}.svg`;

        return Gio.File.new_for_path(relativeIconPath).query_exists(null)
            ? Gtk.Image.new_from_pixbuf(
                GdkPixbuf.Pixbuf.new_from_file_at_scale(relativeIconPath, size, size, true)
            )
            : (() => {
                const placeholderIcon = Gtk.Image.new_from_icon_name(iconName, Gtk.IconSize.LARGE_TOOLBAR);
                placeholderIcon?.set_pixel_size?.(size);
                return placeholderIcon;
            })();
    }

    createColoredLightningIcon(size = 20) {
        return createLightningIcon(size, [0.3, 0.75, 1.0], [0.15, 0.55, 0.9]);
    }

    createStatsCardRow(iconName, primaryText, secondaryText = null, iconClass = null) {
        const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        row.get_style_context().add_class('menu-stats-card-row');
        row.set_halign(Gtk.Align.FILL);
        row.set_valign(Gtk.Align.CENTER);
        row.set_margin_top(1);
        row.set_margin_bottom(1);

        const buildPrimaryOnly = () => {
            const centerBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
            centerBox.set_halign(Gtk.Align.CENTER);

            const icon = iconName ? this.loadCustomIcon(iconName, 18) : null;
            icon && (
                icon.get_style_context().add_class('menu-stats-card-icon'),
                applyOptionalSetters([[iconClass, (value) => icon.get_style_context().add_class(value), Boolean]]),
                centerBox.pack_start(icon, false, false, 0)
            );

            const primaryLabel = this.createStatsLabel(
                primaryText || '--',
                'menu-stats-card-primary',
                {xalign: 0.5, halign: Gtk.Align.CENTER}
            );
            centerBox.pack_start(primaryLabel, false, false, 0);

            row.pack_start(centerBox, true, false, 0);

            return {container: row, primaryLabel, secondaryLabel: null};
        };
        return !secondaryText
            ? buildPrimaryOnly()
            : (() => {

                const icon = iconName
                    ? (iconClass === 'lightning-icon-colored'
                        ? this.createColoredLightningIcon(18)
                        : this.loadCustomIcon(iconName, 18))
                    : null;
                applyOptionalSetters([[
                    icon,
                    (widget) => {
                        widget.set_halign(Gtk.Align.START);
                        widget.set_valign(Gtk.Align.CENTER);
                        widget.get_style_context().add_class('menu-stats-card-icon');
                        applyOptionalSetters([[iconClass, (value) => widget.get_style_context().add_class(value), Boolean]]);
                        row.pack_start(widget, false, false, 0);
                    }
                ]]);

                const textBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 0});

                const primaryLabel = this.createStatsLabel(
                    primaryText || '--',
                    'menu-stats-card-primary'
                );
                primaryLabel.set_valign(Gtk.Align.CENTER);
                textBox.pack_start(primaryLabel, false, false, 0);

                const secondaryLabel = this.createStatsLabel(
                    secondaryText,
                    'menu-stats-card-secondary'
                );
                secondaryLabel.set_valign(Gtk.Align.CENTER);
                textBox.pack_start(secondaryLabel, false, false, 0);

                row.pack_start(textBox, true, true, 0);

                return {
                    container: row,
                    primaryLabel,
                    secondaryLabel
                };
            })();
    }
}

export function applyThemeContextMenuViewActionsStatsCards(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewActionsStatsCards.prototype);
}
