import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { applyOptionalSetters } from '../../common/ViewUtils.js';

export function showPopup(ctx) {
    ctx.loadCurrentOverrides();

    ctx.popup && ctx.popup.destroy();

    ctx.popup = new Gtk.Window({
        type: Gtk.WindowType.TOPLEVEL,
        decorated: true,
        resizable: true,
        modal: true,
        title: ctx.t('GLOBAL_RECOMMENDATIONS_TITLE') || 'Global Recommendations',
        default_width: 580,
        default_height: 520
    });

    applyOptionalSetters([[ctx.parentWindow, (window) => ctx.popup.set_transient_for(window), Boolean]]);

    ctx.popup.connect('delete-event', () => {
        ctx.popup.hide();
        return true;
    });

    ctx.popup.connect('key-press-event', (widget, event) => {
        return event.get_keyval()[1] === Gdk.KEY_Escape
            ? (ctx.popup.hide(), true)
            : false;
    });

    ctx.applyCustomStyles();

    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 0
    });
    mainBox.get_style_context().add_class('rec-popup-main');

    const headerBox = ctx.buildHeader();
    mainBox.pack_start(headerBox, false, false, 0);

    const scrolled = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
    });
    scrolled.set_hexpand(true);
    scrolled.set_vexpand(true);

    ctx.contentBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
        margin_top: 8,
        margin_bottom: 16,
        margin_start: 16,
        margin_end: 16
    });

    scrolled.add(ctx.contentBox);
    mainBox.pack_start(scrolled, true, true, 0);

    const footerBox = ctx.buildFooter();
    mainBox.pack_start(footerBox, false, false, 0);

    ctx.popup.add(mainBox);

    ctx.loadRecommendations();

    ctx.popup.show_all();
}

export function applyCustomStyles(ctx) {
    !ctx._stylesApplied && (ctx._stylesApplied = true);
}

export function loadRecommendations(ctx) {
    ctx.contentBox && (() => {
        ctx.contentBox.get_children().forEach(child => child.destroy());

        let grouped = ctx.groupByCategory(ctx.getRecommendedSettings());
        let categories = ctx.getRecommendationCategories();

        for (let [category, items] of Object.entries(grouped)) {
            let catDef = categories[category] ?? {};
            let isCollapsed = ctx._categoryCollapsed[category] ?? catDef.collapsedByDefault ?? false;
            ctx.contentBox.pack_start(ctx.buildCategoryHeader(category, catDef, isCollapsed, items), false, false, 0);
        }

        ctx.contentBox.show_all();
    })();
}

export function groupByCategory(recommendations) {
    const grouped = {};
    for (const rec of recommendations) {
        const cat = rec.category || 'OTHER';
        grouped[cat] ||= [];
        grouped[cat].push(rec);
    }
    return grouped;
}
