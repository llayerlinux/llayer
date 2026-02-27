import GLib from 'gi://GLib';
import { applyThemeRepositoryCache } from './ThemeRepositoryCache.js';
import { applyThemeRepositoryLocal } from './ThemeRepositoryLocal.js';
import { applyThemeRepositoryMonitoring } from './ThemeRepositoryMonitoring.js';
import { applyThemeRepositoryNetwork } from './ThemeRepositoryNetwork.js';
import { applyThemeRepositoryOverrides } from './ThemeRepositoryOverrides.js';

export class ThemeRepository {
    constructor(logger = null, translator = null) {
        this.basePath = `${GLib.get_home_dir()}/.config/themes`;
        this.metadataCache = new Map();
        this.themesCache = null;
        this.cacheTimestamp = 0;
        this.cacheTimeout = 30000;
        this.logger = logger || null;
        this.translator = typeof translator === 'function' ? translator : null;

        this.dirMonitor = null;
        this.debounceTimer = null;
        this.monitorCallbacks = new Set();
        this.setupDirectoryMonitoring();
    }

    logWarn(message, data = null) {
        this.logger.warn(`[ThemeRepository] ${message}`, data);
    }

    translate(key, params = null) {
        const value = this.translator?.(key, params ?? undefined);
        return typeof value === 'string' ? value : (typeof key === 'string' ? key : '');
    }
}

applyThemeRepositoryCache(ThemeRepository.prototype);
applyThemeRepositoryLocal(ThemeRepository.prototype);
applyThemeRepositoryMonitoring(ThemeRepository.prototype);
applyThemeRepositoryNetwork(ThemeRepository.prototype);
applyThemeRepositoryOverrides(ThemeRepository.prototype);
