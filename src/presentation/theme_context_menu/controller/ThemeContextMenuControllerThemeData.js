import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import {
    ensureArray,
    ensurePlainObject,
    firstDefined,
    firstNonEmptyString,
    isPlainObject,
    toNonNegativeCount,
    toNonNegativeNumber
} from '../../../infrastructure/utils/Utils.js';
import { themeRepositoryUrl } from '../../../infrastructure/constants/AppUrls.js';

export function applyThemeContextMenuControllerThemeData(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerThemeData.prototype);
}

class ThemeContextMenuControllerThemeData {
    determineThemeBasePath(themeName) {
        return `${this.getLocalThemesBasePath()}/${themeName}`;
    }

    determineLocalPath(themeName, explicitPath = null) {
        return firstNonEmptyString(explicitPath) || this.determineThemeBasePath(themeName);
    }

    hasMetadataSource(theme) {
        return Boolean(theme?.isLocalWithMetadata || theme?.source === 'LOCAL_WITH_METADATA');
    }

    determineThemeLabel(themeInfo, themeName) {
        return firstNonEmptyString(themeInfo.displayName, themeInfo.title, themeName) || themeName;
    }

    determineThemeDescription(themeInfo, isNetwork) {
        const fallback = this.translate(isNetwork ? 'NETWORK_THEME' : 'LOCAL_THEME');
        const description = firstNonEmptyString(themeInfo.description, fallback);
        return description || fallback;
    }

    hasLocalMetadata(themeInfo, isNetwork) {
        return !isNetwork && (
            this.hasMetadataSource(themeInfo)
            || (themeInfo.author && typeof themeInfo.author === 'object')
            || Boolean(themeInfo.repoUrl)
        );
    }

    createThemeInfoBase({
        themeName,
        displayName,
        description,
        isLocal,
        isNetwork,
        repoUrl = null,
        published = null,
        youtubeLink = null,
        author = null,
        adaptedBy = null,
        preview = null,
        tags = [],
        properties = {},
        packageSupport = [],
        installScripts = [],
        converter = null,
        includes = null,
        path = null,
        downloadCount = 0,
        averageInstallMs = null,
        averageApplyMs = null,
        installCount = 0,
        applyCount = 0
    }) {
        return {
            name: themeName,
            displayName,
            description,
            isLocal,
            isNetwork,
            repoUrl,
            published,
            youtubeLink,
            author,
            adaptedBy,
            preview,
            tags,
            properties,
            packageSupport,
            installScripts,
            converter,
            includes,
            path,
            downloadCount,
            averageInstallMs,
            averageApplyMs,
            installCount,
            applyCount
        };
    }

    buildThemeInfoFromRaw(theme, options) {
        const {
            themeName,
            displayName,
            description,
            isLocal,
            isNetwork,
            repoUrl,
            path = null
        } = options;
        const source = ensurePlainObject(theme);

        return this.createThemeInfoBase({
            themeName,
            displayName,
            description,
            isLocal,
            isNetwork,
            repoUrl,
            published: firstDefined(source.published, null),
            youtubeLink: firstDefined(source.youtubeLink, null),
            author: firstDefined(source.author, null),
            adaptedBy: firstDefined(source.adaptedBy, null),
            preview: firstDefined(source.preview, source.icon, null),
            tags: ensureArray(source.tags),
            properties: ensurePlainObject(source.properties),
            packageSupport: ensureArray(source.packageSupport),
            installScripts: ensureArray(source.installScripts),
            converter: firstDefined(source.converter, null),
            includes: firstDefined(source.includes, null),
            path,
            downloadCount: toNonNegativeCount(source.downloadCount, 0),
            averageInstallMs: toNonNegativeNumber(source.averageInstallMs, null),
            averageApplyMs: toNonNegativeNumber(source.averageApplyMs, null),
            installCount: this.toNumber(source.installCount),
            applyCount: this.toNumber(source.applyCount)
        });
    }

    determineThemeIdentity(theme, themeName) {
        return {
            resolvedName: firstNonEmptyString(theme.name, themeName) || themeName,
            resolvedTitle: firstNonEmptyString(theme.title, theme.name, themeName) || themeName
        };
    }

