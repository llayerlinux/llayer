import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from './ViewUtils.js';
import { createRoundedGifWidget, getDemoBasePath } from '../hyprland_overrides/view/recommendations/HyprlandRecommendationsMedia.js';

function determineCategoryName(category, catDef, translate, fallbackCategoryName) {
    return translate(catDef.labelKey || category)
        || catDef.defaultLabel
        || fallbackCategoryName(category);
}

function getPointerCursorHandler(handler) {
    return typeof handler === 'function' ? handler : addPointerCursor;
}

function hasDemoFile(demoPath) {
    return GLib.file_test(demoPath, GLib.FileTest.EXISTS);
}

export function formatRecommendationCategoryName(category = '') {
    return String(category)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildRecommendationCategorySection(options = {}) {
    const {
        category = '',
        catDef = {},
        items = [],
        translate = (key) => key,
        getCollapsedState = () => false,
        setCollapsedState = () => {},
        createCard = () => null,
        pointerCursor = addPointerCursor,
        fallbackCategoryName = formatRecommendationCategoryName,
        containerSpacing = 4,
        headerSpacing = 8,
        contentSpacing = 0,
        expandIconWidth = 12,
        containerClass = ''
    } = options;

    const applyPointerCursor = getPointerCursorHandler(pointerCursor);
    const isCollapsed = !!getCollapsedState(category, catDef);
    const categoryBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: containerSpacing
    });
    applyOptionalSetters([[containerClass, (value) => categoryBox.get_style_context().add_class(value), Boolean]]);

    const headerBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: headerSpacing
    });
    headerBox.get_style_context().add_class('rec-category-header');

    const expandIcon = new Gtk.Label({
        label: isCollapsed ? '>' : 'v',
        halign: Gtk.Align.START
    });
    expandIcon.set_size_request(expandIconWidth, -1);
    headerBox.pack_start(expandIcon, false, false, 0);

    const categoryLabel = new Gtk.Label({
        label: determineCategoryName(category, catDef, translate, fallbackCategoryName),
        halign: Gtk.Align.START
    });
    categoryLabel.get_style_context().add_class('rec-category-title');
    headerBox.pack_start(categoryLabel, false, false, 0);

    applyOptionalSetters([[catDef.author, (value) => {
        const authorLabel = new Gtk.Label({
            label: `by ${value}`,
            halign: Gtk.Align.START
        });
        authorLabel.get_style_context().add_class('rec-category-author');
        headerBox.pack_start(authorLabel, false, false, 4);
    }, Boolean]]);

    const headerEventBox = new Gtk.EventBox();
    headerEventBox.add(headerBox);
    applyPointerCursor(headerEventBox);
    categoryBox.pack_start(headerEventBox, false, false, 0);

    const contentBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: contentSpacing
    });
    contentBox.set_visible(!isCollapsed);

    const parentItems = items.filter((rec) => !rec.parentId);
    for (const rec of parentItems) {
        const children = items.filter((item) => item.parentId === rec.id);
        const card = createCard(rec, children, items);
        card && contentBox.pack_start(card, false, false, 0);
    }

    categoryBox.pack_start(contentBox, false, false, 0);

    headerEventBox.connect('button-press-event', () => {
        const nowCollapsed = !getCollapsedState(category, catDef);
        setCollapsedState(category, nowCollapsed);
        expandIcon.set_label(nowCollapsed ? '>' : 'v');
        contentBox.set_visible(!nowCollapsed);
        return true;
    });

    return categoryBox;
}

export function buildRecommendationToggleButton(options = {}) {
    const {
        isApplied = false,
        translate = (key) => key,
        onApply = null,
        onRevert = null,
        pointerCursor = addPointerCursor,
        width = 24,
        height = 24
    } = options;

    const applyPointerCursor = getPointerCursorHandler(pointerCursor);
    const toggleBtn = new Gtk.Button({ label: isApplied ? '✓' : '' });
    toggleBtn.set_size_request(width, height);
    toggleBtn.get_style_context().add_class('rec-toggle');
    toggleBtn.get_style_context().add_class(isApplied ? 'rec-toggle-on' : 'rec-toggle-off');
    const actionConfig = isApplied
        ? {
            tooltip: translate('REVERT_RECOMMENDATION') || 'Click to revert',
            handler: onRevert
        }
        : {
            tooltip: translate('APPLY_RECOMMENDATION') || 'Click to apply',
            handler: onApply
        };
    toggleBtn.set_tooltip_text(actionConfig.tooltip);
    toggleBtn.connect('clicked', () => {
        typeof actionConfig.handler === 'function' && actionConfig.handler();
    });
    applyPointerCursor(toggleBtn);
    return toggleBtn;
}

