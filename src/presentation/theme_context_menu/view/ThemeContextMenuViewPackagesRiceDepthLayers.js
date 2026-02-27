import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import { ensureArray, isPlainObject } from '../../../infrastructure/utils/Utils.js';

class ThemeContextMenuViewPackagesRiceDepthLayers {
    standardizeStringList(values) {
        return ensureArray(values)
            .map((item) => String(item ?? '').trim())
            .filter(Boolean);
    }

    translateWithFallback(key, fallback) {
        const translated = this.translate(key);
        return (typeof translated === 'string' && translated.trim().length > 0) ? translated : fallback;
    }

    getRiceLayerItems() {
        const menuData = isPlainObject(this.menuData) ? this.menuData : {};
        const packagesData = isPlainObject(menuData.packages) ? menuData.packages : {};
        const themeData = isPlainObject(menuData.theme) ? menuData.theme : {};
        const packageSource = ensureArray(packagesData.supported);
        const themePackageSource = ensureArray(themeData.packageSupport);
        const packages = this.standardizeStringList(packageSource.length > 0 ? packageSource : themePackageSource);
        const fallbackCandidates = this.getFallbackLayerCandidates();
        const candidates = packages.length > 0 ? packages : fallbackCandidates,
              lower = candidates.map(item => item.toLowerCase()),
              used = new Set();

        const findMatch = (patterns) => {
            const matchIndex = lower.findIndex((value, index) =>
                !used.has(index)
                && patterns.some((pattern) => {
                    const needle = typeof pattern === 'string' ? pattern : pattern.needle;
                    return Boolean(needle && value.includes(needle));
                })
            ),  matchValue = matchIndex >= 0 ? lower[matchIndex] : '',
                matchedPattern = matchIndex >= 0
                    ? patterns.find((pattern) => {
                        const needle = typeof pattern === 'string' ? pattern : pattern.needle;
                        return Boolean(needle && matchValue.includes(needle));
                    })
                    : null;
            matchIndex >= 0 && used.add(matchIndex);
            return matchIndex >= 0 ? (matchedPattern?.label || candidates[matchIndex]) : null;
        };

        const layerDefs = [
            {
                code: 'LAUNCH',
                patterns: [
                    {needle: 'rofi', label: 'Rofi'},
                    {needle: 'wofi', label: 'Wofi'},
                    {needle: 'fuzzel', label: 'Fuzzel'},
                    {needle: 'bemenu', label: 'Bemenu'},
                    {needle: 'dmenu', label: 'dmenu'},
                    {needle: 'tofi', label: 'Tofi'},
                    {needle: 'anyrun', label: 'Anyrun'},
                    {needle: 'launcher', label: 'Launcher'}
                ],
                cssClass: 'rice-layer-surface'
            },
            {
                code: 'BAR',
                patterns: [
                    {needle: 'waybar', label: 'Waybar'},
                    {needle: 'polybar', label: 'Polybar'},
                    {needle: 'eww', label: 'Eww'},
                    {needle: 'ags', label: 'AGS'},
                    {needle: 'quickshell', label: 'Quickshell'},
                    {needle: 'ignis', label: 'Ignis'},
                    {needle: 'hyprpanel', label: 'Hyprpanel'},
                    {needle: 'swaybar', label: 'Swaybar'},
                    {needle: 'bar', label: 'Bar'}
                ],
                cssClass: 'rice-layer-shell'
            },
            {
                code: 'WM',
                patterns: [
                    {needle: 'hyprland', label: 'Hyprland'},
                    {needle: 'sway', label: 'Sway'},
                    {needle: 'i3', label: 'i3'},
                    {needle: 'kwin', label: 'KWin'},
                    {needle: 'gnome', label: 'GNOME Shell'},
                    {needle: 'wayfire', label: 'Wayfire'},
                    {needle: 'river', label: 'River'},
                    {needle: 'wayland', label: 'Wayland'},
                    {needle: 'xorg', label: 'Xorg'},
                    {needle: 'bspwm', label: 'bspwm'},
                    {needle: 'qtile', label: 'Qtile'},
                    {needle: 'awesome', label: 'Awesome'},
                    {needle: 'xmonad', label: 'Xmonad'}
                ],
                cssClass: 'rice-layer-wm'
            },
            {
                code: 'SERV',
                patterns: [
                    {needle: 'systemd', label: 'systemd'},
                    {needle: 'greetd', label: 'greetd'},
                    {needle: 'sddm', label: 'SDDM'},
                    {needle: 'gdm', label: 'GDM'},
                    {needle: 'lightdm', label: 'LightDM'},
                    {needle: 'ly', label: 'Ly'},
                    {needle: 'seatd', label: 'seatd'},
                    {needle: 'polkit', label: 'polkit'},
                    {needle: 'pipewire', label: 'PipeWire'},
                    {needle: 'pulseaudio', label: 'PulseAudio'},
                    {needle: 'grub', label: 'GRUB'},
                    {needle: 'plymouth', label: 'Plymouth'},
                    {needle: 'login', label: 'Login'}
                ],
                cssClass: 'rice-layer-core'
            }
        ];

        const placeholders = {
            LAUNCH: this.translateWithFallback('INCLUDES_PLACEHOLDER_LAUNCH', 'Launcher'),
            BAR: this.translateWithFallback('INCLUDES_PLACEHOLDER_BAR', 'Status bar'),
            WM: this.translateWithFallback('INCLUDES_PLACEHOLDER_WM', 'Compositor'),
            SERV: this.translateWithFallback('INCLUDES_PLACEHOLDER_SERV', 'System services')
        };

        return layerDefs.map((def) => {
            const match = findMatch(def.patterns);
            return {
                code: def.code,
                name: match || placeholders[def.code] || def.code,
                cssClass: def.cssClass
            };
        });
    }

    getFallbackLayerCandidates() {
        const candidates = [];
        const add = (value) => Array.isArray(value)
            ? value.forEach((item) => add(item))
            : (() => {
                const text = value == null ? '' : String(value).trim();
                text && candidates.push(text);
            })();

        const menuData = isPlainObject(this.menuData) ? this.menuData : {},
              themeData = isPlainObject(menuData.theme) ? menuData.theme : {},
              repository = isPlainObject(menuData.repository) ? menuData.repository : {},
              properties = isPlainObject(menuData.properties) ? menuData.properties : {},
              badges = isPlainObject(properties.badges) ? properties.badges : {};

        add(themeData.tags);
        add(themeData.description);
        add(themeData.displayName);
        add(repository.name);
        add(repository.description);
        add(Object.keys(badges));
        return candidates;
    }
}

export function applyThemeContextMenuViewPackagesRiceDepthLayers(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPackagesRiceDepthLayers.prototype);
}
