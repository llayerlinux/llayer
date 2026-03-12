import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { SwayConfigParser } from '../converters/SwayConfigParser.js';
import { tryOrDefault } from '../utils/ErrorUtils.js';

export class StructureDetector {
    constructor(options = {}) {
        this.logger = options.logger || null;
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[StructureDetector] ${msg}`, ...args);
        }
    }

    detect(extractedPath) {
        const entries = this.listTopLevel(extractedPath);
        const allPaths = this.listAllPaths(extractedPath);

        if (this.hasFile(extractedPath, 'lastlayer-metadata.json') ||
            this.hasFile(extractedPath, 'unixvibe-metadata.json')) {
            if (this.hasDir(extractedPath, 'config') || this.hasDir(extractedPath, 'components')) {
                if (this.hasDir(extractedPath, 'hyprland')) {
                    return 'ALREADY_UNIFIED';
                }
            }
        }

        const swayConfig = SwayConfigParser.detectSwayConfig(extractedPath);
        if (swayConfig) {
            const hasHyprland = this.hasHyprlandConfig(extractedPath, allPaths);
            if (!hasHyprland) {
                this.log(`Detected Sway rice: ${swayConfig}`);
                return 'SWAY_RICE';
            }
        }

        if (this.hasDir(extractedPath, 'themes') &&
            (this.hasDir(extractedPath, 'configs') || this.hasDir(extractedPath, 'keybinds'))) {
            const themesPath = `${extractedPath}/themes`;
            const themeEntries = this.listTopLevel(themesPath);
            if (themeEntries.length > 0) {
                return 'HYPR_MULTI_PROFILE';
            }
        }

        if (this.hasPath(allPaths, '.config/hypr/') ||
            this.hasPath(allPaths, '.config/hyprland/')) {
            return 'XDG_DIRECT';
        }

        if (this.hasDir(extractedPath, 'config') ||
            this.hasDir(extractedPath, 'configs')) {
            return 'CONFIG_DIR';
        }

        if (this.hasDir(extractedPath, 'dots')) {
            return 'DOTS_DIR';
        }

        if (this.hasDir(extractedPath, 'modules')) {
            const modulesPath = `${extractedPath}/modules`;
            if (this.hasDir(modulesPath, 'hypr') || this.hasDir(modulesPath, 'hyprland')) {
                return 'MODULES_DIR';
            }
        }

        const namedProfile = this.detectNamedProfile(extractedPath, entries);
        if (namedProfile) {
            this.log(`Detected named profile: ${namedProfile}`);
            return 'NAMED_PROFILE';
        }

        if ((this.hasDir(extractedPath, 'hypr') || this.hasDir(extractedPath, 'hyprland')) &&
            !this.hasDir(extractedPath, '.config')) {
            return 'HYPR_ONLY';
        }

        if (this.hasPath(allPaths, 'home/') && this.hasPath(allPaths, '/.config/')) {
            return 'HOME_MIRROR';
        }

        if (this.hasDir(extractedPath, 'dotfiles')) {
            return 'DOTFILES_DIR';
        }

        const appFolders = ['waybar', 'rofi', 'dunst', 'kitty', 'foot', 'alacritty',
                           'eww', 'ags', 'mako', 'swaync', 'wofi', 'gtk-3.0', 'gtk-4.0',
                           'nwg-dock-hyprland'];
        const hasAppFolder = entries.some(e => appFolders.includes(e.toLowerCase()));
        if (hasAppFolder) {
            return 'FLAT_DOTS';
        }

        return 'FLAT_DOTS';
    }

    detectVariants(extractedPath) {
        const result = { hasVariants: false, variants: [], variantsPath: null, variantType: null };

        if (this.hasDir(extractedPath, 'themes')) {
            const themesPath = `${extractedPath}/themes`;
            const themeEntries = this.listTopLevel(themesPath);
            const validThemes = themeEntries.filter(name => {
                const themePath = `${themesPath}/${name}`;
                return GLib.file_test(themePath, GLib.FileTest.IS_DIR) &&
                       !name.startsWith('.');
            });

            if (validThemes.length > 1) {
                result.hasVariants = true;
                result.variants = validThemes;
                result.variantsPath = 'themes';
                result.variantType = 'THEME_DIRS';
                return result;
            }
        }

        const entries = this.listTopLevel(extractedPath);
        const themeConfFiles = entries.filter(name =>
            name.match(/^theme[_-][\w-]+\.conf$/) && name !== 'theme.conf'
        );

        if (themeConfFiles.length > 0) {
            result.hasVariants = true;
            result.variants = themeConfFiles.map(f =>
                f.replace(/^theme[_-]/, '').replace(/\.conf$/, '')
            );
            result.variantsPath = '.';
            result.variantType = 'THEME_CONFS';
            return result;
        }

        if (this.hasDir(extractedPath, 'hyprland/themes')) {
            const themesPath = `${extractedPath}/hyprland/themes`;
            const themeEntries = this.listTopLevel(themesPath);
            const validThemes = themeEntries.filter(name => {
                const themePath = `${themesPath}/${name}`;
                return GLib.file_test(themePath, GLib.FileTest.IS_DIR);
            });

            if (validThemes.length > 1) {
                result.hasVariants = true;
                result.variants = validThemes;
                result.variantsPath = 'hyprland/themes';
                result.variantType = 'HYPRLAND_THEMES';
                return result;
            }
        }

        return result;
    }

    getDetailedInfo(extractedPath) {
        const type = this.detect(extractedPath);
        const entries = this.listTopLevel(extractedPath);
        const allPaths = this.listAllPaths(extractedPath);
        const variantInfo = this.detectVariants(extractedPath);

        return {
            type,
            topLevelEntries: entries,
            hasHyprland: this.findHyprlandConfigs(extractedPath, allPaths).length > 0,
            hyprlandConfigs: this.findHyprlandConfigs(extractedPath, allPaths),
            hasWallpaper: this.findWallpapers(extractedPath, allPaths).length > 0,
            wallpapers: this.findWallpapers(extractedPath, allPaths),
            detectedApps: this.detectApps(extractedPath, allPaths),
            configRoot: this.findConfigRoot(extractedPath, type, allPaths),
            hasVariants: variantInfo.hasVariants,
            variants: variantInfo.variants,
            variantsPath: variantInfo.variantsPath,
            variantType: variantInfo.variantType
        };
    }

    listTopLevel(dirPath) {
        const entries = [];
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) return entries;

        return tryOrDefault('StructureDetector.listTopLevel', () => {
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null))) {
                entries.push(info.get_name());
            }
            enumerator.close(null);
            return entries;
        }, entries);
    }

    listAllPaths(dirPath, prefix = '') {
        const paths = [];
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) return paths;

        return tryOrDefault('StructureDetector.listAllPaths', () => {
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null))) {
                const name = info.get_name();
                const fullPath = prefix ? `${prefix}/${name}` : name;
                paths.push(fullPath);

                if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                    const subPaths = this.listAllPaths(`${dirPath}/${name}`, fullPath);
                    paths.push(...subPaths);
                }
            }
            enumerator.close(null);
            return paths;
        }, paths);
    }

    hasFile(dirPath, filename) {
        return GLib.file_test(`${dirPath}/${filename}`, GLib.FileTest.EXISTS);
    }

    hasDir(dirPath, dirname) {
        return GLib.file_test(`${dirPath}/${dirname}`, GLib.FileTest.IS_DIR);
    }

    hasPath(allPaths, pathPattern) {
        return allPaths.some(p => p.includes(pathPattern));
    }

    detectNamedProfile(extractedPath, entries) {
        const excludedNames = [
            'wallpaper', 'wallpapers', 'walls', 'images', 'screenshots', 'assets',
            'scripts', 'bin', 'tools', 'utils',
            '.git', '.github', '.vscode', 'node_modules',
            'dotman', 'chezmoi', 'yadm',
            'docs', 'doc', 'documentation',
            'test', 'tests', 'spec',
            'lib', 'src', 'build', 'dist',
        ];

        const wmConfigs = ['sway', 'hypr', 'hyprland', 'i3', 'bspwm', 'awesome', 'dwm', 'qtile'];
        const appConfigs = ['waybar', 'polybar', 'eww', 'ags', 'rofi', 'wofi', 'dunst', 'mako',
                          'kitty', 'foot', 'alacritty', 'wezterm', 'nvim', 'neovim', 'zsh', 'bash',
                          'nwg-dock-hyprland'];

        let bestProfile = null;
        let bestScore = 0;
        let bestProfileWithWM = null;
        let bestScoreWithWM = 0;
        let hasAnyWMProfile = false;

        for (const entry of entries) {
            const entryPath = `${extractedPath}/${entry}`;
            if (!GLib.file_test(entryPath, GLib.FileTest.IS_DIR)) continue;

            if (excludedNames.includes(entry.toLowerCase())) continue;

            if ([...wmConfigs, ...appConfigs].includes(entry.toLowerCase())) continue;

            const subEntries = this.listTopLevel(entryPath);
            let score = 0;
            let hasWM = false;

            for (const sub of subEntries) {
                const subLower = sub.toLowerCase();
                const isWM = wmConfigs.includes(subLower);
                hasWM ||= isWM;
                score += isWM ? 10 : (appConfigs.includes(subLower) ? 2 : 0);
            }

            if (!hasWM && score < 4) {
                continue;
            }

            if (hasWM) {
                hasAnyWMProfile = true;
                if (score > bestScoreWithWM) {
                    bestScoreWithWM = score;
                    bestProfileWithWM = entry;
                }
                continue;
            }

            if (!hasAnyWMProfile && score > bestScore) {
                bestScore = score;
                bestProfile = entry;
            }
        }

        return hasAnyWMProfile ? bestProfileWithWM : bestProfile;
    }

    getNamedProfilePath(extractedPath) {
        const entries = this.listTopLevel(extractedPath);
        const profileName = this.detectNamedProfile(extractedPath, entries);
        if (profileName) {
            return `${extractedPath}/${profileName}`;
        }
        return null;
    }

    findHyprlandConfigs(basePath, allPaths) {
        const configs = [];
        const patterns = ['hyprland.conf', 'hypr.conf'];

        for (const p of allPaths) {
            if (patterns.some(pat => p.endsWith(pat))) {
                configs.push(p);
            }
        }

        return configs;
    }

    findWallpapers(basePath, allPaths) {
        const wallpapers = [];
        const extensions = ['.png', '.jpg', '.jpeg', '.webp'];
        const keywords = ['wallpaper', 'wall', 'bg', 'background'];

        for (const p of allPaths) {
            const lower = p.toLowerCase();
            const hasExt = extensions.some(ext => lower.endsWith(ext));
            if (!hasExt) continue;

            const hasKeyword = keywords.some(kw => lower.includes(kw));
            const inWallpaperDir = lower.includes('/wallpaper') || lower.includes('/walls/');

            if (hasKeyword || inWallpaperDir) {
                wallpapers.push(p);
            }
        }

        return wallpapers;
    }

    detectApps(basePath, allPaths) {
        const apps = new Set();
        const appNames = ['waybar', 'rofi', 'dunst', 'kitty', 'foot', 'alacritty',
                         'eww', 'ags', 'ignis', 'mako', 'swaync', 'wofi', 'hyprlock', 'hypridle',
                         'swww', 'hyprpaper', 'cava', 'neofetch', 'fastfetch', 'btop',
                         'starship', 'fish', 'zsh', 'gtk-3.0', 'gtk-4.0', 'qt5ct', 'kvantum',
                         'ghostty', 'wezterm', 'nwg-look', 'nwg-displays', 'nwg-dock-hyprland'];

        for (const p of allPaths) {
            const lower = p.toLowerCase();
            for (const app of appNames) {
                if (lower.includes(`/${app}/`) || lower.includes(`/${app}.`)) {
                    apps.add(app);
                }
            }
        }

        return Array.from(apps);
    }

    findConfigRoot(basePath, type, allPaths) {
        switch (type) {
            case 'XDG_DIRECT':
                return `${basePath}/.config`;
            case 'CONFIG_DIR':
                if (this.hasDir(basePath, 'config')) return `${basePath}/config`;
                if (this.hasDir(basePath, 'configs')) return `${basePath}/configs`;
                return basePath;
            case 'DOTS_DIR':
                return `${basePath}/dots`;
            case 'MODULES_DIR':
                return `${basePath}/modules`;
            case 'HYPR_MULTI_PROFILE':
                if (this.hasDir(basePath, 'configs')) return `${basePath}/configs`;
                if (this.hasDir(basePath, 'dots')) return `${basePath}/dots`;
                return basePath;
            case 'HOME_MIRROR':
                for (const p of allPaths) {
                    if (p.match(/^home\/[^\/]+\/\.config$/)) {
                        return `${basePath}/${p}`;
                    }
                }
                return basePath;
            case 'DOTFILES_DIR':
                return `${basePath}/dotfiles`;
            case 'SWAY_RICE':
                if (this.hasDir(basePath, '.config/sway')) return `${basePath}/.config`;
                if (this.hasDir(basePath, 'config/sway')) return `${basePath}/config`;
                if (this.hasDir(basePath, 'base/sway')) return `${basePath}/base`;
                if (this.hasDir(basePath, 'dots/sway')) return `${basePath}/dots`;
                if (this.hasDir(basePath, 'sway')) return basePath;
                return basePath;
            default:
                return basePath;
        }
    }

    hasHyprlandConfig(basePath, allPaths) {
        const hyprPatterns = ['hyprland.conf', 'hypr.conf', 'hyprland/hyprland.conf'];

        for (const p of allPaths) {
            if (hyprPatterns.some(pat => p.endsWith(pat))) {
                return true;
            }
        }

        if (this.hasDir(basePath, 'hyprland') || this.hasDir(basePath, 'hypr')) {
            return true;
        }

        if (this.hasDir(basePath, '.config/hypr') || this.hasDir(basePath, '.config/hyprland')) {
            return true;
        }

        return false;
    }

    getSwayConfigPath(basePath) {
        return SwayConfigParser.detectSwayConfig(basePath);
    }

    static isSway(basePath) {
        return SwayConfigParser.detectSwayConfig(basePath) !== null;
    }
}
