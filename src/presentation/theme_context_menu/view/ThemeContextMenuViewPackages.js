import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import { TEMPLATE_DIR, applyTemplate, loadTemplate } from './ThemeContextMenuTemplateUtils.js';
import { applyThemeContextMenuViewPackagesRiceDepth } from './ThemeContextMenuViewPackagesRiceDepth.js';

import { DistributionService } from '../../../infrastructure/system/DistributionService.js';
import { DesktopShellService } from '../../../infrastructure/system/DesktopShellService.js';
import { addPointerCursor, applyOptionalSetters } from '../../common/ViewUtils.js';
import {
    DEFAULT_MANAGERS_BY_DISTRO,
    DISTRO_DISPLAY_NAMES,
    DISTRO_ICON_FILES,
    DISTRO_MATCH_KEYS,
    IGNORED_PACKAGE_NAMES,
    KNOWN_DISTRO_IDS,
    SUPPORTED_DISTRO_IDS
} from './ThemeContextMenuConstants.js';

class ThemeContextMenuViewPackages {
    getServiceFromContainer(field, serviceName, FallbackClass) {
        if (!this[field]) {
            const container = this.controller?.container;
            this[field] = container?.get?.(serviceName) ?? new FallbackClass();
        }
        return this[field];
    }

    getDistributionService() {
        return this.getServiceFromContainer('distributionService', 'distributionService', DistributionService);
    }

    getDesktopShellService() {
        return this.getServiceFromContainer('desktopShellService', 'desktopShellService', DesktopShellService);
    }

    getPackages3DTemplate() {
        this._packages3dTemplate ||= loadTemplate(
            GLib.build_filenamev([TEMPLATE_DIR, 'theme_context_menu_packages_3d.html'])
        );
        return this._packages3dTemplate;
    }

    renderPackages3DTemplate(level, labelsJson) {
        const template = this.getPackages3DTemplate();
        return template ? applyTemplate(template, {
            LEVEL: level,
            LABELS: labelsJson
        }) : '';
    }

    packIf(container, child, expand = false, fill = false, padding = 0) {
        return child ? (container.pack_start(child, expand, fill, padding), true) : false;
    }

    parsePackageEntry(entry) {
        const trimmed = entry.trim(),
              lower = trimmed.toLowerCase(),
              parts = trimmed.split('/').map((part) => part.trim()),
              [rawDistro, ...rest] = parts,
              managers = rest.join('/').trim(),
              distro = rawDistro.toLowerCase(),
              normalizedDistro = KNOWN_DISTRO_IDS.has(distro)
                  ? distro
                  : (KNOWN_DISTRO_IDS.has(managers.toLowerCase()) ? managers.toLowerCase() : null);
        if (!trimmed || IGNORED_PACKAGE_NAMES.includes(lower)) return null;
        if (parts.length === 1) {
            return KNOWN_DISTRO_IDS.has(lower)
                ? {
                    distro: lower,
                    managers: this.getDefaultManagersForDistro(lower),
                    distroName: this.getDistroDisplayName(lower)
                }
                : null;
        }
        if (!rawDistro || !managers || !normalizedDistro) return null;
        return {
            distro: normalizedDistro,
            managers: normalizedDistro === distro ? managers : rawDistro,
            distroName: this.getDistroDisplayName(normalizedDistro)
        };
    }

    getDistroDisplayName(distro) {
        return DISTRO_DISPLAY_NAMES[distro] || distro.charAt(0).toUpperCase() + distro.slice(1);
    }

    getDefaultManagersForDistro(distro) {
        return DEFAULT_MANAGERS_BY_DISTRO[distro] || this.translate('PACKAGE_MANAGER_DEFAULT');
    }

    detectCurrentDistribution() {
        return this.getDistributionService().detectCurrentDistribution(SUPPORTED_DISTRO_IDS, 'arch');
    }

