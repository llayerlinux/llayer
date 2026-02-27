import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';
import GLib from 'gi://GLib';
import { THEME_PROPERTY_DEFINITIONS } from '../../../infrastructure/constants/ThemeProperties.js';
import { addPointerCursor } from '../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

const VARIANT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e91e63', '#00bcd4'];
const VARIANT_MAX_PER_COLUMN = 3;

export function createPropertyIcons(ctx, theme, isInstalledTab, isNetworkTab, getItemBox, getItem) {
    const iconsArray = [];
    const hasLocalMetadata = theme.isLocalWithMetadata || theme.source === 'LOCAL_WITH_METADATA';
    const isImported = theme.properties?.imported;

    (!isInstalledTab && hasLocalMetadata)
        && iconsArray.push(createPropertyIcon(ctx, 'media-floppy-symbolic', 'disk', getItemBox, getItem));

    (isInstalledTab && theme.name !== 'default' && (!hasLocalMetadata || isImported))
        && iconsArray.push(createPropertyIcon(ctx, 'system-run-symbolic', 'script', getItemBox, getItem));

    THEME_PROPERTY_DEFINITIONS
        .filter(({key}) => theme.properties?.[key])
        .forEach(({code, accentClass}) => iconsArray.push(createBadge(ctx, code, accentClass, getItemBox, getItem)));

    return iconsArray.length
        ? (() => {
            const iconsBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6, height_request: 18});
            iconsArray.forEach(icon => iconsBox.pack_start(icon, false, false, 0));
            iconsBox.get_style_context().add_class('theme-icons-overlay');
            iconsBox.set_valign(Gtk.Align.START);
            iconsBox.set_halign(Gtk.Align.END);

            iconsBox.set_margin_top(6 + 4);
            iconsBox.set_margin_end(6 + 3);
            return iconsBox;
        })()
        : null;
}

export function createPropertyIcon(ctx, iconName, className, getItemBox, getItem) {
    const img = new Gtk.Image({icon_name: iconName, icon_size: Gtk.IconSize.SMALL_TOOLBAR});
    img.get_style_context().add_class(`my-theme-selector-${className}-icon`);
    img.set_halign(Gtk.Align.CENTER);
    return createHoverContainer(ctx, img, getItemBox, getItem);
}

export function createBadge(ctx, letter, className, getItemBox, getItem) {
    const label = new Gtk.Label({label: letter, halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER});
    label.get_style_context().add_class(className);
    return createHoverContainer(ctx, label, getItemBox, getItem);
}

export function createHoverContainer(ctx, child, getItemBox, getItem) {
    const container = new Gtk.EventBox();
    container.add(child);
    ctx.connectIconHover(container, getItemBox, getItem);
    return container;
}

export function createVariantCircles(ctx, theme, getItemBox, getItem) {
    let themeVariants = (theme.variants && typeof theme.variants === 'object') ? theme.variants : {};

    let hasVariants = typeof theme.hasVariants === 'function'
        ? theme.hasVariants()
        : (Array.isArray(themeVariants.available) && themeVariants.available.length > 1);

    let variants = typeof theme.getVariants === 'function'
        ? theme.getVariants()
        : (Array.isArray(themeVariants.available) ? themeVariants.available : []);
    let fallbackActiveVariant = variants.length > 0 ? variants[0] : null,
        activeVariant = typeof theme.getActiveVariant === 'function'
        ? theme.getActiveVariant()
        : (typeof themeVariants.activeVariant === 'string' ? themeVariants.activeVariant : fallbackActiveVariant);
    return (hasVariants && variants.length >= 2)
        ? (() => {
            let container = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4
            });
            container.get_style_context().add_class('theme-variant-circles-container');
            container.set_halign(Gtk.Align.START);
            container.set_valign(Gtk.Align.CENTER);

            container.set_margin_start(8 + 3);

            let numColumns = Math.ceil(variants.length / VARIANT_MAX_PER_COLUMN);

            for (let col = 0; col < numColumns; col++) {
                let column = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4
                });

                for (const [row, variantName] of variants
                    .slice(col * VARIANT_MAX_PER_COLUMN, (col + 1) * VARIANT_MAX_PER_COLUMN)
                    .entries()) {
                    let idx = col * VARIANT_MAX_PER_COLUMN + row,
                        isActive = variantName === activeVariant,
                        color = VARIANT_COLORS[idx % VARIANT_COLORS.length];

                    const circle = createVariantCircle(
                        ctx,
                        theme,
                        variantName,
                        color,
                        isActive,
                        getItemBox,
                        getItem
                    );
                    column.pack_start(circle, false, false, 0);
                }

                container.pack_start(column, false, false, 0);
            }

            return container;
        })()
        : null;
}

export function createVariantCircle(ctx, theme, variantName, color, isActive, getItemBox, getItem) {
    let eventBox = new Gtk.EventBox();
    eventBox.set_tooltip_text(variantName);

    let circle = new Gtk.DrawingArea();
    circle.set_size_request(12, 12);

    circle.connect('draw', (widget, cr) => {
        let width = widget.get_allocated_width(),
            height = widget.get_allocated_height(),
            radius = Math.min(width, height) / 2 - 1,
            centerX = width / 2,
            centerY = height / 2;

        let [r, g, b] = parseHexColor(color);

        cr.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        cr.setSourceRGBA(r, g, b, isActive ? 1.0 : 0.6);
        cr.fill();

        isActive && (
            cr.arc(centerX, centerY, radius, 0, 2 * Math.PI),
            cr.setSourceRGBA(1, 1, 1, 0.9),
            cr.setLineWidth(2),
            cr.stroke()
        );

        return false;
    });

    eventBox.add(circle);
    eventBox.get_style_context().add_class('theme-variant-circle');

    ctx.connectIconHover(eventBox, getItemBox, getItem);

    eventBox.connect('button-press-event', () => {
        ctx.onVariantClick(theme, variantName);
        return true;
    });

    return eventBox;
}

export function parseHexColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
}

export function createNameLabel(name) {
    const label = new Gtk.Label({
        label: name,
        halign: Gtk.Align.START,
        valign: Gtk.Align.END,
        ellipsize: Pango.EllipsizeMode.END,
        max_width_chars: 15,
        margin_start: 8 + 3,
        margin_bottom: 20 + 4
    });
    label.get_style_context().add_class('theme-label-overlay');
    return label;
}

export function createMenuButton(ctx, theme, getItem, getItemBox) {
    const menuBtn = new Gtk.Button();
    menuBtn.set_image(ctx.createIcon('open-menu-symbolic', 16));
    menuBtn.get_style_context().add_class('theme-menu-btn-overlay');
    menuBtn.set_halign(Gtk.Align.END);
    menuBtn.set_valign(Gtk.Align.END);

    menuBtn.set_margin_end(8 + 3);
    menuBtn.set_margin_bottom(8 + 4);
    addPointerCursor(menuBtn);

    ctx.connectIconHover(menuBtn, getItemBox, getItem);
    menuBtn.connect('button-press-event', () => {
        const item = getItem();
        return ctx.handleMenuButtonPress(item, theme, menuBtn);
    });
    menuBtn.connect('button-release-event', () => true);
    return menuBtn;
}

export function handleMenuButtonPress(ctx, item, theme, menuBtn) {
    return item?._menuClicked
        ? true
        : (
            item._menuClicked = true,
            item._menuClickTimestamp = Date.now(),
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.DEBOUNCE_MS, () => {
                item && (item._menuClicked = false, item._menuClickTimestamp = null);
                return false;
            }),
            ctx.onMenuClick(theme, menuBtn),
            true
        );
}
