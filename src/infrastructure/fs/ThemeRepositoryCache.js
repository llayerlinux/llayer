import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
class ThemeRepositoryCache {
    invalidateCache() {
        this.themesCache = null;
        this.cacheTimestamp = 0;
        this.metadataCache.clear();
    }

    cloneThemes(themes) {
        return themes.map((theme) => ({...theme}));
    }

    getCachedThemesClone() {
        return (this.themesCache && (Date.now() - this.cacheTimestamp) < this.cacheTimeout)
            ? this.cloneThemes(this.themesCache)
            : null;
    }

    clearCache() {
        this.invalidateCache();
    }
}

export function applyThemeRepositoryCache(prototype) {
    copyPrototypeDescriptors(prototype, ThemeRepositoryCache.prototype);
}
