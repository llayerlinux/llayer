
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export class ReadmeThemeDetector {
    constructor(options = {}) {
        this.logger = options.logger || null;

        this.themePatterns = [
            'gruvbox', 'catppuccin', 'nord', 'dracula', 'tokyo-night', 'tokyonight',
            'rose-pine', 'rosepine', 'everforest', 'kanagawa', 'onedark', 'one-dark',
            'monokai', 'solarized', 'material', 'palenight', 'ayu', 'oxocarbon',
            'decay', 'graphite', 'nightfox', 'doomone', 'night-owl', 'nightowl'
        ];

        this.docFiles = [
            'readme.md', 'README.md', 'README', 'readme',
            'readme.txt', 'README.txt',
            'ABOUT.md', 'about.md',
            'INFO.md', 'info.md'
        ];

        this.contextKeywords = [
            'wallpaper', 'background image', 'gowall'
        ];

        this.wallpaperKeywords = [
            'wallpaper', 'background', 'gowall', 'converted', 'transformed'
        ];

        this.exclusionPatterns = [
            /\b(terminal|vim|nvim|neovim|emacs|vscode|code|editor|kitty|alacritty|wezterm|foot)\b/i,
            /\b(gtk|qt|kde|gnome|waybar|rofi|dunst|mako|eww|hyprland|sway)\s*(theme|config|colors?)?\b/i,
            /\btheme\b/i,
            /\b(install|setup|config|dotfiles?)\b/i,
            /\b(colors?|palette|scheme)\s+(of|from|for|are|is)\b/i
        ];
    }

    log(message, level = 'info') {
        if (this.logger) {
            this.logger(message, level);
        }
    }

    detect(themePath) {
        const result = {
            detected: false,
            theme: null,
            source: null,
            confidence: 0,
            instructionsCreated: false,
            existingInstructions: false
        };

        const instructionsPath = GLib.build_filenamev([themePath, 'transform-instructions.json']);
        if (GLib.file_test(instructionsPath, GLib.FileTest.EXISTS)) {
            const existingInstructions = tryOrDefault('ReadmeThemeDetector.detect.existingInstructions', () => {
                const [, contents] = GLib.file_get_contents(instructionsPath);
                const decoder = new TextDecoder('utf-8');
                const json = JSON.parse(decoder.decode(contents));
                return Array.isArray(json.instructions) && json.instructions.length > 0;
            }, null);
            if (existingInstructions === true) {
                this.log('Transform instructions already exist, skipping README detection', 'info');
                result.existingInstructions = true;
                return result;
            }
            if (existingInstructions === null) {
                this.log('Existing transform-instructions.json is invalid', 'warn');
            }
        }

        const readmeContent = this.findAndReadReadme(themePath);
        if (!readmeContent) {
            this.log('No README found in theme directory', 'info');
            return result;
        }

        const detection = this.detectThemeFromContent(readmeContent.content, readmeContent.filename);
        if (!detection.theme) {
            this.log('No colorscheme theme detected in README', 'info');
            return result;
        }

        result.detected = true;
        result.theme = detection.theme;
        result.source = readmeContent.filename;
        result.confidence = detection.confidence;

        this.log(`Detected theme '${detection.theme}' from ${readmeContent.filename} (confidence: ${detection.confidence})`, 'success');

        const instructions = this.createTransformInstructions(detection.theme, readmeContent.filename);
        const written = tryRun('ReadmeThemeDetector.detect.writeInstructions', () => {
            const file = Gio.File.new_for_path(instructionsPath);
            const jsonStr = JSON.stringify(instructions, null, 2);
            file.replace_contents(jsonStr, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        });
        if (written) {
            result.instructionsCreated = true;
            this.log(`Created transform-instructions.json with gowall command for ${detection.theme}`, 'success');
        } else {
            this.log('Failed to create transform-instructions.json', 'error');
        }

        return result;
    }

    findAndReadReadme(themePath) {
        for (const filename of this.docFiles) {
            const filePath = GLib.build_filenamev([themePath, filename]);
            if (GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
                const readme = tryOrDefault('ReadmeThemeDetector.findAndReadReadme', () => {
                    const [, contents] = GLib.file_get_contents(filePath);
                    const decoder = new TextDecoder('utf-8');
                    return {
                        filename,
                        content: decoder.decode(contents)
                    };
                }, null);
                if (readme)
                    return readme;
                this.log(`Failed to read ${filename}`, 'warn');
            }
        }
        return null;
    }

    detectThemeFromContent(content, filename) {
        const result = {
            theme: null,
            confidence: 0,
            mentions: []
        };

        const contentLower = content.toLowerCase();

        const hasWallpaperContext = this.wallpaperKeywords.some(kw => contentLower.includes(kw));
        if (!hasWallpaperContext) {
            this.log('No wallpaper context found in README, skipping theme detection', 'info');
            return result;
        }

        const themeRegex = new RegExp(`\\b(${this.themePatterns.join('|')})\\b`, 'gi');

        const mentions = new Map();
        let match;
        while ((match = themeRegex.exec(content)) !== null) {
            const theme = match[1].toLowerCase();
            const normalizedTheme = this.canonicalizeThemeName(theme);

            const start = Math.max(0, match.index - 100);
            const end = Math.min(content.length, match.index + 100);
            const context = content.substring(start, end);
            const contextLower = context.toLowerCase();

            const hasExclusion = this.exclusionPatterns.some(pattern => pattern.test(context));
            if (hasExclusion) {
                this.log(`Skipping theme mention '${theme}' - exclusion pattern found in context`, 'info');
                continue;
            }

            const hasLocalWallpaperContext = this.wallpaperKeywords.some(kw => contextLower.includes(kw));
            if (!hasLocalWallpaperContext) {
                this.log(`Skipping theme mention '${theme}' - no wallpaper context nearby`, 'info');
                continue;
            }

            let contextBoost = 0;
            for (const keyword of this.contextKeywords) {
                if (contextLower.includes(keyword)) {
                    contextBoost += 15;
                }
            }

            if (contextLower.includes('gowall')) {
                contextBoost += 50;
            }

            const currentScore = (mentions.get(normalizedTheme) || 0) + 20 + contextBoost;
            mentions.set(normalizedTheme, currentScore);
        }

        let bestTheme = null;
        let bestScore = 0;

        for (const [theme, score] of mentions.entries()) {
            if (score > bestScore) {
                bestScore = score;
                bestTheme = theme;
            }
        }

        if (bestTheme && bestScore >= 35) {
            result.theme = bestTheme;
            result.confidence = Math.min(100, bestScore);
            result.mentions = Array.from(mentions.entries());
        }

        return result;
    }

    canonicalizeThemeName(theme) {
        const aliases = {
            'tokyonight': 'tokyo-night',
            'rosepine': 'rose-pine',
            'onedark': 'one-dark',
            'nightowl': 'night-owl'
        };

        return aliases[theme] || theme;
    }

    createTransformInstructions(theme, sourceFile) {
        return {
            version: 1,
            postId: null,
            postTitle: null,
            instructions: [{
                command: `gowall convert <wallpaper> -t ${theme}`,
                source: `readme:${sourceFile}`,
                isOp: true,
                score: 55,
                type: 'readme-detected',
                inferred: true,
                detectedTheme: theme,
                toolHint: 'gowall',
                inferReason: 'theme_in_readme'
            }],
            extractedAt: new Date().toISOString(),
            detectedBy: 'ReadmeThemeDetector'
        };
    }
}
