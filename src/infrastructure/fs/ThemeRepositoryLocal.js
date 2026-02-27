import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {
    parseLink,
    toNonNegativeInt,
    standardizeOptionalNumber,
    decodeBytes,
    fileExists
} from '../utils/Utils.js';
import { tryOrNull } from '../utils/ErrorUtils.js';

const DEFAULT_PLACEHOLDER_ICON = `${GLib.get_current_dir()}/assets/no_preview.png`;
const isDirectoryLike = (type) => type === Gio.FileType.DIRECTORY || type === Gio.FileType.SYMBOLIC_LINK;

class ThemeRepositoryLocal {
    listThemeNames() {
        const themesDir = Gio.File.new_for_path(this.basePath);
        return !themesDir.query_exists(null) ? [] : (() => {
            let names = [],
                enumerator = themesDir.enumerate_children('standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE, null),
                info;
            while ((info = enumerator.next_file(null))) {
                let name = info.get_name();
                isDirectoryLike(info.get_file_type()) && name && !name.startsWith('.') && names.push(name);
            }
            enumerator.close(null);
            names.sort((a, b) => (b === 'default') - (a === 'default') || a.localeCompare(b));
            return names;
        })();
    }

    buildThemesFromNames(names) {
        const themes = [];
        for (const name of names) {
            fileExists(`${this.basePath}/${name}`) && themes.push(this.loadLocalTheme(name));
        }
        return themes;
    }

    getLocalThemes() {
        const cached = this.getCachedThemesClone();
        return cached ? cached : (() => {
            let names = this.listThemeNames(),
                themes = this.buildThemesFromNames(names);
            this.themesCache = themes;
            this.cacheTimestamp = Date.now();
            return this.cloneThemes(themes);
        })();
    }

    waitNextMainLoopTick() {
        return new Promise((resolve) => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    async getLocalThemesAsync(options = {}) {
        const {batchSize = 8, onProgress = null, force = false, useMainLoopYield = true} = options;
        const cached = force ? null : this.getCachedThemesClone();
        return cached
            ? (onProgress?.(cached.length, cached.length), cached)
            : await (() => this.getLocalThemesAsyncUncached({batchSize, onProgress, useMainLoopYield}))();
    }

    async getLocalThemesAsyncUncached({batchSize, onProgress, useMainLoopYield}) {
        const names = this.listThemeNames();
        const total = names.length;
        const hasThemes = total > 0;
        if (!hasThemes) {
            this.themesCache = [];
            this.cacheTimestamp = Date.now();
            onProgress?.(0, 0);
            return [];
        }

        const themes = [];
        let index = 0;

        while (index < total) {
            const batchEnd = Math.min(index + Math.max(1, Number(batchSize) || 8), total);
            while (index < batchEnd) {
                const name = names[index++];
                const theme = this.loadLocalTheme(name);
                theme && themes.push(theme);
            }
            onProgress?.(themes.length, total);
            index < total && useMainLoopYield && await this.waitNextMainLoopTick();
        }

        this.themesCache = themes;
        this.cacheTimestamp = Date.now();
        return this.cloneThemes(themes);
    }

    determineIconPath(name, themesPath) {
        const iconPath = `${GLib.get_home_dir()}/.config/ags/assets/icons/${name}.png`;
        const previewPath = `${themesPath}/${name}/preview.png`;
        return [iconPath, previewPath].find(path => fileExists(path)) || DEFAULT_PLACEHOLDER_ICON;
    }

    determineMetadataInfo(name, themesPath) {
        return [
            {path: `${themesPath}/${name}/lastlayer-metadata.json`, isLastLayer: true},
            {path: `${themesPath}/${name}/metadata.json`, isLastLayer: false}
        ].find(({path}) => fileExists(path)) || null;
    }

    readJsonFile(path, errorMessage) {
        let warn = () => errorMessage && this.logger?.warn?.(`[ThemeRepository] ${errorMessage}`);
        let [ok, contents] = tryOrNull(
            'ThemeRepositoryLocal.readJsonFile.read', () => GLib.file_get_contents(path)
        ) || [];
        if (!ok || !contents) { warn(); return null; }
        let parsed = tryOrNull(
            'ThemeRepositoryLocal.readJsonFile.parse', () => JSON.parse(decodeBytes(contents))
        );
        parsed || warn();
        return parsed;
    }

    loadLocalTheme(name) {
        const themesPath = this.basePath;

        const themeObj = {
            name,
            title: name,
            icon: this.determineIconPath(name, themesPath),
            source: 'local',
            path: `${themesPath}/${name}`,
            metadata: {},
            isLocal: () => true,
            hasScripts: () => false,
            downloadCount: 0,
            averageInstallMs: null,
            averageApplyMs: null,
            installCount: 0,
            applyCount: 0
        };

        const metadataInfo = this.determineMetadataInfo(name, themesPath);
        const metadataPath = metadataInfo?.path || null;
        if (!metadataPath) return themeObj;

        const metadata = this.readJsonFile(metadataPath, `Failed to parse metadata for ${name}`);
        if (!metadata) return themeObj;

        const originalIcon = themeObj.icon;
        themeObj.metadata = metadata;
        themeObj.metadataPath = metadataPath;
        const hasOriginalTheme = Boolean((metadataInfo?.isLastLayer || false) && metadata.originalTheme);
        const themeSource = hasOriginalTheme ? metadata.originalTheme : metadata;
        const fallbackTags = Array.isArray(themeSource.tags)
            ? themeSource.tags
            : (Array.isArray(themeSource.topics) ? themeSource.topics : []);
        const baseMetadata = {
            isLocalWithMetadata: true,
            source: 'LOCAL_WITH_METADATA',
            id: themeSource.id || null,
            title: (hasOriginalTheme ? (themeSource.name || themeSource.title) : themeSource.name) || name,
            version: metadata.version || '1.0.0',
            repoUrl: hasOriginalTheme ? (themeSource.repoUrl || '') : (themeSource.repoUrl || themeSource.repository?.url || ''),
            published: themeSource.published || '',
            youtubeLink: themeSource.youtubeLink || '',
            archiveUrl: themeSource.archiveUrl || '',
            previewUrl: themeSource.previewUrl || '',
            author: this.parseAuthor(themeSource.author),
            adaptedBy: parseLink(themeSource.adaptedBy),
            properties: themeSource.properties ?? {},
            tags: fallbackTags,
            packageSupport: themeSource.packageSupport ?? {},
            installScripts: themeSource.installScripts ?? [],
            downloadCount: toNonNegativeInt(themeSource.downloadCount),
            averageInstallMs: standardizeOptionalNumber(themeSource.averageInstallMs, true),
            averageApplyMs: standardizeOptionalNumber(themeSource.averageApplyMs, true),
            installCount: toNonNegativeInt(themeSource.installCount),
            applyCount: toNonNegativeInt(themeSource.applyCount),
            description: hasOriginalTheme
                ? (themeSource.description || '')
                : (themeSource.description || themeSource.readme?.substring(0, 200) || ''),
            storedAt: hasOriginalTheme ? metadata.storedAt : (metadata.lastUpdate || metadata.updatedAt),
            storedFrom: hasOriginalTheme ? (metadata.storedFrom || 'network') : 'repository'
        };
        Object.assign(themeObj, baseMetadata);

        themeObj.icon = originalIcon;
        return themeObj;
    }

    parseAuthor(author) {
        if (!author) return null;
        let source = typeof author === 'string'
                ? {name: author}
                : (typeof author === 'object' ? author : null),
            name = source?.name || source?.login || source?.label;
        if (!name) return null;
        return {
            name, label: name, url: source.url || source.html_url || '',
            ...(source.name && {email: source.email || '', bio: source.bio || ''}),
            ...(!source.name && source.email && {email: source.email})
        };
    }
}

export function applyThemeRepositoryLocal(prototype) {
    copyPrototypeDescriptors(prototype, ThemeRepositoryLocal.prototype);
}
