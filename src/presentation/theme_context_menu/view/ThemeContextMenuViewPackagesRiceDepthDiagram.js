import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { addPointerCursor, applyLabelAttributes } from '../../common/ViewUtils.js';
import { getWebKit2 } from './ThemeContextMenuTemplateUtils.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';
import { isPlainObject } from '../../../infrastructure/utils/Utils.js';
import { showRiceDepthDetailsDialog } from './RiceDepthDetailsDialog.js';
import { getRiceLevelEntry } from './ThemeContextMenuViewRiceDepthShared.js';

class ThemeContextMenuViewPackagesRiceDepthDiagram {
    getThemeData() {
        return isPlainObject(this.menuData?.theme) ? this.menuData.theme : {};
    }

    createIncludesDiagram() {
        const { level, levelData } = this.determineIncludeLevels();

        const wrapper = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            hexpand: true
        });
        wrapper.get_style_context().add_class('repo-includes');

        const headerBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        const titleLabel = new Gtk.Label({
            label: this.translate('RICE_DEPTH_LABEL') || 'Includes (Depth)',
            halign: Gtk.Align.START,
            xalign: 0,
            hexpand: true
        });
        applyLabelAttributes(titleLabel, { bold: true });
        titleLabel.get_style_context().add_class('repo-includes-title');

        const detailsBtn = new Gtk.Button({ label: 'Details' });
        detailsBtn.get_style_context().add_class('theme-context-details-btn');
        detailsBtn.connect('clicked', () => this.showRiceDepthDetails(level, levelData));

        addPointerCursor(detailsBtn);

        headerBox.pack_start(titleLabel, true, true, 0);
        headerBox.pack_end(detailsBtn, false, false, 0);

        const WebKit2 = tryOrNull('getWebKit2', () => getWebKit2());

        let is3DMode = false;
        const diagramStack = new Gtk.Stack();
        diagramStack.set_transition_type(Gtk.StackTransitionType.CROSSFADE);
        diagramStack.set_transition_duration(200);

        diagramStack.add_named(this.createCylinderDrawing(level, levelData), '2d');

        const view3D = WebKit2
            ? tryOrNull(
                'createIncludesDiagram.3d',
                () => this.createWebKit3DDiagram(level, levelData, WebKit2)
            )
            : null;
        const has3D = Boolean(view3D);
        view3D && diagramStack.add_named(view3D, '3d');
        const add3DUnavailablePlaceholder = () => {
            const errorBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
            errorBox.set_size_request(300, 190);
            const errorLabel = new Gtk.Label({
                label: 'WebKit2 not installed\nInstall: webkit2gtk-4.1',
                justify: Gtk.Justification.CENTER,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            errorLabel.get_style_context().add_class('dim-label');
            errorBox.pack_start(errorLabel, true, true, 0);
            diagramStack.add_named(errorBox, '3d');
        };
        !has3D && add3DUnavailablePlaceholder();

        is3DMode = has3D;
        has3D
            ? GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                diagramStack.set_visible_child_name('3d');
                diagramStack.queue_resize?.();
                return GLib.SOURCE_REMOVE;
            })
            : diagramStack.set_visible_child_name('2d');

        const toggleBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });
        toggleBox.get_style_context().add_class('linked');
        toggleBox.set_halign(Gtk.Align.END);
        toggleBox.set_valign(Gtk.Align.END);
        toggleBox.set_margin_end(6);
        toggleBox.set_margin_bottom(6);

        const btn2D = new Gtk.Button({ label: '2D' });
        const btn3D = new Gtk.Button({ label: '3D' });
        btn3D.set_tooltip_text(WebKit2 ? 'Switch to 3D view' : 'WebKit2 not available');

        btn2D.get_style_context().add_class('theme-context-toggle-btn');
        btn3D.get_style_context().add_class('theme-context-toggle-btn');

        const setDiagramMode = (next3DMode) => {
            is3DMode !== next3DMode && (
                is3DMode = next3DMode,
                (() => {
                    const activeBtn = is3DMode ? btn3D : btn2D;
                    const inactiveBtn = is3DMode ? btn2D : btn3D;
                    activeBtn.get_style_context().add_class('active');
                    inactiveBtn.get_style_context().remove_class('active');
                    diagramStack.set_visible_child_name(is3DMode ? '3d' : '2d');
                })()
            );
        };
        (is3DMode ? btn3D : btn2D).get_style_context().add_class('active');

        [btn2D, btn3D].forEach(addPointerCursor);

        toggleBox.pack_start(btn2D, false, false, 0);
        toggleBox.pack_start(btn3D, false, false, 0);

        btn2D.connect('clicked', () => setDiagramMode(false));
        btn3D.connect('clicked', () => setDiagramMode(true));

        const overlay = new Gtk.Overlay();
        overlay.add(diagramStack);
        overlay.add_overlay(toggleBox);

        wrapper.pack_start(headerBox, false, false, 0);
        wrapper.pack_start(overlay, false, false, 0);

        return wrapper;
    }

    createWebKit3DDiagram(level, levelData, WebKit2) {
        const webView = new WebKit2.WebView();
        webView.set_size_request(300, 200);

        const rgba = new Gdk.RGBA();
        rgba.parse('rgba(0,0,0,0)');
        webView.set_background_color(rgba);

        webView.get_settings().set_enable_javascript(true);
        webView.load_html(this.generate3DCylinderHTML(level, levelData), 'file:///');

        return webView;
    }

    generate3DCylinderHTML(level, levelData) {
        const labelsData = [];
        for (let lvl = 1; lvl <= 6; lvl++) {
            const data = getRiceLevelEntry(levelData, lvl);
            data?.filled && labelsData.push({
                level: lvl,
                code: data.code || `L${lvl}`,
                name: data.name || 'Unknown',
                filled: true
            });
        }

        return this.renderPackages3DTemplate(level, JSON.stringify(labelsData).replace(/<\/script>/gi, '<\\/script>'));
    }

    createCylinderDrawing(level, levelData) {
        const geometry = {
            width: 300,
            height: 190,
            cylinderWidth: 80,
            cylinderHeight: 130,
            x: 15,
            y: 10,
            segmentHeight: 130 / 6,
            ellipseRy: 10
        };
        const palette = {
            filledBase: {r: 0.20, g: 0.40, b: 0.60},
            filledLight: {r: 0.30, g: 0.55, b: 0.75},
            emptyBase: {r: 0.55, g: 0.58, b: 0.62},
            emptyLight: {r: 0.65, g: 0.68, b: 0.72},
            ring: {r: 0.12, g: 0.16, b: 0.20},
            textFilled: {r: 0.90, g: 0.94, b: 0.98},
            lineFilled: {r: 0.50, g: 0.70, b: 0.85}
        };

        const drawingArea = new Gtk.DrawingArea();
        drawingArea.set_size_request(geometry.width, geometry.height);

        drawingArea.connect('draw', (widget, cr) => {
            for (let i = 0; i < 6; i++) {
                const lvl = i + 1;
                const filled = getRiceLevelEntry(levelData, lvl)?.filled === true;
                const segY = geometry.y + geometry.cylinderHeight - (i + 1) * geometry.segmentHeight;

                const baseColor = filled ? palette.filledBase : palette.emptyBase;
                const lightColor = filled ? palette.filledLight : palette.emptyLight;

                cr.setSourceRGB(lightColor.r, lightColor.g, lightColor.b);
                cr.rectangle(geometry.x, segY, geometry.cylinderWidth * 0.35, geometry.segmentHeight);
                cr.fill();

                cr.setSourceRGB(baseColor.r, baseColor.g, baseColor.b);
                cr.rectangle(
                    geometry.x + geometry.cylinderWidth * 0.35,
                    segY,
                    geometry.cylinderWidth * 0.35,
                    geometry.segmentHeight
                );
                cr.fill();

                cr.setSourceRGB(baseColor.r * 0.7, baseColor.g * 0.7, baseColor.b * 0.7);
                cr.rectangle(
                    geometry.x + geometry.cylinderWidth * 0.7,
                    segY,
                    geometry.cylinderWidth * 0.3,
                    geometry.segmentHeight
                );
                cr.fill();

                cr.setSourceRGBA(1, 1, 1, filled ? 0.25 : 0.12);
                cr.rectangle(geometry.x, segY, 4, geometry.segmentHeight);
                cr.fill();

                cr.setSourceRGBA(0, 0, 0, 0.35);
                cr.rectangle(geometry.x + geometry.cylinderWidth - 4, segY, 4, geometry.segmentHeight);
                cr.fill();

                i < 5 && (
                    cr.setSourceRGB(palette.ring.r, palette.ring.g, palette.ring.b),
                    cr.save(),
                    cr.translate(geometry.x + geometry.cylinderWidth / 2, segY),
                    cr.scale(geometry.cylinderWidth / 2 + 2, geometry.ellipseRy * 0.7),
                    cr.arc(0, 0, 1, 0, 2 * Math.PI),
                    cr.restore(),
                    cr.fill()
                );
            }

            const topY = geometry.y;
            cr.setSourceRGB(0.45, 0.55, 0.65);
            cr.save();
            cr.translate(geometry.x + geometry.cylinderWidth / 2, topY);
            cr.scale(geometry.cylinderWidth / 2 + 2, geometry.ellipseRy);
            cr.arc(0, 0, 1, 0, 2 * Math.PI);
            cr.restore();
            cr.fill();

            cr.setSourceRGB(0.55, 0.65, 0.75);
            cr.save();
            cr.translate(geometry.x + geometry.cylinderWidth / 2 - 5, topY - 2);
            cr.scale(geometry.cylinderWidth / 2 - 10, geometry.ellipseRy - 3);
            cr.arc(0, 0, 1, 0, 2 * Math.PI);
            cr.restore();
            cr.fill();

            cr.setSourceRGB(palette.ring.r, palette.ring.g, palette.ring.b);
            cr.save();
            cr.translate(geometry.x + geometry.cylinderWidth / 2, geometry.y + geometry.cylinderHeight);
            cr.scale(geometry.cylinderWidth / 2 + 2, geometry.ellipseRy);
            cr.arc(0, 0, 1, 0, 2 * Math.PI);
            cr.restore();
            cr.fill();

            const labelX = geometry.x + geometry.cylinderWidth + 55;
            cr.setFontSize(11);

            for (let i = 0; i < 6; i++) {
                const lvl = i + 1;
                const data = getRiceLevelEntry(levelData, lvl);
                const filled = data?.filled === true;

                filled && (() => {
                    const segY = geometry.y + geometry.cylinderHeight - (i + 0.5) * geometry.segmentHeight;

                    const startX = geometry.x + geometry.cylinderWidth + 2;
                    const startY = segY;
                    const diagLen = 20;
                    const midY = startY - diagLen * 0.5;

                    cr.setSourceRGB(palette.lineFilled.r, palette.lineFilled.g, palette.lineFilled.b);
                    cr.setLineWidth(1.2);
                    cr.moveTo(startX, startY);
                    cr.lineTo(startX + diagLen, midY);
                    cr.lineTo(labelX - 8, midY);
                    cr.stroke();

                    cr.arc(startX, startY, 2.5, 0, 2 * Math.PI);
                    cr.fill();

                    cr.setSourceRGB(palette.textFilled.r, palette.textFilled.g, palette.textFilled.b);
                    cr.moveTo(labelX, midY + 4);
                    cr.showText(`${data.code}: ${data.name}`);
                })();
            }

            return false;
        });

        return drawingArea;
    }

    showRiceDepthDetails(level, levelData) {
        const theme = this.getThemeData();
        showRiceDepthDetailsDialog({
            level,
            levelData,
            themeName: theme.displayName || theme.name || 'Theme',
            themePath: this.getLocalThemePath(theme),
            parent: this.popup
        });
    }
}

export function applyThemeContextMenuViewPackagesRiceDepthDiagram(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPackagesRiceDepthDiagram.prototype);
}
