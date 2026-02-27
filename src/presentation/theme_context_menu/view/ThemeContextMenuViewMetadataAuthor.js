import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';
import { addPointerCursor } from '../../common/ViewUtils.js';
import { isPlainObject, parseStringList, toNonNegativeInt } from '../../../infrastructure/utils/Utils.js';
import { createLightningIcon } from './ThemeContextMenuViewIconFactory.js';

class ThemeContextMenuViewMetadataAuthor {
    getContainerService(name) {
        const container = isPlainObject(this.controller?.container) ? this.controller.container : null;
        const canGetService = container && typeof container.get === 'function';
        const hasRequestedService = typeof container?.has !== 'function' || container.has(name);
        return canGetService && hasRequestedService ? container.get(name) : null;
    }

    pickAuthorName(author) {
        if (typeof author === 'string') {
            return author;
        }
        const authorObject = isPlainObject(author) ? author : null;
        return authorObject
            ? [authorObject.name, authorObject.label].find((value) =>
            typeof value === 'string' && value.trim()
        ) || null
            : null;
    }

    createMoreFromAuthorSection() {
        let menuData = isPlainObject(this.menuData) ? this.menuData : {},
            authorName = this.pickAuthorName(menuData.author),
            normalizedAuthorName = authorName?.trim?.().toLowerCase?.();
        if (!normalizedAuthorName || normalizedAuthorName === 'unknown') {
            return null;
        }

        let authorThemes = this.getAuthorThemes(authorName);
        if (authorThemes.length === 0) {
            return null;
        }

        let container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8
        });
        container.get_style_context().add_class('more-from-author');

        let headerBtn = new Gtk.Button();
        headerBtn.get_style_context().add_class('flat');
        headerBtn.get_style_context().add_class('more-from-header');

        let headerBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        headerBox.set_hexpand(true);

        let headerLabel = new Gtk.Label({
            label: `${this.translate('MORE_FROM') || 'More from'} ${authorName.trim()}`,
            use_markup: false,
            xalign: 0,
            hexpand: true
        });
        headerLabel.get_style_context().add_class('more-from-title');

        let chevronIcon = new Gtk.Image();
        chevronIcon.set_from_icon_name('pan-down-symbolic', Gtk.IconSize.SMALL_TOOLBAR);

        headerBox.pack_start(headerLabel, true, true, 0);
        headerBox.pack_end(chevronIcon, false, false, 0);

        headerBtn.add(headerBox);
        addPointerCursor(headerBtn);

        let scrollWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.NEVER
        });
        scrollWindow.set_propagate_natural_width(true);

        let contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            homogeneous: false
        });
        contentBox.get_style_context().add_class('more-from-content');

        authorThemes.slice(0, 3).forEach(theme => {
            const card = this.createAuthorThemeCard(theme);
            contentBox.pack_start(card, false, false, 0);
        });

        scrollWindow.add(contentBox);

        let isExpanded = true;
        headerBtn.connect('clicked', () => {
            isExpanded = !isExpanded;
            scrollWindow.set_visible(isExpanded);
            chevronIcon.set_from_icon_name(
                isExpanded ? 'pan-down-symbolic' : 'pan-end-symbolic',
                Gtk.IconSize.SMALL_TOOLBAR
            );
        });

        container.pack_start(headerBtn, false, false, 0);
        container.pack_start(scrollWindow, false, false, 0);

        return container;
    }


    createAuthorThemeCard(theme) {
        const wrapper = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            hexpand: false,
            halign: Gtk.Align.START
        });

        const card = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            hexpand: false
        });
        card.get_style_context().add_class('author-theme-card');
        card.set_valign(Gtk.Align.CENTER);

        const { level, levelData } = this.detectRiceDepthForTheme(theme);

        const cylinderStack = new Gtk.Stack();
        cylinderStack.set_transition_type(Gtk.StackTransitionType.CROSSFADE);
        cylinderStack.set_transition_duration(200);
        cylinderStack.set_vhomogeneous(false);
        cylinderStack.set_hhomogeneous(false);

        let isExpanded = false;

        const doCollapse = () => {
            isExpanded && (isExpanded = false, cylinderStack.set_visible_child_name('mini'), this.adaptPopupSize(wrapper, cylinderStack));
        };

        const miniCylinder = this.createMiniCylinder(level, levelData);
        cylinderStack.add_named(miniCylinder, 'mini');

        const expandedDiagram = this.createExpandedCylinderDiagram(level, levelData, doCollapse);
        cylinderStack.add_named(expandedDiagram, 'expanded');

        cylinderStack.set_visible_child_name('mini');

        const cylinderEventBox = new Gtk.EventBox();
        cylinderEventBox.add(cylinderStack);
        addPointerCursor(cylinderEventBox);

        cylinderEventBox.connect('button-press-event', () => {
            !isExpanded && (isExpanded = true, cylinderStack.set_visible_child_name('expanded'), this.adaptPopupSize(wrapper, cylinderStack));
            return true;
        });

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            hexpand: false
        });

        const nameLabel = new Gtk.Label({
            label: theme.displayName || theme.name || 'Unknown',
            xalign: 0,
            ellipsize: Pango.EllipsizeMode.END,
            max_width_chars: 18
        });
        nameLabel.get_style_context().add_class('author-theme-name');
        textBox.pack_start(nameLabel, false, false, 0);

        const tags = parseStringList(theme.tags).slice(0, 2);
        tags.length > 0 && (() => {
            const tagsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
            tagsBox.get_style_context().add_class('author-theme-tags');
            tags.forEach(tag => {
                const tagLabel = new Gtk.Label({ label: tag });
                tagLabel.get_style_context().add_class('author-theme-tag');
                tagsBox.pack_start(tagLabel, false, false, 0);
            });
            textBox.pack_start(tagsBox, false, false, 0);
        })();

        const statsRow = this.createAuthorThemeStats(theme);
        statsRow && textBox.pack_start(statsRow, false, false, 0);

        const textEventBox = new Gtk.EventBox();
        textEventBox.set_hexpand(false);
        textEventBox.add(textBox);
        addPointerCursor(textEventBox);

        textEventBox.connect('button-press-event', () => {
            this.controller?.selectTheme?.(theme);
            return true;
        });

        card.pack_start(cylinderEventBox, false, false, 0);
        card.pack_start(textEventBox, false, false, 0);

        wrapper.pack_start(card, false, false, 0);

        return wrapper;
    }


    createAuthorThemeStats(theme) {
        let downloadCount = this.parseThemeDownloadCount(theme),
            applyMs = this.parseThemeApplyTime(theme);

        let statsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            hexpand: false
        });
        statsBox.get_style_context().add_class('author-theme-stats');

        let downloadsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        downloadsBox.set_valign(Gtk.Align.CENTER);
        let downloadIcon = Gtk.Image.new_from_icon_name('document-save-symbolic', Gtk.IconSize.SMALL_TOOLBAR);
        downloadIcon.set_pixel_size(12);
        downloadIcon.set_valign(Gtk.Align.CENTER);
        let downloadsLabel = new Gtk.Label({ label: String(downloadCount), xalign: 0 });
        downloadsLabel.get_style_context().add_class('author-theme-stat');
        downloadsLabel.set_valign(Gtk.Align.CENTER);
        downloadsBox.pack_start(downloadIcon, false, false, 0);
        downloadsBox.pack_start(downloadsLabel, false, false, 0);
        statsBox.pack_start(downloadsBox, false, false, 0);

        let applyBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        applyBox.set_valign(Gtk.Align.CENTER);
        let lightningIcon = this.createMiniLightningIcon(12);
        lightningIcon.set_valign(Gtk.Align.CENTER);
        let applyLabel = new Gtk.Label({
            label: applyMs > 0 ? this.formatApplyTime(applyMs) : '--',
            xalign: 0
        });
        applyLabel.get_style_context().add_class('author-theme-stat');
        applyLabel.set_valign(Gtk.Align.CENTER);
        applyBox.pack_start(lightningIcon, false, false, 0);
        applyBox.pack_start(applyLabel, false, false, 0);
        statsBox.pack_start(applyBox, false, false, 0);

        return statsBox;
    }


    createMiniLightningIcon(size = 12) {
        return createLightningIcon(size, [0.4, 0.8, 0.9], [0.25, 0.6, 0.8]);
    }


    parseThemeDownloadCount(theme) {
        return this.parseNonNegativeInteger(theme?.downloadCount);
    }


    parseThemeApplyTime(theme) {
        return this.parseNonNegativeInteger(theme?.averageApplyMs);
    }


    parseNonNegativeInteger(value) {
        return toNonNegativeInt(value);
    }


    formatApplyTime(durationMs) {
        return durationMs >= 1000
            ? (() => {
                const seconds = durationMs / 1000;
                return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;
            })()
            : `${Math.round(durationMs)}ms`;
    }


    getAuthorThemes(authorName) {
        if (!authorName) return [];

        let netCfg = this.getContainerService('settingsService')?.getNetworkThemeSettings?.() ?? null;
        netCfg = isPlainObject(netCfg) ? netCfg : {};
        let addr = typeof netCfg.serverAddress === 'string' ? netCfg.serverAddress : null;
        let cached = addr ? this.getContainerService('themeCacheService')?.loadFromCache?.(addr) : null;
        let allThemes = (isPlainObject(cached) && Array.isArray(cached.themes)) ? cached.themes : [];
        let menuThemeName = isPlainObject(this.menuData?.theme) ? this.menuData.theme.name : undefined;
        let lowerAuthor = authorName.toLowerCase().trim();

        return allThemes.filter((theme) =>
            theme.name !== menuThemeName
            && (theme.author?.name || theme.author?.label || theme.author)
            && String(theme.author?.name || theme.author?.label || theme.author).toLowerCase().trim() === lowerAuthor
        ).slice(0, 3);
    }

}

export function applyThemeContextMenuViewMetadataAuthor(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewMetadataAuthor.prototype);
}
