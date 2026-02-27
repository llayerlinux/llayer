import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import {getWebKit2} from './ThemeContextMenuTemplateUtils.js';
import { isPlainObject } from '../../../infrastructure/utils/Utils.js';
import {
    buildRiceIncludeLevelData,
    buildRiceLevelDataFromSearchText,
    collectRiceCandidate,
    getRiceLevelEntry
} from './ThemeContextMenuViewRiceDepthShared.js';

class ThemeContextMenuViewMetadataRiceDepth {
    detectRiceDepthForTheme(theme) {
        const themeData = isPlainObject(theme) ? theme : {},
              includes = isPlainObject(themeData.includes) ? themeData.includes : null;
        if (includes?.level !== undefined) {
            return {
                level: Number(includes.level) || 1,
                levelData: buildRiceIncludeLevelData(includes.levelData)
            };
        }

        const candidates = [],
              packages = isPlainObject(themeData.packages) ? themeData.packages : {};
        collectRiceCandidate(candidates, themeData.packageSupport, {walkObjects: true});
        collectRiceCandidate(candidates, packages.supported, {walkObjects: true});
        collectRiceCandidate(candidates, themeData.name, {walkObjects: true});
        collectRiceCandidate(candidates, themeData.displayName, {walkObjects: true});
        collectRiceCandidate(candidates, themeData.tags, {walkObjects: true});
        collectRiceCandidate(candidates, themeData.description, {walkObjects: true});
        collectRiceCandidate(candidates, themeData.repoUrl, {walkObjects: true});

        return buildRiceLevelDataFromSearchText(candidates.join(' '));
    }

    createMiniCylinder(level, levelData) {
        const geometry = {
            width: 50,
            height: 68,
            topPadding: 6,
            cylinderHeight: 60,
            segmentHeight: 60 / 6,
            ellipseRy: 5
        };
        const palette = {
            filledBase: {r: 0.20, g: 0.40, b: 0.60},
            filledLight: {r: 0.30, g: 0.55, b: 0.75},
            emptyBase: {r: 0.55, g: 0.58, b: 0.62},
            emptyLight: {r: 0.65, g: 0.68, b: 0.72},
            ring: {r: 0.12, g: 0.16, b: 0.20}
        };

        const cylinder = new Gtk.DrawingArea();
        cylinder.set_size_request(geometry.width, geometry.height);
        cylinder.get_style_context().add_class('author-theme-cylinder');

        cylinder.connect('draw', (widget, cr) => {
            const width = geometry.width;
            const cylinderHeight = geometry.cylinderHeight;

            for (let i = 0; i < 6; i++) {
                const lvl = i + 1;
                const levelEntry = getRiceLevelEntry(levelData, lvl);
                const filled = levelEntry?.filled === true;
                const segY = geometry.topPadding + cylinderHeight - (i + 1) * geometry.segmentHeight;

                const baseColor = filled ? palette.filledBase : palette.emptyBase;
                const lightColor = filled ? palette.filledLight : palette.emptyLight;

                cr.setSourceRGB(lightColor.r, lightColor.g, lightColor.b);
                cr.rectangle(0, segY, width * 0.35, geometry.segmentHeight);
                cr.fill();

                cr.setSourceRGB(baseColor.r, baseColor.g, baseColor.b);
                cr.rectangle(width * 0.35, segY, width * 0.35, geometry.segmentHeight);
                cr.fill();

                cr.setSourceRGB(baseColor.r * 0.7, baseColor.g * 0.7, baseColor.b * 0.7);
                cr.rectangle(width * 0.7, segY, width * 0.3, geometry.segmentHeight);
                cr.fill();

                cr.setSourceRGBA(1, 1, 1, filled ? 0.25 : 0.12);
                cr.rectangle(0, segY, 2, geometry.segmentHeight);
                cr.fill();

                cr.setSourceRGBA(0, 0, 0, 0.35);
                cr.rectangle(width - 2, segY, 2, geometry.segmentHeight);
                cr.fill();

                i < 5 && (() => {
                    cr.setSourceRGB(palette.ring.r, palette.ring.g, palette.ring.b);
                    cr.save();
                    cr.translate(width / 2, segY);
                    cr.scale(width / 2 + 1, geometry.ellipseRy * 0.6);
                    cr.arc(0, 0, 1, 0, 2 * Math.PI);
                    cr.restore();
                    cr.fill();
                })();
            }

            cr.setSourceRGB(0.45, 0.55, 0.65);
            cr.save();
            cr.translate(width / 2, geometry.topPadding);
            cr.scale(width / 2 + 1, geometry.ellipseRy);
            cr.arc(0, 0, 1, 0, 2 * Math.PI);
            cr.restore();
            cr.fill();

            cr.setSourceRGB(0.55, 0.65, 0.75);
            cr.save();
            cr.translate(width / 2 - 2, geometry.topPadding - 1);
            cr.scale(width / 2 - 5, geometry.ellipseRy - 2);
            cr.arc(0, 0, 1, 0, 2 * Math.PI);
            cr.restore();
            cr.fill();

            cr.setSourceRGB(palette.ring.r, palette.ring.g, palette.ring.b);
            cr.save();
            cr.translate(width / 2, geometry.topPadding + cylinderHeight);
            cr.scale(width / 2 + 1, geometry.ellipseRy);
            cr.arc(0, 0, 1, 0, 2 * Math.PI);
            cr.restore();
            cr.fill();

            return false;
        });

        return cylinder;
    }

