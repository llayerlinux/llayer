import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { StructureDetector } from './StructureDetector.js';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

const KNOWN_APP_DIRS = [
    'waybar', 'rofi', 'wofi', 'eww', 'ags', 'ignis', 'hyprpanel', 'nwg-dock-hyprland',
    'dunst', 'mako', 'swaync', 'swayosd',
    'kitty', 'foot', 'alacritty', 'ghostty', 'wezterm',
    'hyprlock', 'hypridle', 'hyprpaper', 'swww',
    'lf', 'yazi', 'ranger', 'nnn',
    'nvim', 'neovim', 'helix',
    'zellij', 'tmux',
    'cava', 'neofetch', 'fastfetch', 'btop', 'htop',
    'fish', 'zsh', 'starship', 'shell',
    'gtk-3.0', 'gtk-4.0', 'qt5ct', 'qt6ct', 'qt', 'kvantum', 'nwg-look', 'nwg-displays',
    'fontconfig',
    'vencord', 'vesktop',
    'picom', 'sway', 'i3', 'bspwm', 'mpv', 'zathura', 'bat',
];

const WALLPAPER_DIRS = new Set(['backgrounds', 'wallpapers', 'walls', 'wallpaper']);

export class StructureTransformer {
    constructor(options = {}) {
        this.logger = options.logger || null;
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[StructureTransformer] ${msg}`, ...args);
        }
    }

    transform(sourcePath, targetPath, structureType) {
        return tryOrDefault('StructureTransformer.transform', () => {
            const inPlace = sourcePath === targetPath;

            this.ensureDir(`${targetPath}/config`);
            this.ensureDir(`${targetPath}/hyprland`);
            this.ensureDir(`${targetPath}/hyprland/scripts`);
            this.ensureDir(`${targetPath}/start-scripts`);

            let detectedApps = [];

            if (structureType === 'ALREADY_UNIFIED') {
                if (inPlace) {
                    return { success: true, detectedApps: [] };
                }
                return this.copyUnified(sourcePath, targetPath);
            }

            switch (structureType) {
                case 'XDG_DIRECT':
                    detectedApps = this.transformXdgDirect(sourcePath, targetPath);
                    break;

                case 'CONFIG_DIR':
                    detectedApps = this.transformConfigDir(sourcePath, targetPath);
                    break;

                case 'DOTS_DIR':
                    detectedApps = this.transformDotsDir(sourcePath, targetPath);
                    break;

                case 'MODULES_DIR':
                    detectedApps = this.transformModulesDir(sourcePath, targetPath);
                    break;

                case 'HYPR_MULTI_PROFILE':
                    detectedApps = this.transformHyprMultiProfile(sourcePath, targetPath);
                    break;

                case 'HYPR_ONLY':
                    detectedApps = this.transformHyprOnly(sourcePath, targetPath);
                    break;

                case 'HOME_MIRROR':
                    detectedApps = this.transformHomeMirror(sourcePath, targetPath);
                    break;

                case 'DOTFILES_DIR':
                    detectedApps = this.transformDotfilesDir(sourcePath, targetPath);
                    break;

                case 'NAMED_PROFILE':
                    detectedApps = this.transformNamedProfile(sourcePath, targetPath);
                    break;

                case 'FLAT_DOTS':
                default:
                    detectedApps = this.transformFlatDots(sourcePath, targetPath);
                    break;
            }

            this.copyWallpapers(sourcePath, targetPath);

            this.copyExistingScripts(sourcePath, targetPath);

            return { success: true, detectedApps };
        }, { success: false, error: 'Structure transformation failed' });
    }

    transformXdgDirect(sourcePath, targetPath) {
        const detectedApps = [];

        const configDirs = [];

        const rootConfig = `${sourcePath}/.config`;
        if (GLib.file_test(rootConfig, GLib.FileTest.IS_DIR)) {
            configDirs.push(rootConfig);
        }

        const topLevelEntries = this.listDir(sourcePath);
        for (const entry of topLevelEntries) {
            const entryPath = `${sourcePath}/${entry}`;
            if (!GLib.file_test(entryPath, GLib.FileTest.IS_DIR)) continue;
            if (entry.startsWith('.')) continue;

            const nestedConfig = `${entryPath}/.config`;
            if (GLib.file_test(nestedConfig, GLib.FileTest.IS_DIR)) {
                configDirs.push(nestedConfig);
                this.log(`Found nested .config in category: ${entry}/`);
            }
        }

        if (configDirs.length === 0) {
            return detectedApps;
        }

        for (const configSrc of configDirs) {
            const entries = this.listDir(configSrc);

            for (const entry of entries) {
                const srcPath = `${configSrc}/${entry}`;
                const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

                if (!isDir) continue;

                if (entry === 'hypr' || entry === 'hyprland') {
                    this.copyDir(srcPath, `${targetPath}/hyprland`);
                    if (!detectedApps.includes('hyprland')) detectedApps.push('hyprland');
                } else {
                    const destPath = `${targetPath}/config/${entry}`;
                    if (!GLib.file_test(destPath, GLib.FileTest.IS_DIR)) {
                        this.copyDir(srcPath, destPath);
                    }
                    if (!detectedApps.includes(entry)) detectedApps.push(entry);
                }
            }
        }

        return detectedApps;
    }

    transformConfigDir(sourcePath, targetPath) {
        let configSrc = `${sourcePath}/config`;
        if (!GLib.file_test(configSrc, GLib.FileTest.IS_DIR)) {
            configSrc = `${sourcePath}/configs`;
        }

        const detectedApps = [];

        if (!GLib.file_test(configSrc, GLib.FileTest.IS_DIR)) {
            return this.transformFlatDots(sourcePath, targetPath);
        }

        const entries = this.listDir(configSrc);

        for (const entry of entries) {
            const srcPath = `${configSrc}/${entry}`;
            const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

            if (!isDir) continue;

            if (entry === 'hypr' || entry === 'hyprland') {
                this.copyDir(srcPath, `${targetPath}/hyprland`);
                detectedApps.push('hyprland');
            } else {
                this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                detectedApps.push(entry);
            }
        }

        if (GLib.file_test(`${sourcePath}/hypr`, GLib.FileTest.IS_DIR)) {
            this.copyDir(`${sourcePath}/hypr`, `${targetPath}/hyprland`);
            if (!detectedApps.includes('hyprland')) detectedApps.push('hyprland');
        }

        return detectedApps;
    }

    transformDotsDir(sourcePath, targetPath) {
        const dotsSrc = `${sourcePath}/dots`;
        const detectedApps = [];

        if (!GLib.file_test(dotsSrc, GLib.FileTest.IS_DIR)) {
            return this.transformFlatDots(sourcePath, targetPath);
        }

        const entries = this.listDir(dotsSrc);

        for (const entry of entries) {
            const srcPath = `${dotsSrc}/${entry}`;
            const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

            if (!isDir) continue;

            if (entry === 'hypr' || entry === 'hyprland') {
                this.copyDir(srcPath, `${targetPath}/hyprland`);
                detectedApps.push('hyprland');
            } else {
                this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                detectedApps.push(entry);
            }
        }

        if (GLib.file_test(`${sourcePath}/hypr`, GLib.FileTest.IS_DIR)) {
            this.copyDir(`${sourcePath}/hypr`, `${targetPath}/hyprland`);
            if (!detectedApps.includes('hyprland')) detectedApps.push('hyprland');
        }

        return detectedApps;
    }

    transformModulesDir(sourcePath, targetPath) {
        const detectedApps = [];
        const modulesPath = `${sourcePath}/modules`;

        if (!GLib.file_test(modulesPath, GLib.FileTest.IS_DIR)) {
            return detectedApps;
        }

        const entries = this.listDir(modulesPath);
        const appDirs = ['waybar', 'rofi', 'dunst', 'kitty', 'foot', 'alacritty',
                        'eww', 'ags', 'mako', 'swaync', 'wofi', 'gtk-3.0', 'gtk-4.0',
                        'neofetch', 'fastfetch', 'cava', 'btop', 'nvim', 'neovim',
                        'fish', 'zsh', 'nushell', 'starship', 'zellij', 'tmux',
                        'quickshell', 'fabric', 'nwg-dock-hyprland'];

        for (const entry of entries) {
            const srcPath = `${modulesPath}/${entry}`;
            const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);
            const isFile = GLib.file_test(srcPath, GLib.FileTest.EXISTS) && !isDir;

            if (isDir && (entry === 'hypr' || entry === 'hyprland')) {
                this.copyDir(srcPath, `${targetPath}/hyprland`);
                detectedApps.push('hyprland');
                continue;
            }

            if (isDir && appDirs.some(app => entry.toLowerCase().includes(app))) {
                this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                detectedApps.push(entry);
                continue;
            }

            if (isFile) {
                const baseName = entry.replace(/\.(conf|toml|yaml|yml|json)$/, '');
                if (appDirs.some(app => baseName.toLowerCase().includes(app))) {
                    this.ensureDir(`${targetPath}/config/${baseName}`);
                    this.copyFile(srcPath, `${targetPath}/config/${baseName}/${entry}`);
                    detectedApps.push(baseName);
                }
            }
        }

        if (GLib.file_test(`${sourcePath}/scripts`, GLib.FileTest.IS_DIR)) {
            this.ensureDir(`${targetPath}/start-scripts`);
            const scripts = this.listDir(`${sourcePath}/scripts`);
            for (const script of scripts) {
                const srcScript = `${sourcePath}/scripts/${script}`;
                if (GLib.file_test(srcScript, GLib.FileTest.EXISTS) &&
                    !GLib.file_test(srcScript, GLib.FileTest.IS_DIR)) {
                    this.copyFile(srcScript, `${targetPath}/start-scripts/${script}`);
                }
            }
        }

        if (GLib.file_test(`${sourcePath}/install.sh`, GLib.FileTest.EXISTS)) {
            this.ensureDir(`${targetPath}/start-scripts`);
            this.copyFile(`${sourcePath}/install.sh`, `${targetPath}/start-scripts/original_install.sh`);
        }

        return detectedApps;
    }

    transformHyprMultiProfile(sourcePath, targetPath) {
        const detectedApps = [];
        const configSrc = [`${sourcePath}/configs`, `${sourcePath}/dots`]
            .find((path) => GLib.file_test(path, GLib.FileTest.IS_DIR)) || null;

        if (configSrc) {
            const entries = this.listDir(configSrc);
            for (const entry of entries) {
                const srcPath = `${configSrc}/${entry}`;
                const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

                if (!isDir) continue;

                if (entry === 'hypr' || entry === 'hyprland') {
                    this.copyDir(srcPath, `${targetPath}/hyprland`);
                    detectedApps.push('hyprland');
                } else {
                    this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                    detectedApps.push(entry);
                }
            }
        }

        if (GLib.file_test(`${sourcePath}/keybinds`, GLib.FileTest.IS_DIR)) {
            this.copyDir(`${sourcePath}/keybinds`, `${targetPath}/hyprland/keybinds`);
        }

        const themesPath = `${sourcePath}/themes`;
        if (GLib.file_test(themesPath, GLib.FileTest.IS_DIR)) {
            const themeEntries = this.listDir(themesPath);
            const validThemes = themeEntries.filter(name => {
                const themePath = `${themesPath}/${name}`;
                return GLib.file_test(themePath, GLib.FileTest.IS_DIR) && !name.startsWith('.');
            });

            if (validThemes.length > 0) {
                this.ensureDir(`${targetPath}/variants`);

                for (const themeName of validThemes) {
                    const themeDir = `${themesPath}/${themeName}`;
                    const variantDir = `${targetPath}/variants/${themeName}`;
                    this.ensureDir(variantDir);

                    this.copyDir(themeDir, variantDir);

                    const wallpaperCandidates = ['wallpaper.png', 'wallpaper.jpg', 'wall.png', 'wall.jpg', 'bg.png', 'bg.jpg'];
                    for (const wp of wallpaperCandidates) {
                        if (GLib.file_test(`${themeDir}/${wp}`, GLib.FileTest.EXISTS)) {
                            const ext = wp.split('.').pop();
                            this.copyFile(`${themeDir}/${wp}`, `${variantDir}/wallpaper.${ext}`);
                            break;
                        }
                    }
                }

                const defaultTheme = validThemes[0];
                const defaultVariantDir = `${targetPath}/variants/${defaultTheme}`;
                const defaultWallpapers = ['wallpaper.png', 'wallpaper.jpg', 'wallpaper.jpeg', 'wallpaper.webp'];
                for (const wp of defaultWallpapers) {
                    if (GLib.file_test(`${defaultVariantDir}/${wp}`, GLib.FileTest.EXISTS)) {
                        this.copyFile(`${defaultVariantDir}/${wp}`, `${targetPath}/${wp}`);
                        break;
                    }
                }
            }
        }

        if (GLib.file_test(`${sourcePath}/hypr`, GLib.FileTest.IS_DIR)) {
            this.copyDir(`${sourcePath}/hypr`, `${targetPath}/hyprland`);
            if (!detectedApps.includes('hyprland')) detectedApps.push('hyprland');
        }

        const rootHyprConfigs = ['_hyprland.conf', 'hyprland.conf'];
        for (const confName of rootHyprConfigs) {
            const confPath = `${sourcePath}/${confName}`;
            if (GLib.file_test(confPath, GLib.FileTest.EXISTS) &&
                !GLib.file_test(confPath, GLib.FileTest.IS_DIR)) {
                this.ensureDir(`${targetPath}/hyprland`);
                this.copyFile(confPath, `${targetPath}/hyprland/hyprland.conf`);
                if (!detectedApps.includes('hyprland')) detectedApps.push('hyprland');
                break;
            }
        }

        if (GLib.file_test(`${sourcePath}/scripts`, GLib.FileTest.IS_DIR)) {
            this.ensureDir(`${targetPath}/start-scripts`);
            const scripts = this.listDir(`${sourcePath}/scripts`);
            for (const script of scripts) {
                const srcScript = `${sourcePath}/scripts/${script}`;
                if (GLib.file_test(srcScript, GLib.FileTest.EXISTS) &&
                    !GLib.file_test(srcScript, GLib.FileTest.IS_DIR)) {
                    this.copyFile(srcScript, `${targetPath}/start-scripts/${script}`);
                }
            }
        }

        return detectedApps;
    }

    transformHyprOnly(sourcePath, targetPath) {
        const detectedApps = ['hyprland'];
        const hyprDir = this.findHyprlandSourceDir(sourcePath);
        hyprDir && this.copyDir(hyprDir, `${targetPath}/hyprland`);

        const entries = this.listDir(sourcePath);

        for (const entry of entries) {
            const srcPath = `${sourcePath}/${entry}`;
            const lowerEntry = entry.toLowerCase();

            if (!GLib.file_test(srcPath, GLib.FileTest.IS_DIR)) continue;

            if (lowerEntry === 'hypr' || lowerEntry === 'hyprland') continue;

            this.copyFlatEntry(srcPath, entry, targetPath, detectedApps);
        }

        return detectedApps;
    }

    copyWallpaperFromDir(wallpaperDir, targetPath) {
        const targetWallpaper = `${targetPath}/wallpaper.png`;
        if (GLib.file_test(targetWallpaper, GLib.FileTest.EXISTS)) return;

        const entries = this.listDir(wallpaperDir);
        const imageExts = ['.png', '.jpg', '.jpeg', '.webp'];

        for (const entry of entries) {
            const ext = entry.toLowerCase().substring(entry.lastIndexOf('.'));
            if (imageExts.includes(ext)) {
                const srcImage = `${wallpaperDir}/${entry}`;
                this.copyFile(srcImage, targetWallpaper);
                this.log(`Copied wallpaper from ${srcImage}`);
                break;
            }
        }
    }

    transformHomeMirror(sourcePath, targetPath) {
        const homePath = `${sourcePath}/home`;
        const detectedApps = [];

        if (!GLib.file_test(homePath, GLib.FileTest.IS_DIR)) {
            return this.transformFlatDots(sourcePath, targetPath);
        }

        const users = this.listDir(homePath);
        for (const user of users) {
            const configPath = `${homePath}/${user}/.config`;
            if (GLib.file_test(configPath, GLib.FileTest.IS_DIR)) {
                const entries = this.listDir(configPath);

                for (const entry of entries) {
                    const srcPath = `${configPath}/${entry}`;
                    const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

                    if (!isDir) continue;

                    if (entry === 'hypr' || entry === 'hyprland') {
                        this.copyDir(srcPath, `${targetPath}/hyprland`);
                        detectedApps.push('hyprland');
                    } else {
                        this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                        detectedApps.push(entry);
                    }
                }
                break;
            }
        }

        return detectedApps;
    }

    transformDotfilesDir(sourcePath, targetPath) {
        const dotfilesPath = `${sourcePath}/dotfiles`;

        if (!GLib.file_test(dotfilesPath, GLib.FileTest.IS_DIR)) {
            return this.transformFlatDots(sourcePath, targetPath);
        }

        if (GLib.file_test(`${dotfilesPath}/.config`, GLib.FileTest.IS_DIR)) {
            return this.transformXdgDirect(dotfilesPath, targetPath);
        }

        if (GLib.file_test(`${dotfilesPath}/config`, GLib.FileTest.IS_DIR)) {
            return this.transformConfigDir(dotfilesPath, targetPath);
        }

        return this.transformFlatDots(dotfilesPath, targetPath);
    }

    transformNamedProfile(sourcePath, targetPath) {
        const detector = new StructureDetector({ logger: this.logger });
        const profilePath = detector.getNamedProfilePath(sourcePath);

        if (!profilePath) {
            this.log('Named profile not found, falling back to FLAT_DOTS');
            return this.transformFlatDots(sourcePath, targetPath);
        }

        this.log(`Transforming named profile: ${profilePath}`);

        const hyprlandExists = GLib.file_test(`${targetPath}/hyprland`, GLib.FileTest.IS_DIR);
        if (hyprlandExists) {
            this.log('hyprland/ exists (from Sway conversion), copying only app configs from profile');
            return this.copyAppConfigsFromProfile(profilePath, targetPath);
        }

        if (GLib.file_test(`${profilePath}/.config`, GLib.FileTest.IS_DIR)) {
            return this.transformXdgDirect(profilePath, targetPath);
        }

        if (GLib.file_test(`${profilePath}/config`, GLib.FileTest.IS_DIR)) {
            return this.transformConfigDir(profilePath, targetPath);
        }

        return this.transformFlatDots(profilePath, targetPath);
    }

    copyAppConfigsFromProfile(profilePath, targetPath) {
        const detectedApps = [];
        const entries = this.listDir(profilePath);

        const wmConfigs = ['sway', 'hypr', 'hyprland', 'i3', 'bspwm', 'awesome', 'dwm'];

        for (const entry of entries) {
            const srcPath = `${profilePath}/${entry}`;
            const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

            if (!isDir) continue;

            const lowerEntry = entry.toLowerCase();

            if (wmConfigs.includes(lowerEntry)) {
                this.log(`Skipping WM config: ${entry} (already converted)`);
                continue;
            }

            const copiedApp = this.copyFlatEntry(srcPath, entry, targetPath, detectedApps);
            if (copiedApp) {
                this.log(`Copied app config: ${entry}`);
            }
        }

        if (!detectedApps.includes('hyprland')) {
            detectedApps.push('hyprland');
        }

        return detectedApps;
    }

    transformFlatDots(sourcePath, targetPath) {
        const detectedApps = [];
        const entries = this.listDir(sourcePath);

        for (const entry of entries) {
            const srcPath = `${sourcePath}/${entry}`;
            const isDir = GLib.file_test(srcPath, GLib.FileTest.IS_DIR);

            if (!isDir) continue;

            const lowerEntry = entry.toLowerCase();

            switch (true) {
                case this.isHyprlandEntry(lowerEntry):
                    this.copyDir(srcPath, `${targetPath}/hyprland`);
                    detectedApps.push('hyprland');
                    break;
                case KNOWN_APP_DIRS.includes(lowerEntry):
                    this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                    detectedApps.push(entry);
                    break;
                case lowerEntry === '.config':
                    return this.transformXdgDirect(sourcePath, targetPath);
                default:
                    this.copyFlatEntry(srcPath, entry, targetPath, detectedApps);
                    break;
            }
        }

        if (GLib.file_test(`${sourcePath}/hyprland.conf`, GLib.FileTest.EXISTS)) {
            this.copyFile(`${sourcePath}/hyprland.conf`, `${targetPath}/hyprland/hyprland.conf`);
            if (!detectedApps.includes('hyprland')) detectedApps.push('hyprland');
        }

        return detectedApps;
    }

    copyUnified(sourcePath, targetPath) {
        const detectedApps = [];

        const configRoot = [`${sourcePath}/config`, `${sourcePath}/components`]
            .find((path) => GLib.file_test(path, GLib.FileTest.IS_DIR));
        configRoot && this.copyDir(configRoot, `${targetPath}/config`);

        if (GLib.file_test(`${sourcePath}/hyprland`, GLib.FileTest.IS_DIR)) {
            this.copyDir(`${sourcePath}/hyprland`, `${targetPath}/hyprland`);
            detectedApps.push('hyprland');
        }

        if (GLib.file_test(`${sourcePath}/start-scripts`, GLib.FileTest.IS_DIR)) {
            this.copyDir(`${sourcePath}/start-scripts`, `${targetPath}/start-scripts`);
        }

        if (GLib.file_test(`${sourcePath}/lastlayer-metadata.json`, GLib.FileTest.EXISTS)) {
            this.copyFile(`${sourcePath}/lastlayer-metadata.json`, `${targetPath}/lastlayer-metadata.json`);
        }

        this.copyWallpapers(sourcePath, targetPath);

        return { success: true, detectedApps };
    }

    isHyprlandEntry(name) {
        return name === 'hypr' || name === 'hyprland';
    }

    findHyprlandSourceDir(sourcePath) {
        return [`${sourcePath}/hypr`, `${sourcePath}/hyprland`]
            .find((path) => GLib.file_test(path, GLib.FileTest.IS_DIR)) || null;
    }

    copyFlatEntry(srcPath, entry, targetPath, detectedApps) {
        const lowerEntry = entry.toLowerCase();

        switch (true) {
            case KNOWN_APP_DIRS.includes(lowerEntry):
                this.copyDir(srcPath, `${targetPath}/config/${entry}`);
                detectedApps.push(entry);
                return true;
            case lowerEntry === 'scripts':
                this.copyDir(srcPath, `${targetPath}/start-scripts`);
                return false;
            case WALLPAPER_DIRS.has(lowerEntry):
                this.copyWallpaperFromDir(srcPath, targetPath);
                return false;
            default:
                return false;
        }
    }

    copyWallpapers(sourcePath, targetPath) {
        const existingWallpapers = ['wallpaper.png', 'wallpaper.jpg', 'wallpaper.jpeg', 'wallpaper.webp'];
        for (const wp of existingWallpapers) {
            if (GLib.file_test(`${targetPath}/${wp}`, GLib.FileTest.EXISTS)) {
                return;
            }
        }

        const wallpaperCandidates = [
            'wallpaper.png', 'wallpaper.jpg', 'wallpaper.jpeg',
            'wall.png', 'wall.jpg', 'bg.png', 'bg.jpg',
            'wallpapers/wallpaper.png', 'wallpapers/1.png', 'wallpapers/default.png',
            'walls/wallpaper.png', 'walls/1.png'
        ];

        for (const candidate of wallpaperCandidates) {
            const srcPath = `${sourcePath}/${candidate}`;
            if (GLib.file_test(srcPath, GLib.FileTest.EXISTS)) {
                const ext = candidate.split('.').pop();
                this.copyFile(srcPath, `${targetPath}/wallpaper.${ext}`);

                if (!GLib.file_test(`${targetPath}/preview.png`, GLib.FileTest.EXISTS)) {
                    this.copyFile(srcPath, `${targetPath}/preview.${ext}`);
                }
                return;
            }
        }

        const wallpaperDirs = ['wallpapers', 'walls', 'backgrounds'];
        for (const wallDir of wallpaperDirs) {
            const dirPath = `${sourcePath}/${wallDir}`;
            if (GLib.file_test(dirPath, GLib.FileTest.IS_DIR)) {
                const files = this.listDir(dirPath);
                for (const file of files) {
                    if (file.match(/\.(png|jpg|jpeg|webp)$/i)) {
                        const ext = file.split('.').pop();
                        this.copyFile(`${dirPath}/${file}`, `${targetPath}/wallpaper.${ext}`);
                        if (!GLib.file_test(`${targetPath}/preview.png`, GLib.FileTest.EXISTS)) {
                            this.copyFile(`${dirPath}/${file}`, `${targetPath}/preview.${ext}`);
                        }
                        return;
                    }
                }
            }
        }
    }

    copyExistingScripts(sourcePath, targetPath) {
        const scriptDirs = ['start-scripts', 'scripts', 'install'];
        for (const scriptDir of scriptDirs) {
            const dirPath = `${sourcePath}/${scriptDir}`;
            if (GLib.file_test(dirPath, GLib.FileTest.IS_DIR)) {
                const files = this.listDir(dirPath);
                for (const file of files) {
                    if (file.endsWith('.sh')) {
                        this.copyFile(`${dirPath}/${file}`, `${targetPath}/start-scripts/${file}`);
                        tryRun('StructureTransformer.copyExistingScripts.chmod', () => {
                            GLib.spawn_command_line_sync(`chmod +x "${targetPath}/start-scripts/${file}"`);
                        });
                    }
                }
            }
        }

        if (GLib.file_test(`${sourcePath}/install.sh`, GLib.FileTest.EXISTS)) {
            this.copyFile(`${sourcePath}/install.sh`, `${targetPath}/start-scripts/original_install.sh`);
        }
    }

    ensureDir(path) {
        const dir = Gio.File.new_for_path(path);
        if (!dir.query_exists(null)) {
            tryRun('StructureTransformer.ensureDir', () => {
                dir.make_directory_with_parents(null);
            });
        }
    }

    listDir(path) {
        const entries = [];
        const dir = Gio.File.new_for_path(path);
        if (!dir.query_exists(null)) return entries;

        return tryOrDefault('StructureTransformer.listDir', () => {
            const enumerator = dir.enumerate_children(
                'standard::name',
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

    copyDir(src, dest) {
        const copied = tryRun('StructureTransformer.copyDir', () => {
            if (src === dest) {
                return;
            }
            if (dest.startsWith(src + '/')) {
                return;
            }
            const destDir = Gio.File.new_for_path(dest);
            if (!destDir.query_exists(null)) {
                destDir.make_directory_with_parents(null);
            }
            GLib.spawn_command_line_sync(`cp -rT "${src}" "${dest}"`);
        });
        if (!copied) {
            this.log('Failed to copy directory:', src, '->', dest);
        }
    }

    copyFile(src, dest) {
        const copied = tryRun('StructureTransformer.copyFile', () => {
            if (src === dest) {
                return;
            }
            GLib.spawn_command_line_sync(`cp -f "${src}" "${dest}"`);
        });
        if (!copied) {
            this.log('Failed to copy file:', src, '->', dest);
        }
    }
}