    buildStoreThemeInfo(theme, themeName, isNetwork) {
        const { resolvedName, resolvedTitle } = this.determineThemeIdentity(theme, themeName);
        return this.buildThemeInfoFromRaw(theme, {
            themeName: resolvedName,
            displayName: resolvedTitle,
            description: this.determineThemeDescription(theme, isNetwork),
            isLocal: !isNetwork,
            isNetwork,
            repoUrl: isNetwork
                ? firstNonEmptyString(theme.repoUrl, theme.repository, themeRepositoryUrl(themeName))
                : firstNonEmptyString(theme.repoUrl),
            path: isNetwork ? null : this.determineLocalPath(themeName, theme.path)
        });
    }

    prepareThemeContextMenuData(themeName, isNetwork, themeOverride = null) {
        const themeInfo = this.determineThemeInfo(themeName, isNetwork, themeOverride);
        const converter = isPlainObject(themeInfo.converter) ? themeInfo.converter : null;
        const hasMetadata = this.hasLocalMetadata(themeInfo, isNetwork);
        const useNetworkData = isNetwork || hasMetadata;
        const displayName = this.determineThemeLabel(themeInfo, themeName);
        const description = this.determineThemeDescription(themeInfo, isNetwork);
        const tags = ensureArray(themeInfo.tags);
        const properties = ensurePlainObject(themeInfo.properties);
        const packageSupport = ensureArray(themeInfo.packageSupport);
        const installScripts = ensureArray(themeInfo.installScripts);

        const repositoryUrl = this.getRepositoryUrl(themeInfo, themeName, isNetwork);
        const repositoryName = firstNonEmptyString(
            themeInfo.repositoryName,
            this.translate(isNetwork ? 'REPOSITORY_NAME_REMOTE' : 'REPOSITORY_NAME_LOCAL')
        );

        return {
            success: true,
            theme: {
                id: firstDefined(themeInfo.id, null),
                name: themeName,
                displayName,
                description,
                isLocal: !isNetwork,
                isNetwork,
                isLocalWithMetadata: hasMetadata,
                preview: firstDefined(themeInfo.preview, themeInfo.icon, null),
                tags,
                repoUrl: repositoryUrl,
                published: firstDefined(themeInfo.published, null),
                youtubeLink: firstDefined(themeInfo.youtubeLink, null),
                path: isNetwork ? null : this.determineLocalPath(themeName, themeInfo.path),
                author: firstDefined(themeInfo.author, null),
                adaptedBy: firstDefined(themeInfo.adaptedBy, null),
                installScripts,
                properties,
                packageSupport,
                downloadCount: this.toNumber(themeInfo.downloadCount),
                averageInstallMs: toNonNegativeNumber(themeInfo.averageInstallMs, null),
                averageApplyMs: toNonNegativeNumber(themeInfo.averageApplyMs, null),
                installCount: this.toNumber(themeInfo.installCount),
                applyCount: this.toNumber(themeInfo.applyCount),
                includes: firstDefined(themeInfo.includes, null)
            },
            repository: {
                url: repositoryUrl,
                name: repositoryName,
                description: this.translate(useNetworkData ? 'REPOSITORY_DESC_REMOTE' : 'REPOSITORY_DESC_LOCAL'),
                hasRepository: Boolean(repositoryUrl),
                published: firstDefined(themeInfo.published, null),
                youtubeLink: firstDefined(themeInfo.youtubeLink, null)
            },
            author: this.getAuthorInfo(themeInfo, useNetworkData),
            adaptedBy: this.getAdaptedInfo(themeInfo),
            properties: {
                badges: properties,
                isNew: false,
                isUpdated: false
            },
            packages: {
                supported: packageSupport,
                total: packageSupport.length
            },
            converter: {
                available: Boolean(themeInfo.converter),
                version: converter ? firstDefined(converter.version, null) : null
            },
            scripts: {
                available: installScripts,
                selected: installScripts[0] || null
            },
            isNetwork,
            useNetworkData,
            includes: firstDefined(themeInfo.includes, null),
            message: 'Context menu data prepared successfully'
        };
    }

