import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryOrNull, tryRun } from '../utils/ErrorUtils.js';

export class ThemeValidator {
    constructor(options = {}) {
        this.logger = options.logger || null;
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[ThemeValidator] ${msg}`, ...args);
        }
    }

    validate(themePath, themeName) {
        const errors = [];
        const warnings = [];

        this.validateDirectories(themePath, errors, warnings);

        this.validateHyprland(themePath, errors, warnings);

        this.validateWallpaper(themePath, errors, warnings);

        this.validateMetadata(themePath, themeName, errors, warnings);

        this.validateNoPaths(themePath, warnings);

        this.validateScripts(themePath, warnings);

        const valid = errors.length === 0;

        if (!valid) {
            this.log('Validation failed:', errors.join(', '));
        }
        if (warnings.length > 0) {
            this.log('Validation warnings:', warnings.join(', '));
        }

        return { valid, errors, warnings };
    }

    validateDirectories(themePath, errors, warnings) {
        const required = ['config', 'hyprland', 'start-scripts'];

        for (const dir of required) {
            const dirPath = `${themePath}/${dir}`;
            if (!GLib.file_test(dirPath, GLib.FileTest.IS_DIR)) {
                warnings.push(this.getMissingDirectoryWarning(dir));
            }
        }

        const configPath = `${themePath}/config`;
        if (GLib.file_test(configPath, GLib.FileTest.IS_DIR)) {
            const entries = this.listDir(configPath);
            if (entries.length === 0) {
                warnings.push('config/ directory is empty');
            }
        }
    }

    validateHyprland(themePath, errors, warnings) {
        const hyprlandDir = `${themePath}/hyprland`;

        if (!GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR)) {
            return;
        }

        const mainConfig = `${hyprlandDir}/hyprland.conf`;
        if (!GLib.file_test(mainConfig, GLib.FileTest.EXISTS)) {
            warnings.push('Missing hyprland/hyprland.conf');
            return;
        }

        const moduleFiles = ['general.conf', 'keybinds.conf', 'rules.conf', 'execs.conf', 'env.conf', 'colors.conf'];
        const missingModules = [];

        for (const mod of moduleFiles) {
            if (!GLib.file_test(`${hyprlandDir}/${mod}`, GLib.FileTest.EXISTS)) {
                missingModules.push(mod);
            }
        }

        if (missingModules.length > 0 && missingModules.length < moduleFiles.length) {
            warnings.push(`Some modular configs missing: ${missingModules.join(', ')}`);
        }

        this.validateSourcePaths(mainConfig, hyprlandDir, warnings);
    }

    validateSourcePaths(configPath, baseDir, warnings) {
        const text = this.readTextFile(configPath, 'ThemeValidator.validateSourcePaths');
        if (!text) {
            return;
        }

        const sourcePattern = /^source\s*=\s*(.+)$/gm;
        let match;
        while ((match = sourcePattern.exec(text)) !== null) {
            const rawSourcePath = match[1].trim();
            const resolvedSourcePath = this.resolveSourcePath(rawSourcePath, baseDir);
            if (!resolvedSourcePath) {
                continue;
            }

            if (!GLib.file_test(resolvedSourcePath, GLib.FileTest.EXISTS)) {
                warnings.push(`Invalid source path: ${rawSourcePath}`);
            }
        }
    }

    validateWallpaper(themePath, errors, warnings) {
        const extensions = ['png', 'jpg', 'jpeg', 'webp'];

        let hasWallpaper = false;
        for (const ext of extensions) {
            if (GLib.file_test(`${themePath}/wallpaper.${ext}`, GLib.FileTest.EXISTS)) {
                hasWallpaper = true;
                break;
            }
        }

        if (!hasWallpaper) {
            warnings.push('No wallpaper found (wallpaper.png/jpg)');
        }

        let hasPreview = false;
        for (const ext of extensions) {
            if (GLib.file_test(`${themePath}/preview.${ext}`, GLib.FileTest.EXISTS)) {
                hasPreview = true;
                break;
            }
        }

        if (!hasPreview) {
            warnings.push('No preview image found');
        }
    }

    validateMetadata(themePath, themeName, errors, warnings) {
        const metadataPath = `${themePath}/lastlayer-metadata.json`;

        if (!GLib.file_test(metadataPath, GLib.FileTest.EXISTS)) {
            warnings.push('Missing lastlayer-metadata.json');
            return;
        }

        const text = this.readTextFile(metadataPath, 'ThemeValidator.validateMetadata');
        if (!text) {
            warnings.push('Cannot read metadata file');
            return;
        }

        let metadata = null;
        if (!tryRun('ThemeValidator.validateMetadata.parse', () => {
            metadata = JSON.parse(text);
        })) {
            errors.push('Invalid metadata JSON');
            return;
        }

        if (!metadata.name) {
            warnings.push('Metadata missing name field');
        }

        if (metadata.name && metadata.name !== themeName) {
            warnings.push(`Metadata name mismatch: ${metadata.name} vs ${themeName}`);
        }

        if (!metadata.version) {
            warnings.push('Metadata missing version field');
        }
    }

    validateNoPaths(themePath, warnings) {
        const files = this.getAllFiles(themePath);
        const homePattern = /\/home\/[a-zA-Z0-9_-]+\//;

        let foundHardcoded = false;

        for (const filePath of files) {
            if (this.isBinaryFile(filePath)) continue;
            const text = this.readTextFile(filePath, 'ThemeValidator.validateNoPaths');
            if (!text) {
                continue;
            }

            if (homePattern.test(text)) {
                foundHardcoded = true;
                break;
            }
        }

        if (foundHardcoded) {
            warnings.push('Some files still contain hardcoded /home/user/ paths');
        }
    }

    validateScripts(themePath, warnings) {
        const scriptsDir = `${themePath}/start-scripts`;

        if (!GLib.file_test(scriptsDir, GLib.FileTest.IS_DIR)) {
            return;
        }

        const scripts = this.listDir(scriptsDir).filter(f => f.endsWith('.sh'));

        for (const script of scripts) {
            const scriptPath = `${scriptsDir}/${script}`;
            const canExecute = tryOrDefault('ThemeValidator.validateScripts.canExecute', () => {
                const file = Gio.File.new_for_path(scriptPath);
                const info = file.query_info('access::can-execute', Gio.FileQueryInfoFlags.NONE, null);
                return info.get_attribute_boolean('access::can-execute');
            }, true);
            if (!canExecute) {
                warnings.push(`Script not executable: ${script}`);
            }
        }

        const requiredScripts = ['install_theme_apps.sh', 'set_after_install.sh'];
        for (const req of requiredScripts) {
            if (!GLib.file_test(`${scriptsDir}/${req}`, GLib.FileTest.EXISTS)) {
                warnings.push(`Missing script: ${req}`);
            }
        }
    }

    listDir(dirPath) {
        const entries = [];
        this.enumerateDirectory(
            dirPath,
            'standard::name',
            (info) => entries.push(info.get_name()),
            'ThemeValidator.listDir'
        );
        return entries;
    }

    getAllFiles(dirPath, files = []) {
        this.enumerateDirectory(
            dirPath,
            'standard::name,standard::type',
            (info) => {
                const name = info.get_name();
                const fullPath = `${dirPath}/${name}`;
                if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                    this.getAllFiles(fullPath, files);
                    return;
                }

                files.push(fullPath);
            },
            'ThemeValidator.getAllFiles'
        );
        return files;
    }

    getMissingDirectoryWarning(dir) {
        switch (dir) {
            case 'hyprland':
                return `Missing ${dir}/ directory - theme may not have hyprland config`;
            default:
                return `Missing ${dir}/ directory`;
        }
    }

    readTextFile(filePath, context) {
        return tryOrNull(context, () => {
            const [ok, content] = GLib.file_get_contents(filePath);
            return ok ? new TextDecoder().decode(content) : null;
        });
    }

    resolveSourcePath(sourcePath, baseDir) {
        if (sourcePath.startsWith('~')) {
            return null;
        }

        return sourcePath.startsWith('/') ? sourcePath : `${baseDir}/${sourcePath}`;
    }

    enumerateDirectory(dirPath, attributes, visitor, context) {
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) {
            return false;
        }

        const enumerator = tryOrNull(`${context}.open`, () => dir.enumerate_children(
            attributes,
            Gio.FileQueryInfoFlags.NONE,
            null
        ));
        if (!enumerator) {
            return false;
        }

        let info;
        while ((info = tryOrNull(`${context}.next`, () => enumerator.next_file(null)))) {
            visitor(info);
        }
        tryRun(`${context}.close`, () => enumerator.close(null));
        return true;
    }

    isBinaryFile(filePath) {
        const binaryExtensions = [
            '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
            '.ttf', '.otf', '.woff', '.woff2',
            '.zip', '.tar', '.gz', '.xz',
            '.so', '.o', '.pyc'
        ];

        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        return binaryExtensions.includes(ext);
    }
}
