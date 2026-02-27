import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { parseStringList } from '../../../infrastructure/utils/Utils.js';
import { THEME_PROPERTY_BADGES_BY_KEY } from '../../../infrastructure/constants/ThemeProperties.js';
import { addPointerCursor, applyOptionalSetters, createInlineLinkRow } from '../../common/ViewUtils.js';

function standardizePackageSupport(theme) {
    const support = theme?.packageSupport;
    return Array.isArray(support)
        ? support
        : (typeof support === 'string' ? support.split(',').map((item) => item.trim()).filter(Boolean) : []);
}

class ThemeContextMenuViewMetadataSections {
    openExternalUrl(url) {
        url && Gio.app_info_launch_default_for_uri(url.startsWith('http') ? url : `file://${url}`, null);
    }

    createAuthorsBox() {
        const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
        row.set_hexpand(true);

        const authorsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        authorsBox.get_style_context().add_class('authors-box');

        const authorName = this.menuData.author?.name || this.menuData.author?.label || this.translate('UNKNOWN');
        const authorUrl = this.menuData.author?.url || '';
        const adaptedName = this.menuData.adaptedBy?.name || this.menuData.adaptedBy?.label || '';
        const adaptedUrl = this.menuData.adaptedBy?.url || '';

        authorsBox.pack_start(
            createInlineLinkRow({
                labelText: this.translate('AUTHOR_LABEL') || this.translate('AUTHOR') || 'Author',
                valueText: authorName,
                url: authorUrl,
                cssClass: 'author-label',
                separator: ': '
            }),
            false,
            false,
            0
        );

        applyOptionalSetters([[
            adaptedName,
            (value) => authorsBox.pack_start(
                createInlineLinkRow({
                    labelText: this.translate('ADAPTED_BY_LABEL') || 'Adapted by',
                    valueText: value,
                    url: adaptedUrl,
                    cssClass: 'adapted-label',
                    separator: ' '
                }),
                false,
                false,
                0
            ),
            (value) => Boolean(value) && value !== 'unknown'
        ]]);

        row.pack_start(authorsBox, true, true, 0);

        return row;
    }