    parseThemeOverride(theme, themeName, isNetwork) {
        const resolvedName = firstNonEmptyString(theme.name, themeName) || themeName;
        const localPath = isNetwork ? null : this.determineLocalPath(themeName, theme.path);
        const baseInfo = this.buildThemeInfoFromRaw(theme, {
            themeName: resolvedName,
            displayName: firstNonEmptyString(theme.title, theme.name, themeName) || themeName,
            description: this.determineThemeDescription(theme, isNetwork),
            isLocal: !isNetwork,
            isNetwork: Boolean(theme.isNetwork) || isNetwork,
            repoUrl: firstNonEmptyString(theme.repoUrl, theme.repository),
            path: localPath
        });
        return {
            ...baseInfo,
            id: firstDefined(theme.id, null),
            isLocalWithMetadata: this.hasMetadataSource(theme),
            redditUrl: firstDefined(theme.redditUrl, null),
            redditUpvotes: this.toNumber(theme.redditUpvotes),
            redditComments: this.toNumber(theme.redditComments),
            redditTitle: firstNonEmptyString(theme.redditTitle, theme.title)
        };
    }

    getThemeInfoFromStore(themeName, isNetwork) {
        const store = this.getThemeSelectorStore();
        const state = (store && typeof store.getState === 'function') ? store.getState() : {};
        const themes = ensureArray(isNetwork ? state.networkThemes : state.localThemes);
        const found = themes.find((theme) => isPlainObject(theme) && theme.name === themeName);
        return found
            ? (isNetwork ? this.parseNetworkTheme : this.parseLocalTheme).call(this, found, themeName)
            : this.createDefaultThemeInfo(themeName, isNetwork);
    }

    parseNetworkTheme(theme, themeName) {
        const baseInfo = this.buildStoreThemeInfo(theme, themeName, true);
        return {
            ...baseInfo,
            id: firstDefined(theme.id, null)
        };
    }

    parseLocalTheme(theme, themeName) {
        const baseInfo = this.buildStoreThemeInfo(theme, themeName, false);
        return {
            ...baseInfo,
            source: firstNonEmptyString(theme.source, 'local') || 'local',
            status: firstNonEmptyString(theme.status, 'installed') || 'installed',
            isLocalWithMetadata: this.hasMetadataSource(theme),
            metadata: firstDefined(theme.metadata, null),
            metadataPath: firstNonEmptyString(theme.metadataPath, theme.path ? `${theme.path}/lastlayer-metadata.json` : null)
        };
    }

    createDefaultThemeInfo(themeName, isNetwork) {
        const baseInfo = this.createThemeInfoBase({
            themeName,
            displayName: themeName,
            description: this.translate(isNetwork ? 'NETWORK_THEME' : 'LOCAL_THEME'),
            isLocal: !isNetwork,
            isNetwork,
            path: isNetwork ? null : this.determineThemeBasePath(themeName)
        });
        return {
            ...baseInfo,
            isLocalWithMetadata: false
        };
    }

    getRepositoryUrl(themeInfo, themeName, isNetwork) {
        const localPath = this.determineThemeBasePath(themeName);
        return firstNonEmptyString(
            ...(isNetwork
                ? [themeInfo.repoUrl, themeInfo.repository, themeRepositoryUrl(themeName)]
                : [themeInfo.repoUrl, themeInfo.path, localPath])
        ) || localPath;
    }

    getAuthorInfo(themeInfo, useNetworkData) {
        let defaultAuthor = {name: null, url: '', avatar: null},
            author = themeInfo.author;
        if (!useNetworkData || !author) return defaultAuthor;

        function standardizeName(value) {
            let text = typeof value === 'string' ? value.trim() : '';
            return (!text || text.toLowerCase() === 'unknown') ? null : text;
        }

        return typeof author === 'object'
            ? {
                name: standardizeName(firstNonEmptyString(author.label, author.name)) ?? defaultAuthor.name,
                url: firstNonEmptyString(author.url, defaultAuthor.url) || defaultAuthor.url,
                avatar: firstDefined(author.avatar, defaultAuthor.avatar)
            }
            : {name: standardizeName(author) ?? defaultAuthor.name, url: '', avatar: null};
    }

    getAdaptedInfo(themeInfo) {
        const adapted = themeInfo.adaptedBy;
        const data = adapted
            ? (typeof adapted === 'object' ? adapted : {name: adapted, url: '', avatar: null})
            : null;
        return data
            ? {
            name: firstNonEmptyString(data.label, data.name, '') || '',
            url: firstNonEmptyString(data.url, '') || '',
            avatar: firstDefined(data.avatar, null)
        }
            : null;
    }

    getThemeSelectorStore() {
        if (this.themeSelectorStore === undefined) {
            this.themeSelectorStore = this.container?.get?.('themeSelectorStore') ?? null;
        }
        return this.themeSelectorStore;
    }

    toNumber(value, defaultValue = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : defaultValue;
    }

}
