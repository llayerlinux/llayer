import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import {ARCHIVE_EXT_REGEX, EXTRACT_DIR_SUFFIX, PREVIEW_CURL_ARGS} from './DownloadRiceUseCaseConstants.js';
import {findExistingNamedDir, findSubdirWithHyprland, getSubdirs} from '../../../infrastructure/utils/FileExecUtils.js';
import {parseLink} from '../../../infrastructure/utils/Utils.js';

class DownloadRiceUseCaseInstall {
    sanitizeThemeName(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    installDownloadedTheme(theme, archivePath) {
        const baseName = this.sanitizeThemeName([theme?.slug, theme?.name, theme?.title].find(Boolean) || 'theme') || `theme-${Date.now()}`,
            themesDir = GLib.get_home_dir() + '/.config/themes';
        this.ensureDirectory(themesDir);

        let finalName = baseName, counter = 1;
        while (Gio.File.new_for_path(`${themesDir}/${finalName}`).query_exists(null)) {
            finalName = `${baseName}-${counter++}`;
        }

        const extension = this.getArchiveExtension([archivePath, theme?.archiveUrl, theme?.url].find(Boolean) || ''),
            extractDir = archivePath.replace(ARCHIVE_EXT_REGEX, EXTRACT_DIR_SUFFIX),
            targetThemePath = `${themesDir}/${finalName}`;
        this.ensureDirectory(extractDir);
        Gio.File.new_for_path(targetThemePath).query_exists(null) && this.removeDirectorySync(targetThemePath);

        const extractResult = this.extractArchiveSync(archivePath, extractDir, extension);
        if (extractResult?.success === false) return {path: null, name: null, error: extractResult.error};

        this.moveFilesSync(extractDir, targetThemePath);
        this.cleanupSync(archivePath, extractDir);

        return {path: targetThemePath, name: finalName};
    }

    async findThemeSourceDirectory(zipPath, extractDir, baseName, theme, execAsync) {
        let possibleNames = [baseName, theme.title, theme.name].filter(Boolean),
            earlyMatch = zipPath.toLowerCase().endsWith('.tar.xz') && (
                findExistingNamedDir(extractDir, possibleNames)
                || (await getSubdirs(extractDir, execAsync, 1))[0]
            );
        if (earlyMatch) return earlyMatch;

        let allSubdirs = await getSubdirs(extractDir, execAsync);
        return findSubdirWithHyprland(allSubdirs)
            || findExistingNamedDir(extractDir, possibleNames)
            || allSubdirs[0]
            || extractDir;
    }

    async postExtractActions(theme, targetThemePath) {
        const rawThemeName = theme?.localName || theme?.name || theme?.title,
            themeName = typeof rawThemeName === 'string' ? rawThemeName.trim() : '',
            metadataPayload = (themeName && targetThemePath) ? this.buildThemeMetadata(theme) : null;
        if (!metadataPayload) return;

        this.writeMetadataFile(targetThemePath, metadataPayload);
        typeof this.themeRepository?.writeThemeMetadata === 'function'
            && await this.themeRepository.writeThemeMetadata(themeName, metadataPayload);
        await this.ensurePreviewAsset(theme, targetThemePath);
    }

    buildThemeMetadata(theme) {
        const themeData = theme ?? {};

        const toArray = (value) => {
            if (!value) return [];
            return Array.isArray(value)
                ? value.map(item => (item == null ? '' : String(item).trim())).filter(Boolean)
                : (typeof value === 'string'
                    ? value.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean)
                    : (typeof value === 'object'
                        ? Object.keys(value).filter(key => value[key]).map(key => key.trim()).filter(Boolean)
                        : []));
        };

        const parseProperties = (props) => {
            const defaults = {
                multiConfig: false,
                desktopPlus: false,
                familiar: false,
                widgets: false,
                unique: false
            };

            if (!props || typeof props !== 'object') return defaults;

            return {
                multiConfig: Boolean(props.multiConfig),
                desktopPlus: Boolean(props.desktopPlus),
                familiar: Boolean(props.familiar),
                widgets: Boolean(props.widgets),
                unique: Boolean(props.unique)
            };
        };

        const now = new Date().toISOString();
        const themeName = themeData.name || themeData.title || '';
        return {
            originalTheme: {
                id: themeData.id || null,
                name: themeName,
                repoUrl: themeData.repoUrl || '',
                author: parseLink(themeData.author),
                adaptedBy: parseLink(themeData.adaptedBy),
                properties: parseProperties(themeData.properties),
                tags: toArray(themeData.tags),
                packageSupport: toArray(themeData.packageSupport),
                installScripts: themeData.installScripts || null,
                previewUrl: themeData.previewUrl || themeData.preview || '',
                downloadCount: themeData.downloadCount || 0,
                description: themeData.description || ''
            },
            storedAt: now,
            storedFrom: themeData.serverUrl || 'network',
            version: '1.0'
        };
    }

    async ensurePreviewAsset(theme, targetDir) {
        let previewFile = Gio.File.new_for_path(`${targetDir}/preview.png`);
        if (previewFile.query_exists(null)) return;

        let rawUrl = (theme ?? {}).previewUrl || (theme ?? {}).preview;
        if (!rawUrl) return;

        let base = ((theme ?? {}).serverUrl || this.networkThemeService?.settingsService?.getNetworkThemeSettings?.()?.serverAddress || '').replace(/\/$/, '');
        let previewUrl = rawUrl.startsWith('http') ? rawUrl
            : base ? (rawUrl.startsWith('/') ? `${base}${rawUrl}` : `${base}/${rawUrl}`)
            : null;
        if (!previewUrl) return;

        let tempFile = Gio.File.new_for_path(`${targetDir}/preview.tmp`);
        tempFile.query_exists(null) && tempFile.delete(null);

        await this.execAsync([Commands.CURL, ...PREVIEW_CURL_ARGS, '-o', `${targetDir}/preview.tmp`, previewUrl]);

        tempFile.query_exists(null) && tempFile.move(previewFile, Gio.FileCopyFlags.OVERWRITE, null, null);
    }

    writeMetadataFile(targetDir, metadata) {
        const dir = Gio.File.new_for_path(targetDir);
        !dir.query_exists(null) && dir.make_directory_with_parents(null);

        const metadataPath = `${targetDir}/lastlayer-metadata.json`;
        GLib.file_set_contents(metadataPath, JSON.stringify(metadata, null, 2));
    }
}

export function applyDownloadRiceUseCaseInstall(targetProto) {
    copyPrototypeDescriptors(targetProto, DownloadRiceUseCaseInstall.prototype);
}
