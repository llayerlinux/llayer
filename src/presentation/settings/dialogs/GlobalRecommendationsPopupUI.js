import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from '../../common/ViewUtils.js';
import {
    attachRecommendationDemoPreview,
    buildRecommendationCategorySection,
    buildRecommendationChildCard,
    buildRecommendationToggleButton,
    buildRecommendationWorkspaceRow
} from '../../common/RecommendationsUiShared.js';

export function buildHeader(ctx) {
    const headerBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2
    });
    headerBox.get_style_context().add_class('rec-header');

    const titleLabel = new Gtk.Label({
        label: ctx.t('GLOBAL_RECOMMENDATIONS_TITLE') || 'Global Recommendations',
        halign: Gtk.Align.START
    });
    titleLabel.get_style_context().add_class('rec-header-title');
    headerBox.pack_start(titleLabel, false, false, 0);

    const subtitleLabel = new Gtk.Label({
        label: ctx.t('GLOBAL_RECOMMENDATIONS_DESC') || 'Apply recommended settings globally (affects all themes)',
        halign: Gtk.Align.START,
        wrap: true
    });
    subtitleLabel.get_style_context().add_class('rec-header-subtitle');
    headerBox.pack_start(subtitleLabel, false, false, 0);

    return headerBox;
}

export function buildFooter(ctx) {
    let footerBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });
    footerBox.get_style_context().add_class('rec-footer');

    let spacer = new Gtk.Box({hexpand: true});
    footerBox.pack_start(spacer, true, true, 0);

    let closeBtn = new Gtk.Button({ label: ctx.t('CLOSE') || 'Close' });
    closeBtn.get_style_context().add_class('rec-close-btn');
    addPointerCursor(closeBtn);
    closeBtn.connect('clicked', () => ctx.popup.hide());
    footerBox.pack_end(closeBtn, false, false, 0);

    return footerBox;
}

export function buildCategoryHeader(ctx, category, catDef, isCollapsed, items) {
    return buildRecommendationCategorySection({
        category,
        catDef,
        isCollapsed,
        items,
        translate: ctx.t.bind(ctx),
        getCollapsedState: (name) => ctx._categoryCollapsed[name] ?? false,
        setCollapsedState: (name, collapsed) => {
            ctx._categoryCollapsed[name] = collapsed;
        },
        createCard: (rec, children, recommendations) => ctx.buildRecommendationCard(rec, children, recommendations),
        pointerCursor: addPointerCursor,
        containerSpacing: 4,
        headerSpacing: 8,
        contentSpacing: 0,
        expandIconWidth: 12,
        fallbackCategoryName: (name) => name
    });
}

export function buildRecommendationCard(ctx, rec, children, allRecommendations) {
    const isApplied = ctx.isRecommendationApplied(rec);

    const card = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 0
    });
    card.get_style_context().add_class('rec-card');

    const mainRow = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 10
    });

    const toggleBtn = buildRecommendationToggleButton({
        isApplied,
        translate: ctx.t.bind(ctx),
        onApply: () => {
            ctx.applyRecommendation(rec, allRecommendations);
            ctx.loadRecommendations();
        },
        onRevert: () => {
            ctx.revertRecommendation(rec, allRecommendations);
            ctx.loadRecommendations();
        },
        pointerCursor: addPointerCursor,
        width: 28,
        height: 28
    });
    mainRow.pack_start(toggleBtn, false, false, 0);

    const labelBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2
    });
    labelBox.set_hexpand(true);

    const labelValue = ctx.t(rec.labelKey) || rec.label || '';
    const labelText = rec.type === 'keybind'
        ? `${labelValue}  ->  ${rec.dispatcher}`
        : labelValue;

    const mainLabel = new Gtk.Label({
        label: labelText,
        halign: Gtk.Align.START
    });
    mainLabel.get_style_context().add_class('rec-label-main');
    labelBox.pack_start(mainLabel, false, false, 0);

    const desc = ctx.t(rec.descriptionKey) || rec.description;
    applyOptionalSetters([[desc, (value) => mainLabel.set_tooltip_text(value), Boolean]]);

    if (rec.type === 'param' || rec.type === 'keybind') {
        const valueText = rec.type === 'keybind' ? rec.dispatcher : (rec.defaultValue || '');
        const valueLabel = new Gtk.Label({
            label: valueText,
            halign: Gtk.Align.START
        });
        valueLabel.get_style_context().add_class(rec.type === 'keybind' ? 'rec-dispatcher' : 'rec-value');
        labelBox.pack_start(valueLabel, false, false, 0);
    }

    mainRow.pack_start(labelBox, true, true, 0);

    attachRecommendationDemoPreview(mainRow, rec.demoGif, {
        width: 100,
        height: 60,
        radius: 6
    });

    card.pack_start(mainRow, false, false, 0);

    if (rec.type === 'workspaceRule' && Array.isArray(rec.workspaces)) {
        const wsRow = ctx.buildWorkspaceSelector(rec);
        card.pack_start(wsRow, false, false, 0);
    }

    if (children && children.length > 0) {
        const childrenContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        childrenContainer.get_style_context().add_class('rec-children-container');

        for (const child of children) {
            childrenContainer.pack_start(buildRecommendationChildCard({
                rec: child,
                isApplied: ctx.isRecommendationApplied(child),
                translate: ctx.t.bind(ctx),
                label: ctx.t(child.labelKey) || child.label || '',
                description: ctx.t(child.descriptionKey) || child.description,
                valueText: child.defaultValue || '',
                rowSpacing: 8
            }), false, false, 0);
        }

        card.pack_start(childrenContainer, false, false, 0);
    }

    return card;
}

export function buildWorkspaceSelector(ctx, rec) {
    const enabledWs = ctx.getAppliedWorkspaces(rec);
    return buildRecommendationWorkspaceRow({
        workspaces: rec.workspaces || [],
        isWorkspaceEnabled: (ws) => enabledWs.has(ws),
        onWorkspaceToggled: (ws, enabled) => {
            if (enabled) {
                ctx.selectedWorkspaces.add(ws);
            } else {
                ctx.selectedWorkspaces.delete(ws);
            }
            ctx.applyWorkspaceRules(rec);
        },
        pointerCursor: addPointerCursor,
        rowSpacing: 4,
        wrapRow: true,
        wrapperClass: 'rec-ws-grid',
        wrapperSpacing: 4,
        wrapperMarginTop: 8
    });
}
