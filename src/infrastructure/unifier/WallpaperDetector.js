import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryOrNull, tryRun } from '../utils/ErrorUtils.js';

export class WallpaperDetector {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.previewSource = options.previewSource || 'auto';

        this.wallpaperCommands = [
            /swww\s+img\s+["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /hyprpaper\s+.*?["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /swaybg\s+.*?-i\s+["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /feh\s+.*?["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /nitrogen\s+.*?["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /wal\s+-i\s+["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /pywal\s+.*?["']?([^"'\s]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /wallpaper\s*=\s*["']?([^"'\s\n]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /preload\s*=\s*["']?([^"'\s\n]+\.(?:png|jpg|jpeg|webp))["']?/gi,
        ];

        this.wallpaperVariablePatterns = [
            /(?:HYPR_WALL|WALL|WALLPAPER|BG|BACKGROUND|ROFI_BANNER|LOCKSCREEN_BG|DESKTOP_BG)\s*=\s*["']?(\$?[^"'\n]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /\w+\s*=\s*["']?(\$?\w+\/(?:[^"'\n]*\/)?[Ww]allpapers?\/[^"'\n]+\.(?:png|jpg|jpeg|webp))["']?/gi,
            /\w+\s*=\s*["']?(\$?\w+\/modules\/[^"'\n]+\.(?:png|jpg|jpeg|webp))["']?/gi,
        ];

        this.wallpaperDirs = ['wallpaper', 'wallpapers', 'walls', 'backgrounds', 'bg', 'images', 'assets'];

        this.wallpaperNames = ['wallpaper', 'wall', 'background', 'bg', 'desktop'];

        this.imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

        this.minWallpaperWidth = 1280;

        this.distroExcludePatterns = [
            'nixos', 'archlinux', 'arch', 'ubuntu', 'debian', 'fedora',
            'gentoo', 'manjaro', 'opensuse', 'suse', 'linux', 'mint',
            'elementary', 'pop_os', 'popos', 'endeavour', 'garuda',
            'artix', 'void', 'alpine', 'slackware', 'redhat', 'centos',
            'kali', 'parrot', 'tails', 'qubes', 'clearlinux',
            'hyprland', 'sway', 'i3', 'bspwm', 'dwm', 'awesome', 'qtile',
            'xmonad', 'herbstluftwm', 'openbox', 'fluxbox',
            'gnome', 'kde', 'plasma', 'xfce', 'cinnamon', 'mate', 'lxqt', 'budgie',
        ];

        this.serviceExcludePatterns = [
            '-logo', '_logo', 'logo-', 'logo_',
            'icon', 'badge', 'avatar', 'pfp', 'profile',
            'button', 'sprite', 'thumbnail', 'thumb', 'favicon',
            'cursor', 'pointer', 'notification', 'notify',
            'volume', 'brightness', 'battery', 'wifi', 'bluetooth',
            '-lock', '_lock', 'lock-', 'lock_',
            '-logout', '_logout', 'logout-', 'logout_',
            '-reboot', '_reboot', 'reboot-', 'reboot_',
            '-shutdown', '_shutdown', 'shutdown-', 'shutdown_',
            '-suspend', '_suspend', 'suspend-', 'suspend_',
            '-hibernate', '_hibernate', 'hibernate-', 'hibernate_',
            '-sleep', '_sleep', 'sleep-', 'sleep_',
            '-mute', '_mute', 'mute-', 'mute_',
            '-power', '_power', 'power-', 'power_',
            'noise', 'texture', 'gradient', 'overlay',
        ];

        this.exactExcludeFilenames = [
            'logo', 'icon', 'lock', 'logout', 'reboot', 'shutdown',
            'suspend', 'hibernate', 'sleep', 'mute', 'unmute', 'power',
            'noise', 'texture', 'pattern', 'gradient', 'overlay',
        ];
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[WallpaperDetector] ${msg}`, ...args);
        }
    }

    detect(sourcePath, targetPath) {
        let previewDest = null;
        let wallpaperDest = null;

        if (this.previewSource === 'auto' || this.previewSource === 'browser') {
            previewDest = this.findBrowserPreview(sourcePath, targetPath);
            previewDest && this.log('Found browser preview:', previewDest);
        }

        const allImages = this.findAllImages(sourcePath);
        this.log(`Found ${allImages.length} images`);

        const wallpaper = this.selectWallpaper(sourcePath, allImages);
        if (wallpaper) {
            this.log('Selected wallpaper:', wallpaper);
            const ext = this.getExtension(wallpaper);
            wallpaperDest = `${targetPath}/wallpaper${ext}`;
            this.copyFile(wallpaper, wallpaperDest);

            const shouldUseAlgorithmPreview =
                this.previewSource === 'algorithm' ||
                (this.previewSource === 'auto' && !previewDest);

            if (shouldUseAlgorithmPreview && !previewDest) {
                previewDest = `${targetPath}/preview${ext}`;
                this.copyFile(wallpaper, previewDest);
                this.log('Using wallpaper as preview (algorithm mode)');
            }
        }

        if (previewDest || wallpaperDest) {
            return {
                success: true,
                wallpaper: wallpaperDest,
                preview: previewDest
            };
        }

        this.log('No suitable wallpaper or preview found');
        return { success: false, error: 'No suitable wallpaper or preview found' };
    }

    findBrowserPreview(sourcePath, targetPath) {
        const inPlace = sourcePath === targetPath;

        for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
            const existingPreview = `${targetPath}/preview${ext}`;
            if (GLib.file_test(existingPreview, GLib.FileTest.EXISTS)) {
                this.log('Preview already exists at target:', existingPreview);
                return existingPreview;
            }
        }

        const previewCandidates = [
            'preview.png',
            'preview.jpg',
            'preview.jpeg',
            'preview.webp',
            'screenshot.png',
            'screenshot.jpg',
            'rice-preview.png',
            'rice-preview.jpg'
        ];

        for (const candidate of previewCandidates) {
            const previewPath = `${sourcePath}/${candidate}`;
            if (GLib.file_test(previewPath, GLib.FileTest.EXISTS)) {
                const ext = this.getExtension(candidate);
                const destPath = `${targetPath}/preview${ext}`;

                if (inPlace && previewPath === destPath) {
                    return destPath;
                }

                if (previewPath !== destPath) {
                    this.copyFile(previewPath, destPath);
                }
                return destPath;
            }
        }

        return null;
    }

    findForcedWallpaper(sourcePath) {
        const candidates = [
            'wallpaper.browser.png',
            'wallpaper.browser.jpg',
            'wallpaper.browser.jpeg',
            'wallpaper.browser.webp',
            'wallpaper.import.png',
            'wallpaper.import.jpg',
            'wallpaper.import.jpeg',
            'wallpaper.import.webp',
            'wallpaper.override.png',
            'wallpaper.override.jpg',
            'wallpaper.override.jpeg',
            'wallpaper.override.webp',
        ];

        for (const candidate of candidates) {
            const fullPath = `${sourcePath}/${candidate}`;
            if (GLib.file_test(fullPath, GLib.FileTest.EXISTS)) {
                this.log('Found forced wallpaper:', fullPath);
                return fullPath;
            }
        }

        return null;
    }

    findFromReadme(sourcePath, allImages) {
        const readmeNames = ['README.md', 'README', 'readme.md', 'readme', 'README.txt'];

        for (const readmeName of readmeNames) {
            const readmePath = `${sourcePath}/${readmeName}`;
            if (!GLib.file_test(readmePath, GLib.FileTest.EXISTS)) {
                continue;
            }

            const text = this.readTextFile(readmePath, 'WallpaperDetector.findFromReadme');
            if (!text) {
                continue;
            }

            const lines = text.split('\n');
            for (const line of lines) {
                const wallpaperMatch = line.match(/wallpaper[:\s*\]]+/i);
                if (!wallpaperMatch) continue;

                this.log('Found Wallpaper line in README:', line.trim());
                const imageUrl = this.extractReadmeImageUrl(line);
                if (!imageUrl) continue;

                const filename = imageUrl.split('/').pop().split('?')[0].toLowerCase();
                this.log('Extracted wallpaper filename from README:', filename);

                const localMatch = allImages.find(img => img.split('/').pop().toLowerCase() === filename);
                if (localMatch) {
                    this.log('Found local match for README wallpaper:', localMatch);
                    return localMatch;
                }

                this.log('README wallpaper not found locally:', filename);
            }
        }

        return null;
    }

    findFromScripts(sourcePath, allImages) {
        const scriptFiles = this.findAllScripts(sourcePath);

        const knownConfigs = [
            'install.sh',
            'setup.sh',
            'apply.sh',
            'start.sh',
            '.config/hypr/hyprland.conf',
            'hypr/hyprland.conf',
            'hyprland.conf',
            '.config/hypr/hyprpaper.conf',
            'hypr/hyprpaper.conf',
            'hyprpaper.conf',
            'config/hypr/hyprland.conf',
            'config/hypr/hyprpaper.conf',
        ];

        for (const conf of knownConfigs) {
            const fullPath = `${sourcePath}/${conf}`;
            if (!scriptFiles.includes(fullPath) && GLib.file_test(fullPath, GLib.FileTest.EXISTS)) {
                scriptFiles.push(fullPath);
            }
        }

        const variableImages = new Set();
        const commandImages = new Set();

        for (const scriptPath of scriptFiles) {
            if (!GLib.file_test(scriptPath, GLib.FileTest.EXISTS)) continue;
            const text = this.readTextFile(scriptPath, 'WallpaperDetector.findFromScripts');
            if (!text) {
                continue;
            }

            this.collectWallpaperVariableReferences(text, variableImages);
            this.collectWallpaperCommandReferences(text, commandImages);
        }

        if (variableImages.size > 0) {
            this.log('HIGH PRIORITY wallpaper references:', Array.from(variableImages).join(', '));
            const match = this.matchImageReference(sourcePath, allImages, variableImages);
            if (match) {
                this.log('Matched HIGH PRIORITY wallpaper:', match);
                return match;
            }
        }

        if (commandImages.size > 0) {
            this.log('Found wallpaper command references:', Array.from(commandImages).join(', '));
            const match = this.matchImageReference(sourcePath, allImages, commandImages);
            if (match) {
                this.log('Matched wallpaper command:', match);
                return match;
            }
        }

        this.log('Referenced images not found locally, trying other methods');
        return null;
    }

    findAllScripts(dirPath, scripts = []) {
        this.collectFiles(dirPath, (name) => name.endsWith('.sh') || name.endsWith('.conf') || name.endsWith('.py'), scripts, 'WallpaperDetector.findAllScripts');
        return scripts;
    }

    matchImageReference(sourcePath, allImages, references) {
        this.log(`Matching ${references.size || Array.from(references).length} references against ${allImages.length} local images`);

        for (const imagePath of allImages) {
            const filename = imagePath.split('/').pop().toLowerCase();
            const relativePath = imagePath.replace(sourcePath + '/', '').toLowerCase();

            for (const ref of references) {
                const refLower = ref.toLowerCase();
                const refFilename = ref.split('/').pop().toLowerCase();

                if (filename === refFilename ||
                    relativePath === refLower ||
                    relativePath.endsWith('/' + refFilename) ||
                    relativePath.includes(refLower.replace(/^.*\//, ''))) {
                    this.log(`Matched reference "${refFilename}" to local file: ${filename}`);
                    return imagePath;
                }
            }
        }

        this.log(`No match found for references: ${Array.from(references).map(r => r.split('/').pop()).join(', ')}`);
        return null;
    }

    findFromWallpaperDirs(_sourcePath, allImages) {
        for (const dirName of this.wallpaperDirs) {
            const candidates = allImages.filter(img => {
                const lower = img.toLowerCase();
                return lower.includes(`/${dirName}/`);
            });

            if (candidates.length > 0) {
                const filtered = this.filterExcludedImages(candidates);
                const workingSet = filtered.length > 0 ? filtered : candidates;

                this.log(`Found ${candidates.length} images in /${dirName}/, ${filtered.length} after filtering`);
                this.log(`Candidates: ${candidates.map(c => c.split('/').pop()).join(', ')}`);

                const named = workingSet.find(img => {
                    const filename = img.split('/').pop().toLowerCase();
                    return this.wallpaperNames.some(n => filename.includes(n));
                });

                if (named) {
                    this.log(`Selected by name match: ${named.split('/').pop()}`);
                    return named;
                }

                const nonDarkImages = workingSet.filter(img => {
                    const filename = img.split('/').pop().toLowerCase();
                    return !filename.includes('dark') && !filename.includes('_dark') && !filename.includes('-dark');
                });

                if (nonDarkImages.length > 0 && nonDarkImages.length < workingSet.length) {
                    const largestNonDark = this.findLargestImage(nonDarkImages);
                    if (largestNonDark) {
                        this.log(`Selected non-dark variant (largest): ${largestNonDark.split('/').pop()}`);
                        return largestNonDark;
                    }
                    this.log(`Selected non-dark variant (first): ${nonDarkImages[0].split('/').pop()}`);
                    return nonDarkImages[0];
                }

                const largest = this.findLargestImage(workingSet);
                if (largest) {
                    this.log(`Selected by size (largest): ${largest.split('/').pop()}`);
                    return largest;
                }

                this.log(`Selected by order (first): ${workingSet[0].split('/').pop()}`);
                return workingSet[0];
            }
        }

        return null;
    }

    findByFilename(allImages) {
        const filtered = this.filterExcludedImages(allImages);
        const workingSet = filtered.length > 0 ? filtered : allImages;

        const pickBest = (matches) => {
            if (!matches || matches.length === 0) return null;
            return this.findLargestImage(matches) || matches[0];
        };

        const exact = workingSet.filter(img => {
            const filename = img.split('/').pop().toLowerCase();
            return /^wallpaper\.(png|jpg|jpeg|webp)$/.test(filename);
        });
        const exactPick = pickBest(exact);
        if (exactPick) return exactPick;

        const light = workingSet.filter(img => {
            const filename = img.split('/').pop().toLowerCase();
            return (
                filename.includes('light-wallpaper') ||
                filename.includes('wallpaper-light') ||
                filename.includes('light_wallpaper') ||
                filename.includes('wallpaper_light')
            );
        });
        const lightPick = pickBest(light);
        if (lightPick) return lightPick;

        const dark = workingSet.filter(img => {
            const filename = img.split('/').pop().toLowerCase();
            return (
                filename.includes('dark-wallpaper') ||
                filename.includes('wallpaper-dark') ||
                filename.includes('dark_wallpaper') ||
                filename.includes('wallpaper_dark')
            );
        });
        const darkPick = pickBest(dark);
        if (darkPick) return darkPick;

        const wallpaperMentions = workingSet.filter(img => {
            const filename = img.split('/').pop().toLowerCase();
            return filename.includes('wallpaper');
        });
        const mentionPick = pickBest(wallpaperMentions);
        if (mentionPick) return mentionPick;

        for (const pattern of this.wallpaperNames) {
            const found = workingSet.find(img => {
                const filename = img.split('/').pop().toLowerCase();
                return filename.includes(pattern);
            });
            if (found) return found;
        }
        return null;
    }

    findLargestImage(images) {
        let largest = null;
        let largestSize = 0;

        for (const imagePath of images) {
            const size = this.getImageSize(imagePath);
            if (size && size.width >= this.minWallpaperWidth) {
                const pixels = size.width * size.height;
                if (pixels > largestSize) {
                    largestSize = pixels;
                    largest = imagePath;
                }
            }
        }

        if (!largest) {
            let largestFileSize = 0;
            for (const imagePath of images) {
                const fileSize = this.getFileSize(imagePath);
                if (fileSize > largestFileSize) {
                    largestFileSize = fileSize;
                    largest = imagePath;
                }
            }
        }

        return largest;
    }

    getImageSize(imagePath) {
        const output = this.runCommandOutput(`file "${imagePath}"`, 'WallpaperDetector.getImageSize');
        if (!output) {
            return null;
        }

        const match = output.match(/(\d+)\s*x\s*(\d+)/);
        if (match) {
            return {
                width: parseInt(match[1]),
                height: parseInt(match[2])
            };
        }

        return null;
    }

    findAllImages(dirPath, images = []) {
        this.collectFiles(dirPath, (name) => this.imageExtensions.includes(this.getExtension(name)), images, 'WallpaperDetector.findAllImages');
        return images;
    }

    findLightWallpaper(images) {
        if (!images || images.length === 0) return null;

        const matches = images.filter((imagePath) => {
            const name = imagePath.split('/').pop().toLowerCase();
            return (
                name.includes('light-wallpaper') ||
                name.includes('light_wallpaper') ||
                name.includes('wallpaper-light') ||
                name.includes('wallpaper_light')
            );
        });

        if (matches.length === 0) return null;

        return this.findLargestImage(matches);
    }

    getExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        if (lastDot === -1) return '';
        return filename.substring(lastDot).toLowerCase();
    }

    isExcludedImage(imagePath) {
        const filename = imagePath.split('/').pop().toLowerCase();
        const filenameWithoutExt = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
        const relativePath = imagePath.toLowerCase();

        for (const distro of this.distroExcludePatterns) {
            if (filenameWithoutExt === distro) {
                this.log(`Excluding distro image: ${filename} (matches: ${distro})`);
                return true;
            }
            if (filenameWithoutExt.startsWith(distro + '-') ||
                filenameWithoutExt.startsWith(distro + '_') ||
                filenameWithoutExt.endsWith('-' + distro) ||
                filenameWithoutExt.endsWith('_' + distro)) {
                this.log(`Excluding distro image: ${filename} (contains: ${distro})`);
                return true;
            }
        }

        if (this.exactExcludeFilenames.includes(filenameWithoutExt)) {
            this.log(`Excluding exact match: ${filename}`);
            return true;
        }

        for (const pattern of this.serviceExcludePatterns) {
            if (filenameWithoutExt.includes(pattern)) {
                this.log(`Excluding service image: ${filename} (contains: ${pattern})`);
                return true;
            }
        }

        if (relativePath.includes('/icons/') ||
            relativePath.includes('/wlogout/') ||
            relativePath.includes('/cursors/')) {
            this.log(`Excluding image from service directory: ${filename}`);
            return true;
        }

        return false;
    }

    filterExcludedImages(images) {
        return images.filter(img => !this.isExcludedImage(img));
    }

    copyFile(src, dest) {
        if (src === dest) {
            return true;
        }

        return tryOrDefault('WallpaperDetector.copyFile', () => {
            const sourceFile = Gio.File.new_for_path(src);
            const destFile = Gio.File.new_for_path(dest);
            sourceFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
            return true;
        }, false);
    }

    selectWallpaper(sourcePath, allImages) {
        const strategies = [
            { label: 'Priority 0 (README)', resolve: () => this.findFromReadme(sourcePath, allImages) },
            { label: 'Priority 0.5 (forced/browser)', resolve: () => this.findForcedWallpaper(sourcePath) },
            { label: 'Priority 1 (scripts)', resolve: () => this.findFromScripts(sourcePath, allImages) },
            { label: 'Priority 2 (wallpaper dirs)', resolve: () => this.findFromWallpaperDirs(sourcePath, allImages) },
            { label: 'Priority 3 (filename)', resolve: () => this.findByFilename(allImages) },
            { label: 'Priority 3.5 (light wallpaper)', resolve: () => this.findLightWallpaper(allImages) },
            { label: 'Priority 4 (largest filtered)', resolve: () => this.findLargestFilteredWallpaper(allImages) }
        ];

        for (const strategy of strategies) {
            const wallpaper = strategy.resolve();
            if (!wallpaper) {
                continue;
            }

            this.log(`${strategy.label} selected:`, wallpaper);
            return wallpaper;
        }

        return null;
    }

    findLargestFilteredWallpaper(allImages) {
        const filtered = this.filterExcludedImages(allImages);
        this.log(`Priority 4: ${allImages.length} total images, ${filtered.length} after excluding distros/icons`);
        return this.findLargestImage(filtered.length > 0 ? filtered : allImages);
    }

    extractReadmeImageUrl(line) {
        const mdLinkMatch = line.match(/\[([^\]]*)\]\(([^)]+\.(?:png|jpg|jpeg|webp))\)/i);
        if (mdLinkMatch) {
            return mdLinkMatch[2];
        }

        const urlMatch = line.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp))/i);
        return urlMatch ? urlMatch[1] : null;
    }

    collectWallpaperVariableReferences(text, variableImages) {
        for (const pattern of this.wallpaperVariablePatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                let imagePath = match[1];
                imagePath = imagePath.replace(/\$\w+\//g, '');
                variableImages.add(imagePath);
                variableImages.add(imagePath.split('/').pop());
                this.log('Found HIGH PRIORITY wallpaper variable:', match[0], '->', imagePath);
            }
        }
    }

    collectWallpaperCommandReferences(text, commandImages) {
        for (const pattern of this.wallpaperCommands) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const imagePath = match[1];
                commandImages.add(imagePath);
                commandImages.add(imagePath.split('/').pop());
            }
        }
    }

    readTextFile(filePath, context) {
        return tryOrNull(context, () => {
            const [ok, content] = GLib.file_get_contents(filePath);
            return ok ? new TextDecoder().decode(content) : null;
        });
    }

    runCommandOutput(command, context) {
        return tryOrNull(context, () => {
            const [ok, stdout] = GLib.spawn_command_line_sync(command);
            return ok ? new TextDecoder().decode(stdout) : null;
        });
    }

    getFileSize(filePath) {
        return tryOrDefault('WallpaperDetector.getFileSize', () => {
            const file = Gio.File.new_for_path(filePath);
            const info = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null);
            return info.get_size();
        }, 0);
    }

    collectFiles(dirPath, shouldInclude, results, context) {
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) {
            return results;
        }

        const enumerator = tryOrNull(`${context}.open`, () => dir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        ));
        if (!enumerator) {
            return results;
        }

        let info;
        while ((info = tryOrNull(`${context}.next`, () => enumerator.next_file(null)))) {
            const name = info.get_name();
            const fullPath = `${dirPath}/${name}`;

            if (name.startsWith('.') || name === '__MACOSX' || name === 'node_modules') {
                continue;
            }

            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                this.collectFiles(fullPath, shouldInclude, results, context);
                continue;
            }

            shouldInclude(name, fullPath) && results.push(fullPath);
        }

        tryRun(`${context}.close`, () => enumerator.close(null));
        return results;
    }
}