    createExpandedCylinderDiagram(level, levelData, onCollapse) {
        const WebKit2 = getWebKit2();
        if (!WebKit2) {
            const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL }),
                  label = new Gtk.Label({ label: 'WebKit2 not available' });
            box.set_size_request(200, 130);
            label.get_style_context().add_class('dim-label');
            box.pack_start(label, true, true, 0);
            return box;
        }

        const webView = new WebKit2.WebView(),
              rgba = new Gdk.RGBA();
        webView.set_size_request(200, 130);
        rgba.parse('rgba(0,0,0,0)');
        webView.set_background_color(rgba);

        webView.get_settings().set_enable_javascript(true);

        webView.connect('decide-policy', (_wv, decision, decisionType) => {
            const uri = decision.get_navigation_action()?.get_request?.()?.get_uri?.();
            return (decisionType === WebKit2.PolicyDecisionType.NAVIGATION_ACTION && uri?.startsWith('collapse:'))
                ? (decision.ignore(), onCollapse?.(), true)
                : false;
        });

        webView.load_html(this.generateMini3DHTML(level, levelData), 'file:///');

        return webView;
    }

    generateMini3DHTML(level, levelData) {
        const labelsData = Array.from({ length: 6 }, (_, index) => index + 1)
            .map((lvl) => ({ lvl, data: getRiceLevelEntry(levelData, lvl) }))
            .filter(({ data }) => data?.filled)
            .map(({ lvl, data }) => ({
                level: lvl,
                code: typeof data.code === 'string' ? data.code : `L${lvl}`,
                name: typeof data.name === 'string' ? data.name : 'Unknown',
                filled: true
            }));

        const labelsJson = JSON.stringify(labelsData).replace(/<\/script>/gi, '<\\/script>');
        return this.renderMetadata3DTemplate(level, labelsJson);
    }

    adaptPopupSize(container, changedWidget) {
        if (!this.popup) {
            return;
        }
        const wasVisible = changedWidget?.get_visible?.() ?? true;

        const clearSizeRequests = (widget) => {
            let current = widget;
            while (current && current !== this.popup) {
                current.set_size_request?.(-1, -1);
                current = current.get_parent?.();
            }
        };

        clearSizeRequests(changedWidget);
        clearSizeRequests(container);

        const [currentX, currentY] = this.popup.get_position?.() || [0, 0];

        this.popup.set_resizable(true);
        this.popup.set_size_request(-1, -1);
        this.popup.set_default_size(-1, -1);

        this.popup.queue_resize?.();
        this.popup.show_all?.();
        this.popup.queue_draw?.();
        this.popup.resize?.(1, 1);

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            return this.popup
                ? (!wasVisible && changedWidget?.set_visible?.(false), this.popup.resize(320, 1), this.popup.move(currentX, currentY), GLib.SOURCE_REMOVE)
                : GLib.SOURCE_REMOVE;
        });
    }
}

export function applyThemeContextMenuViewMetadataRiceDepth(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewMetadataRiceDepth.prototype);
}
