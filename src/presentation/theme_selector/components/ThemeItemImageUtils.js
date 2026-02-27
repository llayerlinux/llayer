import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';
import { fileExists } from '../../../infrastructure/utils/Utils.js';

export function extractEdgeColor(pixbuf) {
    return pixbuf ? tryOrNull('ThemeItemImageUtils.extractEdgeColor', () => {
        const width = pixbuf.get_width(), height = pixbuf.get_height(),
            rowstride = pixbuf.get_rowstride(), channels = pixbuf.get_has_alpha() ? 4 : 3,
            pixels = pixbuf.get_pixels();

        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        function sampleAt(x, y) {
            let offset = y * rowstride + x * channels;
            totalR += pixels[offset];
            totalG += pixels[offset + 1];
            totalB += pixels[offset + 2];
            count++;
        }

        for (let x = 0; x < width; x += 4) sampleAt(x, 0);
        for (let x = 0; x < width; x += 4) sampleAt(x, height - 1);
        for (let y = 0; y < height; y += 4) sampleAt(0, y);
        for (let y = 0; y < height; y += 4) sampleAt(width - 1, y);

        if (count === 0) return null;

        const avgR = Math.round(totalR / count), avgG = Math.round(totalG / count),
            avgB = Math.round(totalB / count);
        const rNorm = avgR / 255, gNorm = avgG / 255, bNorm = avgB / 255,
            max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
        const hslBase = max !== min
            ? (() => {
                let d = max - min,
                    s = (max + min) / 2 > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                case rNorm:
                    return { h: ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6, s };
                case gNorm:
                    return { h: ((bNorm - rNorm) / d + 2) / 6, s };
                default:
                    return { h: ((rNorm - gNorm) / d + 4) / 6, s };
                }
            })()
            : { h: 0, s: 0 };

        const h = hslBase.h, sBoosted = Math.min(1, hslBase.s * 2.2),
            lAdjusted = Math.min(0.7, Math.max(0.35, ((max + min) / 2) * 1.15));

        function hue2rgb(p, q, t) {
            let normalized = t < 0 ? t + 1 : (t > 1 ? t - 1 : t);
            return normalized < 1 / 6
                ? p + (q - p) * 6 * normalized
                : normalized < 1 / 2
                    ? q
                    : normalized < 2 / 3
                        ? p + (q - p) * (2 / 3 - normalized) * 6
                        : p;
        }

        const rgb = sBoosted === 0
            ? (() => {
                let gray = Math.round(lAdjusted * 255);
                return { r: gray, g: gray, b: gray };
            })()
            : (() => {
                let q = lAdjusted < 0.5 ? lAdjusted * (1 + sBoosted) : lAdjusted + sBoosted - lAdjusted * sBoosted,
                    p = 2 * lAdjusted - q;
                return {
                    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
                    g: Math.round(hue2rgb(p, q, h) * 255),
                    b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
                };
            })();

        return {r: rgb.r, g: rgb.g, b: rgb.b, css: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`};
    }) : null;
}

export function getIconPath(theme, isInstalledTab, isNetworkTab, currentDir) {
    let home = GLib.get_home_dir(),
        defaultIcon = `${currentDir}/assets/default.png`,
        fallbackIcon = `${currentDir}/assets/no_preview.png`,
        localIcon = isInstalledTab
        ? [
            `${home}/.config/ags/assets/icons/${theme.name}.png`,
            `${home}/.config/themes/${theme.name}/preview.png`,
            `${home}/.config/themes/${theme.name}/preview.jpg`,
            `${home}/.config/themes/${theme.name}/preview.jpeg`,
            `${home}/.config/themes/${theme.name}/preview.webp`
        ].find(fileExists)
        : null;
    return theme.name === 'default'
        ? defaultIcon
        : (isInstalledTab ? (localIcon || fallbackIcon) : (theme.icon || fallbackIcon));
}

export function loadNetworkPreviewImage(theme, iconWidget, width, createIcon, loadNetworkPreview) {
    iconWidget.set_from_pixbuf(createIcon('image-x-generic-symbolic', 24)?.get_pixbuf?.());
    (theme.preview || theme.previewUrl) && setTimeout(() => loadNetworkPreview(theme, iconWidget, width, width), 100);
}

export function loadLocalPreviewImage(iconPath, iconWidget, width, currentDir, makeRoundedPixbuf, extractEdgeColorFn) {
    const tryLoad = (path) => fileExists(path) ? makeRoundedPixbuf(path, width, 12) : null,
          roundedPixbuf = tryLoad(iconPath) || tryLoad(`${currentDir}/assets/no_preview.png`);

    fileExists(iconPath) && (() => {
        const originalPixbuf = tryOrNull('ThemeItemImageUtils.loadLocalPreviewImage', () =>
            GdkPixbuf.Pixbuf.new_from_file(iconPath)
        );
        iconWidget._edgeColor = originalPixbuf ? extractEdgeColorFn(originalPixbuf) : null;
    })();

    roundedPixbuf ? iconWidget.set_from_pixbuf(roundedPixbuf) : iconWidget.set_from_icon_name('image-x-generic-symbolic', Gtk.IconSize.LARGE_TOOLBAR);
}