    createDistroIcon(distro, size = 16) {
        const distroIcon = this.getDistributionIcon(distro);
        const image = new Gtk.Image();
        distroIcon.endsWith('.png')
            ? image.set_from_pixbuf(GdkPixbuf.Pixbuf.new_from_file_at_scale(distroIcon, size, size, true))
            : (
                image.set_from_icon_name(distroIcon, Gtk.IconSize.BUTTON),
                image.set_pixel_size(size)
            );
        return image;
    }

    getDistributionIcon(distro) {
        const full = DISTRO_ICON_FILES[distro.toLowerCase()]
            ? `${this.currentDir}/assets/distro_icons/512/${DISTRO_ICON_FILES[distro.toLowerCase()]}`
            : null;
        return full && GLib.file_test(full, GLib.FileTest.EXISTS) ? full : 'package-x-generic';
    }

    createConverterSection() {
        const localThemePath = this.getLocalThemePath(this.menuData.theme);
        const isUnavailableNetworkTheme = this.menuData.isNetwork
            && (!localThemePath || !Gio.File.new_for_path(localThemePath).query_exists(null));
        return isUnavailableNetworkTheme
            ? null
            : (() => {
                const infoBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8});
                infoBox.get_style_context().add_class('converter-info-box');

                const textLabel = new Gtk.Label({
                    label: this.translate('DISTRIBUTION_NOT_SUPPORTED_HINT'),
                    wrap: true,
                    use_markup: false,
                    xalign: 0
                });
                textLabel.get_style_context().add_class('converter-info-text');
                textLabel.set_max_width_chars(45);
                textLabel.set_width_chars(45);
                textLabel.set_line_wrap(true);
                textLabel.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
                infoBox.pack_start(textLabel, false, false, 0);

                const iconsBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
                iconsBox.set_margin_top(6);
                iconsBox.get_style_context().add_class('converter-actions-row');
                const actionsLabel = new Gtk.Label({label: this.translate('THEME_CONTEXT_ACTIONS_LABEL'), xalign: 0});
                actionsLabel.get_style_context().add_class('converter-info-text');
                actionsLabel.get_style_context().add_class('converter-actions-label');
                actionsLabel.get_style_context().add_class('dim');
                iconsBox.pack_start(actionsLabel, false, false, 0);

                const folderIcon = new Gtk.EventBox();
                const folderImage = Gtk.Image.new_from_icon_name('folder-symbolic', Gtk.IconSize.BUTTON);
                folderImage.get_style_context().add_class('converter-icon');
                folderImage.get_style_context().add_class('clickable');
                folderIcon.add(folderImage);
                folderIcon.set_tooltip_text(this.translate('OPEN_THEME_SCRIPTS_FOLDER_TOOLTIP'));

                addPointerCursor(folderIcon);

                folderIcon.connect('button-press-event', () => {
                    this.handleFolderClick();
                    return true;
                });

                iconsBox.pack_start(folderIcon, false, false, 0);

                infoBox.pack_start(iconsBox, false, false, 0);
                return infoBox;
            })();
    }

    handleFolderClick() {
        const themePath = this.getLocalThemePath(this.menuData.theme);
        themePath && (() => {
            const scriptsPath = `${themePath}/start-scripts`;
            const targetPath = Gio.File.new_for_path(scriptsPath).query_exists(null) ? scriptsPath : themePath;
            this.getDesktopShellService().open(targetPath);
        })();
    }

    createInstallScriptsSection() {
        const useNetworkData = this.menuData.useNetworkData;
        const installScripts = Array.isArray(this.menuData.theme?.installScripts) ? this.menuData.theme.installScripts : [];
        return (!useNetworkData || installScripts.length <= 1)
            ? new Gtk.Box()
            : (() => {
                const installScriptsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin_top: 12});

                const titleLabel = new Gtk.Label({
                    label: this.translate('INSTALL_SCRIPT_SELECTOR'),
                    xalign: 0,
                    margin_bottom: 4
                });
                titleLabel.get_style_context().add_class('pkg-title');

                installScriptsBox.pack_start(titleLabel, false, false, 0);
                installScriptsBox.pack_start(
                    this.createInstallScriptSelector(installScripts, installScripts[0], () => {}),
                    false,
                    false,
                    0
                );
                return installScriptsBox;
            })();
    }

    createInstallScriptSelector(installScripts, selectedScript, onScriptChanged) {
        const comboBox = new Gtk.ComboBoxText();

        installScripts.forEach(script => {
            comboBox.append(script, this.getInstallScriptLabel(script));
        });

        selectedScript && comboBox.set_active_id(selectedScript);

        comboBox.connect('changed', () => {
            const id = comboBox.get_active_id();
            id && onScriptChanged?.(id);
        });

        return comboBox;
    }

    getInstallScriptLabel(script) {
        const distro = this.extractDistributionFromFilename(script);
        return distro ? `${distro} install` : script;
    }

    extractDistributionFromFilename(filename) {
        const source = typeof filename === 'string' ? filename.toLowerCase() : '';
        const foundKey = DISTRO_MATCH_KEYS.find((key) => source.includes(key));
        return foundKey ? DISTRO_DISPLAY_NAMES[foundKey] : null;
    }

    createPropertiesSection() {
        const container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        container.set_hexpand(true);

        const reconstructionSection = this.createReconstructionScriptSection();

        const tagsRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
        tagsRow.set_hexpand(true);

        const tagsSection = this.createTagsSection();
        applyOptionalSetters([[
            tagsSection,
            (widget) => {
                widget.get_style_context().add_class('tags-section');
                widget.set_valign(Gtk.Align.CENTER);
                tagsRow.pack_start(widget, false, false, 0);
            }
        ]]);

        applyOptionalSetters([[
            reconstructionSection,
            (widget) => {
                widget.set_halign(Gtk.Align.END);
                widget.set_valign(Gtk.Align.CENTER);
                tagsRow.pack_end(widget, true, true, 0);
            }
        ]]);

        container.pack_start(tagsRow, false, false, 0);

        this.packIf(container, this.createPropertiesHeader(), false, false, 0);
        this.packIf(container, this.createPropertiesBadges(), false, false, 0);

        const includesDiagram = this.createIncludesDiagram();
        const stats = this.buildStatsCard(
            this.menuData && this.menuData.theme && typeof this.menuData.theme === 'object'
                ? this.menuData.theme
                : {}
        );

        const riceDepthRow = (includesDiagram || stats)
            ? new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, hexpand: true})
            : null;
        applyOptionalSetters([[
            includesDiagram,
            (widget) => {
                widget.set_valign(Gtk.Align.START);
                riceDepthRow?.pack_start(widget, false, false, 0);
            }
        ]]);
        applyOptionalSetters([[
            stats,
            (value) => {
                value.container.set_margin_top(26);
                value.container.set_margin_bottom(0);
                value.container.set_halign(Gtk.Align.START);
                value.container.set_valign(Gtk.Align.START);
                value.container.set_hexpand(false);
                riceDepthRow?.pack_start(value.container, false, false, 0);
                this.statsLabels = value.labels;
                this.loadStats(value.labels);
            }
        ]]);
        this.packIf(container, riceDepthRow, false, false, 0);

        const dottedLine = new Gtk.Box();
        dottedLine.set_size_request(-1, 1);
        dottedLine.set_hexpand(true);
        dottedLine.set_margin_top(6);
        dottedLine.set_margin_bottom(4);
        dottedLine.get_style_context().add_class('repo-includes-dots');
        container.pack_start(dottedLine, false, false, 0);

        this.packIf(container, this.createSupportSection(), false, false, 0);

        const converterSection = this.createConverterSection();
        applyOptionalSetters([[
            converterSection,
            (widget) => {
                widget.set_margin_top(10);
                this.packIf(container, widget, false, false, 0);
            }
        ]]);

        this.packIf(container, this.createMoreFromAuthorSection(), false, false, 0);

        const children = container.get_children ? container.get_children() : [];
        return children && children.length > 0 ? container : null;
    }
}

export function applyThemeContextMenuViewPackages(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPackages.prototype);
}

applyThemeContextMenuViewPackagesRiceDepth(ThemeContextMenuViewPackages.prototype);
