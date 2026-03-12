import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export class PathNormalizer {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.themeContext = null;

        this.replacementRules = {
            '.sh': '$HOME',
            '.conf': '~',
            '.yuck': '~',
            '.toml': '~',
            '.ini': '~',
            '.json': '~',
            '.yaml': '~',
            '.yml': '~',
            '.css': '~',
            '.scss': '~',
            '.rasi': '~'
        };

        this.specialFiles = {
            'bookmarks': 'file://$HOME',
            'user-dirs.dirs': '$HOME'
        };

        this.skipExtensions = [
            '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
            '.ttf', '.otf', '.woff', '.woff2',
            '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.zst', '.7z', '.rar',
            '.pdf', '.mp3', '.mp4', '.mkv', '.webm', '.avi', '.mov',
            '.bin', '.so', '.dll', '.dylib'
        ];
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[PathNormalizer] ${msg}`, ...args);
        }
    }

    rewriteThemePaths(themePath) {
        this.themeContext = this.buildThemeContext(themePath);
        const rewriteResult = tryOrDefault('PathNormalizer.rewriteThemePaths', () => {
            const usernames = this.detectUsernames(themePath);
            this.log('Detected usernames:', usernames.join(', ') || 'none');

            if (usernames.length === 0 && !this.themeContext?.hasAssets)
                return { success: true, filesProcessed: 0 };

            let filesProcessed = 0;
            for (const filePath of this.getAllFiles(themePath)) {
                if (this.shouldSkip(filePath))
                    continue;
                filesProcessed += this.rewriteFilePaths(filePath, usernames) ? 1 : 0;
            }

            this.log(`Rewrote ${filesProcessed} files`);
            return { success: true, filesProcessed };
        }, { success: false, error: 'path rewrite failed' });

        this.themeContext = null;
        return rewriteResult;
    }

    buildThemeContext(themePath) {
        const themeName = String(themePath || '').split('/').filter(Boolean).pop() || '';
        const assetsDirs = [];
        ['assets', 'assets-profile', 'assets_profile', 'wallpapers', 'walls', 'backgrounds'].forEach((dir) => {
            const full = `${themePath}/${dir}`;
            if (GLib.file_test(full, GLib.FileTest.IS_DIR)) assetsDirs.push(full);
        });

        const assetBasenames = new Set();
        const imageExt = /\.(png|jpe?g|webp)$/i;
        assetsDirs.forEach((dir) => {
            const files = tryOrDefault('PathNormalizer.buildThemeContext.assets', () => this.getAllFiles(dir), []);
            files.forEach((filePath) => {
                const name = (filePath.split('/').pop() || '').trim();
                if (name && imageExt.test(name)) assetBasenames.add(name);
            });
        });

        return {
            themeName,
            hasAssets: assetsDirs.length > 0,
            assetBasenames,
        };
    }

    getThemeAssetsDir(prefix) {
        const themeName = this.themeContext?.themeName;
        if (!themeName) return null;
        return `${prefix}/.config/themes/${themeName}/assets`;
    }

    rewriteAssetPaths(text, prefix) {
        if (!this.themeContext?.hasAssets) return text;
        const themeAssetsDir = this.getThemeAssetsDir(prefix);
        if (!themeAssetsDir) return text;

        let next = text;

        next = next.replace(/(?:\$HOME|~)\/new-dotfiles\/assets(?=\/|["'\s]|$)/g, themeAssetsDir);
        next = next.replace(/(?:\$HOME|~)\/new-dotfiles\/assets-profile(?=\/|["'\s]|$)/g, `${themeAssetsDir}-profile`);
        next = next.replace(/(?:\$HOME|~)\/new-dotfiles\/assets_profile(?=\/|["'\s]|$)/g, `${themeAssetsDir}-profile`);

        const basenames = this.themeContext.assetBasenames || new Set();
        if (basenames.size === 0) return next;

        const rewriteIfExists = (match, filename) => {
            const base = (filename || '').split('/').pop();
            if (!base || !basenames.has(base)) return match;
            return `${themeAssetsDir}/${base}`;
        };

        next = next.replace(/(?:\$HOME|~)\/Pictures\/wallpapers\/([^"'\s]+?\.(?:png|jpe?g|webp))(?:!\w+)?/gi, rewriteIfExists);
        next = next.replace(/(?:\$HOME|~)\/Pictures\/wallpaper\/([^"'\s]+?\.(?:png|jpe?g|webp))(?:!\w+)?/gi, rewriteIfExists);

        next = next.replace(/(?:\$HOME|~)\/new-dotfiles\/assets\/([^"'\s]+?\.(?:png|jpe?g|webp))(?:!\w+)?/gi, rewriteIfExists);

        return next;
    }

    detectUsernames(themePath) {
        const usernames = new Set();
        const homePattern = /\/home\/([a-zA-Z0-9_-]+)\//g;

        for (const filePath of this.getAllFiles(themePath)) {
            if (this.shouldSkip(filePath))
                continue;

            const fileUsernames = tryOrDefault('PathNormalizer.detectUsernames', () => {
                const [ok, content] = GLib.file_get_contents(filePath);
                if (!ok)
                    return [];

                const detected = [];
                const text = new TextDecoder().decode(content);
                let match = null;

                while ((match = homePattern.exec(text)) !== null) {
                    const username = match[1];
                    if (!['user', 'username', 'example', 'your_user'].includes(username))
                        detected.push(username);
                }

                return detected;
            }, []);

            for (const username of fileUsernames)
                usernames.add(username);
        }

        return Array.from(usernames);
    }

    rewriteFilePaths(filePath, usernames) {
        return tryOrDefault('PathNormalizer.rewriteFilePaths', () => {
            const [ok, content] = GLib.file_get_contents(filePath);
            if (!ok)
                return false;

            let text = new TextDecoder().decode(content);
            const originalText = text;
            const prefix = this.getReplacementPrefix(filePath);

            for (const username of usernames) {
                const pattern = new RegExp(`/home/${username}/`, 'g');
                text = text.replace(pattern, `${prefix}/`);
            }

            text = this.rewriteAssetPaths(text, prefix);
            text = this.rewriteRumdaPaths(text, filePath);

            if (text !== originalText) {
                GLib.file_set_contents(filePath, text);
                return true;
            }

            return false;
        }, false);
    }

    rewriteRumdaPaths(text, filePath) {
        const themeName = (this.themeContext?.themeName || '').toLowerCase();
        if (!themeName.includes('rumda')) return text;

        const ext = this.getExtension(filePath.split('/').pop());
        if (ext !== '.sh') return text;

        const themeBase = `$HOME/.config/themes/${this.themeContext.themeName}`;
        let next = text;

        const replaceAll = (pattern, replacement) => {
            next = next.replace(pattern, replacement);
        };

        replaceAll(/\/home\/\$USER\/\.config\/rumda-pistachio/g, `${themeBase}/rumda-pistachio`);
        replaceAll(/\$HOME\/\.config\/rumda-pistachio/g, `${themeBase}/rumda-pistachio`);
        replaceAll(/~\/\.config\/rumda-pistachio/g, `${themeBase}/rumda-pistachio`);
        replaceAll(/\/home\/\$USER\/\.config\/rumda(?!-pistachio)/g, themeBase);
        replaceAll(/\$HOME\/\.config\/rumda(?!-pistachio)/g, themeBase);
        replaceAll(/~\/\.config\/rumda(?!-pistachio)/g, themeBase);

        return next;
    }

    getReplacementPrefix(filePath) {
        const fileName = filePath.split('/').pop();
        const ext = this.getExtension(fileName);

        for (const [pattern, prefix] of Object.entries(this.specialFiles)) {
            if (filePath.includes(pattern)) {
                return prefix;
            }
        }

        if (this.replacementRules[ext]) {
            return this.replacementRules[ext];
        }

        return '~';
    }

    getExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        if (lastDot === -1) return '';
        return filename.substring(lastDot).toLowerCase();
    }

    shouldSkip(filePath) {
        const ext = this.getExtension(filePath.split('/').pop());
        return this.skipExtensions.includes(ext);
    }

    getAllFiles(dirPath, files = []) {
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) return files;

        const enumerator = tryOrDefault('PathNormalizer.getAllFiles.enumerate', () => dir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        ), null);
        if (!enumerator)
            return files;

        let info;
        while ((info = enumerator.next_file(null))) {
            const name = info.get_name();
            const fullPath = `${dirPath}/${name}`;

            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                this.getAllFiles(fullPath, files);
            } else {
                files.push(fullPath);
            }
        }
        tryRun('PathNormalizer.getAllFiles.close', () => enumerator.close(null));

        return files;
    }
}
