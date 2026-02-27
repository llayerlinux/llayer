import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import { ANIMATION, UI_SIZES, TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import {
    applyTemplate,
    createTemplatePath,
    getCachedTemplate
} from '../../../infrastructure/scripts/ScriptTemplateStore.js';

const PROGRESS_PHASE_KEYS = {
    downloading: 'DOWNLOAD_MSG',
    installing: 'INSTALLING_MSG',
    applying: 'APPLYING_MSG'
};

const GLOW_TEMPLATE_PATH = createTemplatePath('theme_item_glow.css');
const GLOW_LABEL_TEMPLATE_PATH = createTemplatePath('theme_item_glow_label.css');

function getGlowTemplate() {
    return getCachedTemplate(GLOW_TEMPLATE_PATH);
}

function getGlowLabelTemplate() {
    return getCachedTemplate(GLOW_LABEL_TEMPLATE_PATH);
}

function determineSnakeColor(edgeColor) {
    return edgeColor
        ? {
            r: edgeColor.r / 255,
            g: edgeColor.g / 255,
            b: edgeColor.b / 255
        }
        : {r: 0.3, g: 0.7, b: 1.0};
}

function clearGlowProvider(widget, providerKey, context) {
    widget?.[providerKey] && tryRun(context, () => {
        widget.get_style_context().remove_provider(widget[providerKey]);
        widget[providerKey] = null;
    });
}


function createBorderPointCalculator(width, height, borderRadius, inset) {
    let innerWidth = width - 2 * inset,
        innerHeight = height - 2 * inset,
        arcRadius = borderRadius - inset,
        cornerArc = (Math.PI / 2) * arcRadius;
    let perimeter = 2 * (innerWidth - 2 * borderRadius + 2 * inset) +
                    2 * (innerHeight - 2 * borderRadius + 2 * inset) +
                    4 * cornerArc;

    let topLen = innerWidth - 2 * (borderRadius - inset),
        rightCornerLen = cornerArc,
        rightLen = innerHeight - 2 * (borderRadius - inset),
        bottomLen = topLen,
        leftCornerLen = cornerArc,
        leftLen = rightLen;
    let segments = [
        {
            length: topLen,
            getPoint: (offset) => ({x: inset + borderRadius + offset, y: inset})
        },
        {
            length: rightCornerLen,
            getPoint: (offset) => {
                const angle = -Math.PI / 2 + offset / arcRadius;
                return {
                    x: width - inset - borderRadius + arcRadius * Math.cos(angle),
                    y: inset + borderRadius + arcRadius * Math.sin(angle)
                };
            }
        },
        {
            length: rightLen,
            getPoint: (offset) => ({x: width - inset, y: inset + borderRadius + offset})
        },
        {
            length: rightCornerLen,
            getPoint: (offset) => {
                const angle = offset / arcRadius;
                return {
                    x: width - inset - borderRadius + arcRadius * Math.cos(angle),
                    y: height - inset - borderRadius + arcRadius * Math.sin(angle)
                };
            }
        },
        {
            length: bottomLen,
            getPoint: (offset) => ({x: width - inset - borderRadius - offset, y: height - inset})
        },
        {
            length: leftCornerLen,
            getPoint: (offset) => {
                const angle = Math.PI / 2 + offset / arcRadius;
                return {
                    x: inset + borderRadius + arcRadius * Math.cos(angle),
                    y: height - inset - borderRadius + arcRadius * Math.sin(angle)
                };
            }
        },
        {
            length: leftLen,
            getPoint: (offset) => ({x: inset, y: height - inset - borderRadius - offset})
        },
        {
            length: leftCornerLen,
            getPoint: (offset) => {
                const angle = Math.PI + offset / arcRadius;
                return {
                    x: inset + borderRadius + arcRadius * Math.cos(angle),
                    y: inset + borderRadius + arcRadius * Math.sin(angle)
                };
            }
        }
    ];

    return {
        perimeter,
        getPoint(position) {
            let remaining = (((position % 1) + 1) % 1) * perimeter;
            for (const segment of segments) {
                if (remaining < segment.length) {
                    return segment.getPoint(remaining);
                }
                remaining -= segment.length;
            }
            return segments[segments.length - 1].getPoint(0);
        }
    };
}

class ThemeItemEffects {
    isWidgetAlive(widget) {
        return !!widget && widget._llayerDisposed !== true;
    }

    guardedWidgetCall(widget, operationName, callback) {
        return this.isWidgetAlive(widget) && tryRun(`ThemeItemEffects.${operationName}`, () => {
            callback(widget);
        });
    }

    removeAnimationSource(overlay) {
        overlay?._animationId && tryRun('ThemeItemEffects.removeAnimationSource', () => GLib.source_remove(overlay._animationId));
        overlay?._animationId && (overlay._animationId = null);
    }

    createInstallProgress() {
        const container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: UI_SIZES.DEFAULT_SPACING,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            visible: false
        });
        container.get_style_context().add_class('install-progress-overlay');
        container.get_style_context().add_class('install-progress-hidden');
        container.set_no_show_all(true);

        const bar = new Gtk.ProgressBar({
            width_request: UI_SIZES.PROGRESS_BAR_WIDTH,
            height_request: UI_SIZES.PROGRESS_BAR_HEIGHT,
            hexpand: false,
            vexpand: false
        });
        bar.set_show_text(false);
        bar.get_style_context().add_class('install-progress-bar');
        bar.set_no_show_all(true);

        const label = new Gtk.Label({label: this.t('DOWNLOAD_MSG'), halign: Gtk.Align.CENTER});
        label.get_style_context().add_class('installing-label');
        label.set_no_show_all(true);

        container.pack_start(bar, false, false, 0);
        container.pack_start(label, false, false, 0);
        return {container, bar, label};
    }

    createSnakeOverlay() {
        const overlay = new Gtk.DrawingArea();
        overlay.set_halign(Gtk.Align.FILL);
        overlay.set_valign(Gtk.Align.FILL);
        overlay.set_visible(false);
        overlay.set_no_show_all(true);

        overlay._snakePosition = 0;
        overlay._snakeSpeed = ANIMATION.SNAKE_SPEED;
        overlay._snakeLength = ANIMATION.SNAKE_LENGTH;
        overlay._snakeColor = {r: 0.4, g: 0.7, b: 1.0};
        overlay._animationId = null;
        overlay._isAnimating = false;

        overlay.connect('draw', (widget, cr) => {
            if (!overlay._isAnimating) return false;

            const width = widget.get_allocated_width(),
                  height = widget.get_allocated_height(),
                  lineWidth = ANIMATION.LINE_WIDTH,
                  inset = lineWidth / 2 + 1;

            const borderCalc = createBorderPointCalculator(width, height, ANIMATION.BORDER_RADIUS, inset),
                  {r, g, b} = overlay._snakeColor,
                  pos = overlay._snakePosition,
                  len = overlay._snakeLength;

            cr.setLineWidth(lineWidth);
            cr.setLineCap(1);

            for (let i = 0; i < ANIMATION.DRAW_SEGMENTS; i++) {
                const t1 = i / ANIMATION.DRAW_SEGMENTS,
                      t2 = (i + 1) / ANIMATION.DRAW_SEGMENTS,
                      pt1 = borderCalc.getPoint(pos + t1 * len),
                      pt2 = borderCalc.getPoint(pos + t2 * len);

                cr.setSourceRGBA(r, g, b, Math.sin(((t1 + t2) / 2) * Math.PI));
                cr.moveTo(pt1.x, pt1.y);
                cr.lineTo(pt2.x, pt2.y);
                cr.stroke();
            }

            cr.setLineWidth(lineWidth + 4);
            for (let i = 0; i < ANIMATION.GLOW_SEGMENTS; i++) {
                const t = i / ANIMATION.GLOW_SEGMENTS,
                      point = borderCalc.getPoint(pos + t * len);

                cr.setSourceRGBA(r, g, b, 0.3 * Math.sin(t * Math.PI));
                cr.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                cr.fill();
            }

            return false;
        });

        return overlay;
    }

    startSnakeAnimation(overlay, itemBox) {
        return (!overlay || overlay._isAnimating)
            ? undefined
            : (
                overlay._isAnimating = true,
                overlay.set_visible(true),
                overlay.set_no_show_all(false),
                overlay.show(),
                overlay._snakeColor = determineSnakeColor(itemBox?._iconWidget?._edgeColor),
                overlay._animationId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.ANIMATION_FRAME_MS, () => {
                    const hasParent = !!overlay?.get_parent?.();
                    const shouldStopAnimation = !overlay || !overlay._isAnimating || !hasParent;
                    return shouldStopAnimation
                        ? (overlay && overlay._isAnimating && !hasParent && (overlay._isAnimating = false, overlay._animationId = null), false)
                        : (() => {
                            const stepApplied = tryRun('ThemeItemEffects.startSnakeAnimation', () => {
                                overlay._snakePosition += overlay._snakeSpeed;
                                overlay._snakePosition >= 1 && (overlay._snakePosition -= 1);
                                overlay.queue_draw();
                            });
                            return stepApplied || (overlay._isAnimating = false, overlay._animationId = null, false);
                        })();
                })
            );
    }

    stopSnakeAnimation(overlay) {
        overlay && (overlay._isAnimating = false);
        overlay && this.removeAnimationSource(overlay);
        overlay && this.guardedWidgetCall(overlay, 'stopSnakeAnimation.setVisible', (widget) => {
            widget.set_visible(false);
            widget.set_no_show_all(true);
        });
    }

    applyCssProvider(widget, cssText, providerKey, operationName) {
        widget && cssText && tryRun(operationName, () => {
            const provider = new Gtk.CssProvider();
            provider.load_from_data(new TextEncoder().encode(cssText));
            widget.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
            widget[providerKey] = provider;
        });
    }

    applyDynamicGlow(itemBox) {
        const iconWidget = itemBox?._iconWidget,
              nameLabel = itemBox?._nameLabel,
              edgeColor = iconWidget?._edgeColor,
              glowTemplate = getGlowTemplate(),
              glowLabelTemplate = getGlowLabelTemplate();
        if (!(edgeColor && iconWidget && glowTemplate && glowLabelTemplate)) return;

        const {r, g, b} = edgeColor,
              templateVars = { R: r, G: g, B: b };

        this.applyCssProvider(
            iconWidget,
            applyTemplate(glowTemplate, templateVars),
            '_glowProvider',
            'applyDynamicGlow.icon'
        );
        nameLabel && this.applyCssProvider(
            nameLabel,
            applyTemplate(glowLabelTemplate, templateVars),
            '_glowProvider',
            'applyDynamicGlow.label'
        );
    }

    removeDynamicGlow(itemBox) {
        clearGlowProvider(itemBox?._iconWidget, '_glowProvider', 'removeDynamicGlow.icon');
        clearGlowProvider(itemBox?._nameLabel, '_glowProvider', 'removeDynamicGlow.label');
    }

    showProgress(container, bar, label, itemBox, phase = 'downloading') {
        if (phase === 'applying') {
            this.guardedWidgetCall(container, 'showProgress.applying.hideContainer', (widget) => {
                widget.set_visible(false);
                widget.set_no_show_all(true);
            });

            const snakeOverlay = itemBox?._snakeOverlay;
            snakeOverlay && this.startSnakeAnimation(snakeOverlay, itemBox);
            this.guardedWidgetCall(itemBox, 'showProgress.applying.addClass', (widget) => {
                widget?.get_parent?.() && (
                    widget.get_style_context().remove_class('installing'),
                    widget.get_style_context().add_class('applying')
                );
            });
            return;
        }

        this.setProgressVisibility(container, bar, label, true);
        this.guardedWidgetCall(bar, 'showProgress.resetFraction', (widget) => widget.set_fraction(0));
        this.updateProgressLabel(label, phase);
        this.guardedWidgetCall(container, 'showProgress.showAll', (widget) => widget.show_all());
        this.guardedWidgetCall(itemBox, 'showProgress.installing.addClass', (widget) => {
            widget?.get_parent?.() && widget.get_style_context().add_class('installing');
        });
    }

    updateProgressLabel(label, phase) {
        const key = PROGRESS_PHASE_KEYS[phase] || PROGRESS_PHASE_KEYS.downloading;
        this.guardedWidgetCall(
            label,
            'updateProgressLabel',
            (widget) => widget.set_label(this.t(key) || phase.charAt(0).toUpperCase() + phase.slice(1) + '...')
        );
    }

    hideProgress(container, bar, label, itemBox) {
        const snakeOverlay = itemBox?._snakeOverlay;
        snakeOverlay && this.stopSnakeAnimation(snakeOverlay);

        this.guardedWidgetCall(container, 'hideProgress.hideClass', (widget) => {
            widget.get_style_context().add_class('install-progress-hidden');
        });
        this.setProgressVisibility(container, bar, label, false);
        this.guardedWidgetCall(itemBox, 'hideProgress.removeClasses', (widget) => {
            widget?.get_parent?.() && (
                widget.get_style_context().remove_class('installing'),
                widget.get_style_context().remove_class('applying')
            );
        });
    }

    setProgressVisibility(container, bar, label, visible) {
        const applyVisibility = (widget) => {
            widget.set_no_show_all(!visible);
            widget.set_visible(visible);
        };
        this.guardedWidgetCall(container, 'setProgressVisibility.container', applyVisibility);
        this.guardedWidgetCall(bar, 'setProgressVisibility.bar', applyVisibility);
        this.guardedWidgetCall(label, 'setProgressVisibility.label', applyVisibility);
    }
}

export function applyThemeItemEffects(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeItemEffects.prototype);
}
