import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import {
    ensureArray,
    ensurePlainObject,
    firstDefined,
    firstNonEmptyString,
    getThemePath,
    toNonNegativeCount,
    toNonNegativeNumber
} from '../../../infrastructure/utils/Utils.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

class ThemeContextMenuControllerThemeMetadata {
    determineThemeInfo(themeName, isNetwork, themeOverride) {
        let themeInfo = (themeOverride && typeof themeOverride === 'object')
            ? this.parseThemeOverride(themeOverride, themeName, isNetwork)
            : this.getThemeInfoFromStore(themeName, isNetwork);

        themeInfo = (!isNetwork && (!themeInfo.name || !themeInfo.displayName))
            ? (this.loadLocalThemeFromRepository(themeName) || themeInfo)
            : themeInfo;

        if (isNetwork) return themeInfo;

        const localPath = this.determineLocalPath(themeName, themeInfo.path),
              localThemeInfo = {...themeInfo, path: localPath},
              metadata = this.loadLocalMetadata(themeName, localPath);
        return metadata ? this.mergeMetadata(localThemeInfo, metadata) : localThemeInfo;
    }

    loadLocalThemeFromRepository(themeName) {
        const localTheme = this.themeRepository.loadLocalTheme(themeName);
        return localTheme ? this.parseLocalTheme(localTheme, themeName) : null;
    }

    loadLocalMetadata(themeName, themePath = null) {
        const basePath = this.determineLocalPath(themeName, themePath);
        const metadataPath = `${basePath}/lastlayer-metadata.json`;
        const [ok, buffer] = tryOrNull(
            'ThemeContextMenuControllerThemeData.loadLocalMetadata.read',
            () => GLib.file_get_contents(metadataPath)
        ) || [];
        const raw = ok && buffer
            ? tryOrNull(
                'ThemeContextMenuControllerThemeData.loadLocalMetadata.parse',
                () => JSON.parse(new TextDecoder('utf-8').decode(buffer))
            )
            : null;
        return raw === null
            ? null
            : {
                raw,
                originalTheme: firstDefined(ensurePlainObject(raw).originalTheme, raw),
                metadataPath
            };
    }

    mergeMetadata(themeInfo, metadataBundle) {
        const bundle = ensurePlainObject(metadataBundle);
        const original = ensurePlainObject(bundle.originalTheme || bundle);
        const metadataPath = firstDefined(bundle.metadataPath, themeInfo.metadataPath, null);
        const tags = ensureArray(original.tags);
        const packageSupport = ensureArray(original.packageSupport);
        const installScripts = ensureArray(original.installScripts);

        return {
            ...themeInfo,
            isLocalWithMetadata: true,
            metadata: firstDefined(bundle.raw, themeInfo.metadata, null),
            metadataPath,
            repoUrl: firstDefined(original.repoUrl, themeInfo.repoUrl, null),
            published: firstDefined(original.published, themeInfo.published, null),
            youtubeLink: firstDefined(original.youtubeLink, themeInfo.youtubeLink, null),
            author: firstDefined(original.author, themeInfo.author, null),
            adaptedBy: firstDefined(original.adaptedBy, themeInfo.adaptedBy, null),
            preview: firstDefined(themeInfo.preview, themeInfo.icon, null),
            tags: tags.length > 0 ? tags : ensureArray(themeInfo.tags),
            properties: Object.keys(ensurePlainObject(original.properties)).length > 0
                ? ensurePlainObject(original.properties)
                : ensurePlainObject(themeInfo.properties),
            packageSupport: packageSupport.length > 0 ? packageSupport : ensureArray(themeInfo.packageSupport),
            installScripts: installScripts.length > 0 ? installScripts : ensureArray(themeInfo.installScripts),
            converter: firstDefined(original.converter, themeInfo.converter, null),
            includes: firstDefined(original.includes, themeInfo.includes, null),
            downloadCount: toNonNegativeCount(
                firstDefined(original.downloadCount, themeInfo.downloadCount)
            ),
            averageInstallMs: toNonNegativeNumber(
                firstDefined(original.averageInstallMs, themeInfo.averageInstallMs)
            ),
            averageApplyMs: toNonNegativeNumber(
                firstDefined(original.averageApplyMs, themeInfo.averageApplyMs)
            ),
            installCount: this.toNumber(
                firstDefined(original.installCount, themeInfo.installCount)
            ),
            applyCount: this.toNumber(
                firstDefined(original.applyCount, themeInfo.applyCount)
            )
        };
    }

    getLocalThemesBasePath() {
        const settingsLocalThemesPath = this.settingsService?.getAll?.()?.localThemesPath;
        return firstNonEmptyString(
            this.themeRepository?.basePath,
            settingsLocalThemesPath,
            `${GLib.get_home_dir()}/.config/themes`
        );
    }

    getLocalThemePath(themeName, theme = null) {
        return getThemePath(themeName, { theme, basePath: this.themeRepository?.basePath });
    }
}

export function applyThemeContextMenuControllerThemeMetadata(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuControllerThemeMetadata.prototype);
}