    createPropertiesHeader() {
        const propsTitleBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});

        const title = new Gtk.Label({label: this.translate('PROPERTIES_LABEL'), xalign: 0});
        title.get_style_context().add_class('pkg-title');
        title.set_margin_top(0);

        const helpBtn = new Gtk.Button();
        const helpIcon = new Gtk.Image();
        helpIcon.set_from_icon_name('dialog-information-symbolic', Gtk.IconSize.SMALL_TOOLBAR);
        helpBtn.set_image(helpIcon);
        helpBtn.get_style_context().add_class('circular');
        helpBtn.get_style_context().add_class('flat');
        helpBtn.set_tooltip_text(this.translate('PROPERTIES_HELP'));
        addPointerCursor(helpBtn);
        helpBtn.connect('clicked', () => this.controller?.showPropertiesHelp?.());

        propsTitleBox.pack_start(title, false, false, 0);
        propsTitleBox.pack_start(helpBtn, false, false, 0);
        return propsTitleBox;
    }

    createPropertiesBadges() {
        const propsBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        propsBox.get_style_context().add_class('props-box');

        let properties = this.menuData.properties?.badges ?? this.menuData.theme?.properties ?? {};
        properties = Array.isArray(properties)
            ? properties.reduce((acc, item) => (typeof item === 'string' && (acc[item] = true), acc), {})
            : properties;

        const addBadge = (label, cls) => {
            const l = new Gtk.Label({label});
            l.get_style_context().add_class(cls);
            l.set_size_request(20, 20);
            l.set_halign(Gtk.Align.START);
            l.set_valign(Gtk.Align.CENTER);

            const box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 0, height_request: 20});
            box.pack_start(l, false, false, 0);
            propsBox.pack_start(box, false, false, 0);
        };

        Object.entries(THEME_PROPERTY_BADGES_BY_KEY).forEach(([prop, badge]) => {
            applyOptionalSetters([[properties?.[prop], () => addBadge(badge.code, badge.accentClass), Boolean]]);
        });

        const showFallback = () => {
            const noneLabel = new Gtk.Label({label: this.translate('NOT_SPECIFIED')});
            noneLabel.get_style_context().add_class('prop-label-none');
            propsBox.pack_start(noneLabel, false, false, 0);
        };
        propsBox.get_children().length === 0 && showFallback();

        return propsBox;
    }

    createTagsSection() {
        let tags = parseStringList(this.menuData.tags ?? this.menuData.theme?.tags ?? []);
        if (tags.length === 0) return null;

        let title = new Gtk.Label({label: this.translate('TAGS'), xalign: 0}),
            tagsWrap = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6}),
            container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        title.get_style_context().add_class('pkg-title');
        title.set_margin_top(0);
        tags.forEach((tag) => {
            const tagLabel = new Gtk.Label({label: tag, xalign: 0});
            tagLabel.get_style_context().add_class('repo-tag');
            tagsWrap.pack_start(tagLabel, false, false, 0);
        });

        container.pack_start(title, false, false, 0);
        container.pack_start(tagsWrap, false, false, 0);
        return container;
    }

    createSupportSection() {
        let packageSupport = standardizePackageSupport(this.menuData?.theme);
        if (packageSupport.length === 0) {
            return null;
        }

        let supportBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2});

        let title = new Gtk.Label({label: this.translate('SUPPORT_LABEL'), xalign: 0});
        title.get_style_context().add_class('pkg-title');
        title.set_margin_top(0);
        title.set_margin_bottom(0);
        supportBox.pack_start(title, false, false, 0);

        let packages = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2});
        packages.get_style_context().add_class('pkg-list');
        packages.set_margin_top(0);
        packages.set_margin_bottom(0);

        let parsedPackages = packageSupport
            .map((pkgEntry) => this.parsePackageEntry(pkgEntry))
            .filter(Boolean);
        if (parsedPackages.length === 0) {
            return null;
        }
        parsedPackages.forEach((parsed) => {
            const mgBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
            mgBox.pack_start(this.createDistroIcon(parsed.distro, 16), false, false, 0);
            mgBox.pack_start(
                new Gtk.Label({label: `${parsed.managers} (${parsed.distroName})`, xalign: 0}),
                true,
                true,
                0
            );
            packages.pack_start(mgBox, false, false, 0);
        });

        supportBox.pack_start(packages, false, false, 0);
        return supportBox;
    }

    createReconstructionScriptSection() {
        const theme = this.menuData?.theme;
        const isNetwork = this.menuData?.isNetwork;
        const localPath = isNetwork ? null : this.getLocalThemePath(theme);
        const scriptExists = localPath && GLib.file_test(`${localPath}/reconstruction.sh`, GLib.FileTest.EXISTS);
        return scriptExists
            ? (() => {
                const container = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 2,
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.START
                });
                container.get_style_context().add_class('reconstruction-script-section');

        const topRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.END
        });

        const checkIcon = new Gtk.DrawingArea();
        checkIcon.set_size_request(14, 14);
        checkIcon.set_valign(Gtk.Align.CENTER);

        checkIcon.connect('draw', (widget, cr) => {
            const size = 14;

            cr.setSourceRGB(0.2, 0.7, 0.3);
            cr.arc(size / 2, size / 2, size / 2 - 1, 0, 2 * Math.PI);
            cr.fill();

            cr.setSourceRGB(1, 1, 1);
            cr.setLineWidth(1.5);
            cr.moveTo(3, 7);
            cr.lineTo(6, 10);
            cr.lineTo(11, 4);
            cr.stroke();

            return false;
        });

        const label = new Gtk.Label({
            label: this.translate('RECONSTRUCTION_SCRIPT_AVAILABLE') || 'Reconstruction script available',
            xalign: 1
        });
        label.get_style_context().add_class('reconstruction-script-label');

        topRow.pack_start(checkIcon, false, false, 0);
        topRow.pack_start(label, false, false, 0);

        const applyRunBtn = new Gtk.Button();
        applyRunBtn.set_halign(Gtk.Align.END);
        const btnBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

        const playIcon = new Gtk.Label({ label: '\u25B6', use_markup: false });
        playIcon.get_style_context().add_class('apply-run-icon');

        btnBox.pack_start(playIcon, false, false, 0);
        btnBox.pack_start(
            new Gtk.Label({ label: this.translate('APPLY_AND_RUN') || 'Apply & Run', use_markup: false }),
            false,
            false,
            0
        );

        applyRunBtn.add(btnBox);
        applyRunBtn.get_style_context().add_class('apply-run-btn');
        addPointerCursor(applyRunBtn);

        applyRunBtn.connect('clicked', () => {
            this.controller?.applyWithReconstructionScript?.();
        });

        container.pack_start(topRow, false, false, 0);
        container.pack_start(applyRunBtn, false, false, 0);

                return container;
            })()
            : null;
    }
}

export function applyThemeContextMenuViewMetadataSections(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewMetadataSections.prototype);
}