export function attachRecommendationDemoPreview(mainRow, demoGif, options = {}) {
    const {
        width = 100,
        height = 60,
        radius = 6,
        frameClass = 'rec-demo-frame'
    } = options;

    const demoPath = demoGif ? `${getDemoBasePath()}/${demoGif}` : null;
    return (demoPath && hasDemoFile(demoPath))
        ? (() => {
            const demoWidget = createRoundedGifWidget(demoPath, width, height, radius);
            return demoWidget
                ? (() => {
                    const demoFrame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
                    applyOptionalSetters([[frameClass, (value) => demoFrame.get_style_context().add_class(value), Boolean]]);
                    demoFrame.pack_start(demoWidget, false, false, 0);
                    mainRow.pack_end(demoFrame, false, false, 0);
                    return demoFrame;
                })()
                : null;
        })()
        : null;
}

export function buildRecommendationChildCard(options = {}) {
    const {
        isApplied = false,
        translate = (key) => key,
        label = '',
        description = '',
        valueText = '',
        rowSpacing = 8
    } = options;

    const card = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: rowSpacing
    });
    card.get_style_context().add_class('rec-card-child');

    const toggleBtn = new Gtk.Button({ label: isApplied ? '✓' : '' });
    toggleBtn.set_size_request(14, 14);
    toggleBtn.get_style_context().add_class('rec-toggle');
    toggleBtn.get_style_context().add_class('rec-toggle-child');
    toggleBtn.get_style_context().add_class(isApplied ? 'rec-toggle-on' : 'rec-toggle-off');
    toggleBtn.set_sensitive(false);
    toggleBtn.set_tooltip_text(
        translate('RECOMMENDATION_DEPENDENT_TOOLTIP') || 'Applied automatically with parent'
    );
    card.pack_start(toggleBtn, false, false, 0);

    const mainLabel = new Gtk.Label({
        label,
        halign: Gtk.Align.START
    });
    mainLabel.get_style_context().add_class('rec-label-child');
    mainLabel.set_hexpand(true);
    applyOptionalSetters([[description, (value) => mainLabel.set_tooltip_text(value), Boolean]]);
    card.pack_start(mainLabel, true, true, 0);

    applyOptionalSetters([[valueText, (value) => {
        const valueLabel = new Gtk.Label({
            label: value,
            halign: Gtk.Align.END
        });
        valueLabel.get_style_context().add_class('rec-value');
        card.pack_end(valueLabel, false, false, 0);
    }, Boolean]]);

    return card;
}

export function buildRecommendationWorkspaceRow(options = {}) {
    const {
        workspaces = [],
        isWorkspaceEnabled = () => false,
        onWorkspaceToggled = () => {},
        pointerCursor = addPointerCursor,
        rowSpacing = 4,
        rowClass = '',
        wrapperClass = '',
        wrapperSpacing = 0,
        wrapperMarginTop = 0,
        wrapRow = false
    } = options;

    const applyPointerCursor = getPointerCursorHandler(pointerCursor);
    const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: rowSpacing
    });
    applyOptionalSetters([[rowClass, (value) => row.get_style_context().add_class(value), Boolean]]);

    for (const ws of workspaces) {
        const checkBtn = new Gtk.CheckButton({ label: String(ws) });
        checkBtn.set_active(!!isWorkspaceEnabled(ws));
        checkBtn.get_style_context().add_class('rec-ws-check');
        checkBtn.set_tooltip_text(`Workspace ${ws}`);
        checkBtn.connect('toggled', () => {
            onWorkspaceToggled(ws, checkBtn.get_active());
        });
        applyPointerCursor(checkBtn);
        row.pack_start(checkBtn, false, false, 0);
    }

    const wrapRowContainer = () => {
        const wrapper = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: wrapperSpacing,
            margin_top: wrapperMarginTop
        });
        applyOptionalSetters([[wrapperClass, (value) => wrapper.get_style_context().add_class(value), Boolean]]);
        wrapper.pack_start(row, false, false, 0);
        return wrapper;
    };
    return wrapRow ? wrapRowContainer() : row;
}
