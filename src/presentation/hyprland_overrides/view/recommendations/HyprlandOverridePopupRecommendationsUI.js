import Gtk from 'gi://Gtk?version=3.0';
import { applyLabelAttributes, applyOptionalSetters } from '../../../common/ViewUtils.js';
import {
    attachRecommendationDemoPreview,
    buildRecommendationCategorySection,
    buildRecommendationChildCard,
    buildRecommendationToggleButton,
    buildRecommendationWorkspaceRow,
    formatRecommendationCategoryName
} from '../../../common/RecommendationsUiShared.js';

export function applyHyprlandOverridePopupRecommendationsUI(prototype) {
    prototype.ensureCategoryCollapsedStates = function() {
        this._categoryCollapsedStates ||= {};
        return this._categoryCollapsedStates;
    };

    prototype.applyRecommendationStyles = function() {
        if (this._recStylesApplied) {
            return;
        }
        this._recStylesApplied = true;
    };

    prototype.buildRecommendationsTab = function(box) {
        this.applyRecommendationStyles();
        box.get_style_context().add_class('rec-tab-container');

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_bottom: 8
        });
        headerBox.get_style_context().add_class('rec-tab-header');

        const titleLabel = new Gtk.Label({
            label: this.t('RECOMMENDATIONS_TITLE') || 'Community Recommendations',
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('rec-tab-title');
        headerBox.pack_start(titleLabel, false, false, 0);

        const helpBtn = new Gtk.Button();
        helpBtn.set_image(Gtk.Image.new_from_icon_name('help-about-symbolic', Gtk.IconSize.BUTTON));
        helpBtn.set_tooltip_text(this.t('RECOMMENDATIONS_HELP') || 'About recommendations');
        helpBtn.connect('clicked', () => this.showRecommendationsHelp(helpBtn));
        this.applyPointerCursor?.(helpBtn);
        headerBox.pack_end(helpBtn, false, false, 0);

        box.pack_start(headerBox, false, false, 0);

        const descLabel = new Gtk.Label({
            label: this.t('RECOMMENDATIONS_DESC') || 'Popular settings recommended by the community. Apply with one click.',
            halign: Gtk.Align.START,
            wrap: true,
            margin_bottom: 6
        });
        descLabel.get_style_context().add_class('rec-tab-desc');
        box.pack_start(descLabel, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 280
        });

        this.recommendationsContentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });

        scrolled.add(this.recommendationsContentBox);
        box.pack_start(scrolled, true, true, 0);

        this.loadRecommendations();
    };

    prototype.getCategoryCollapsedState = function(category) {
        const states = this.ensureCategoryCollapsedStates();
        const savedState = states[category];
        const categories = this.getRecommendationCategories();
        const catDef = categories[category];
        return savedState !== undefined ? savedState : (catDef?.collapsedByDefault ?? false);
    };

    prototype.setCategoryCollapsedState = function(category, collapsed) {
        this.ensureCategoryCollapsedStates()[category] = collapsed;
    };

    prototype.loadRecommendations = function() {
        const contentBox = this.recommendationsContentBox;
        if (!contentBox) {
            return;
        }

        contentBox.get_children().forEach(child => child.destroy());
        this.recommendationHotkeyCollection = null;

        const recommendations = this.getRecommendedSettings();
        const grouped = this.groupRecommendationsByCategory(recommendations);
        const categories = this.getRecommendationCategories();

        for (const [category, items] of Object.entries(grouped)) {
            const catDef = categories[category] ?? {};
            const categoryBox = buildRecommendationCategorySection({
                category,
                catDef,
                items,
                translate: this.t.bind(this),
                getCollapsedState: (name) => this.getCategoryCollapsedState(name),
                setCollapsedState: (name, collapsed) => this.setCategoryCollapsedState(name, collapsed),
                createCard: (rec, children) => this.buildRecommendationCard(rec, children),
                pointerCursor: this.applyPointerCursor?.bind(this),
                fallbackCategoryName: this.formatCategoryName.bind(this),
                containerSpacing: 0,
                headerSpacing: 6,
                contentSpacing: 0,
                expandIconWidth: 10,
                containerClass: 'rec-category-box'
            });
            contentBox.pack_start(categoryBox, false, false, 0);
        }

        contentBox.show_all();
    };

    prototype.buildRecommendationCard = function(rec, children) {
        const status = this.getRecommendationStatus(rec);
        const isApplied = status.applied;

        const card = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        card.get_style_context().add_class('rec-card');

        const mainRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const toggleBtn = buildRecommendationToggleButton({
            isApplied,
            translate: this.t.bind(this),
            onRevert: () => {
                this.revertRecommendation(rec);
                this.loadRecommendations();
            },
            onApply: () => {
                this.applyRecommendation(rec);
                this.loadRecommendations();
            },
            pointerCursor: this.applyPointerCursor?.bind(this),
            width: 24,
            height: 24
        });
        mainRow.pack_start(toggleBtn, false, false, 0);

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 1
        });
        labelBox.set_hexpand(true);

        const labelValue = rec.labelKey ? (this.t(rec.labelKey) || rec.labelKey) : (rec.label || '');
        const labelText = rec.type === 'keybind'
            ? `${labelValue}  ->  ${rec.dispatcher}`
            : labelValue;

        const mainLabel = new Gtk.Label({
            label: labelText,
            halign: Gtk.Align.START
        });
        mainLabel.get_style_context().add_class('rec-label-main');
        labelBox.pack_start(mainLabel, false, false, 0);

        const desc = this.t(rec.description) || rec.defaultDescription || rec.description;
        applyOptionalSetters([[desc, (value) => mainLabel.set_tooltip_text(value), Boolean]]);

        const currentValue = this.getRecommendationCurrentValue(rec);
        const appendCurrentValueLabel = () => {
            const valueLabel = new Gtk.Label({
                label: currentValue,
                halign: Gtk.Align.START
            });
            valueLabel.get_style_context().add_class(rec.type === 'keybind' ? 'rec-dispatcher' : 'rec-value');
            labelBox.pack_start(valueLabel, false, false, 0);
        };
        currentValue && rec.type !== 'workspaceRule' && appendCurrentValueLabel();

        mainRow.pack_start(labelBox, true, true, 0);

        attachRecommendationDemoPreview(mainRow, rec.demoGif, {
            width: 90,
            height: 54,
            radius: 5
        });

        const actionsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4
        });

        const digBtn = new Gtk.Button({ label: 'DIG' });
        digBtn.get_style_context().add_class('rec-action-btn');
        digBtn.set_tooltip_text(this.t('DIG_TOOLTIP') || 'Duplicate to global settings');
        digBtn.connect('clicked', () => {
            this.duplicateRecommendationToGlobal(rec);
            this.loadRecommendations();
        });
        this.applyPointerCursor?.(digBtn);
        actionsBox.pack_start(digBtn, false, false, 0);

        mainRow.pack_end(actionsBox, false, false, 0);

        card.pack_start(mainRow, false, false, 0);

        (rec.type === 'workspaceRule' && Array.isArray(rec.workspaces))
            && card.pack_start(this.buildWorkspaceSelector(rec), false, false, 0);

        const appendChildrenSection = () => {
            const childrenBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 3
            });
            childrenBox.get_style_context().add_class('rec-children-box');

            for (const child of children) {
                const childCard = this.buildChildCard(child);
                childrenBox.pack_start(childCard, false, false, 0);
            }

            card.pack_start(childrenBox, false, false, 0);
        };
        children && children.length > 0 && appendChildrenSection();

        return card;
    };

    prototype.buildChildCard = function(rec) {
        return buildRecommendationChildCard({
            rec,
            isApplied: this.getRecommendationStatus(rec).applied,
            translate: this.t.bind(this),
            label: rec.labelKey ? (this.t(rec.labelKey) || rec.labelKey) : (rec.label || ''),
            description: this.t(rec.description) || rec.defaultDescription || rec.description,
            valueText: rec.defaultValue || '',
            rowSpacing: 6
        });
    };

    prototype.buildWorkspaceSelector = function(rec) {
        const enabledWs = this.getEnabledWorkspaces(rec);
        return buildRecommendationWorkspaceRow({
            workspaces: rec.workspaces || [],
            isWorkspaceEnabled: (ws) => enabledWs.includes(ws),
            onWorkspaceToggled: (ws, enabled) => {
                this.toggleWorkspaceRule(rec, ws, enabled);
                this.loadRecommendations();
            },
            pointerCursor: this.applyPointerCursor?.bind(this),
            rowSpacing: 3,
            rowClass: 'rec-ws-row'
        });
    };

    prototype.formatCategoryName = function(category) {
        return formatRecommendationCategoryName(category);
    };


    prototype.showRecommendationsHelp = function(relativeTo) {
        const popover = new Gtk.Popover();
        popover.set_relative_to(relativeTo);
        popover.set_position(Gtk.PositionType.BOTTOM);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12
        });

        const title = new Gtk.Label({
            label: this.t('RECOMMENDATIONS_HELP_TITLE') || 'About Recommendations',
            halign: Gtk.Align.START
        });
        applyLabelAttributes(title, { bold: true });
        box.pack_start(title, false, false, 0);

        const helpText = this.t('RECOMMENDATIONS_HELP_TEXT') ||
            'These are popular settings used by the community.\n\n' +
            '- Click the toggle to apply a recommendation\n' +
            '- Use DIG to copy settings to global (all themes)\n' +
            '- Child settings are applied automatically with parent\n\n' +
            'Recommendations include mouse controls and common Hyprland tweaks.';

        const text = new Gtk.Label({
            label: helpText,
            wrap: true,
            halign: Gtk.Align.START,
            max_width_chars: 40
        });
        box.pack_start(text, false, false, 0);

        popover.add(box);
        popover.show_all();
    };
}
