import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';
import { tryRun } from '../utils/ErrorUtils.js';

export class ThemeTagService {
    constructor(themeRepository, logger = null, auditLog = null) {
        this._native = createAuditedNative(new LastlayerSupporter.ThemeTagService(), 'ThemeTagService', auditLog);
        this.themeRepository = themeRepository;
        this.logger = logger;
        this._cacheTimestamp = 0;
        this._cacheTimeout = 30000;
    }

    syncThemes() {
        const now = Date.now();
        if (now - this._cacheTimestamp < this._cacheTimeout) return;

        const themes = this.themeRepository.getLocalThemes?.() ?? [];
        const data = themes.map(t => ({
            name: t.name ?? '',
            title: t.title ?? t.name ?? '',
            tags: t.tags ?? [],
            path: t.path ?? ''
        }));

        if (!tryRun('ThemeTagService.syncThemes', () => {
            this._native.set_themes(JSON.stringify(data));
        })) {
            return;
        }

        this._cacheTimestamp = now;
    }

    getAllTags() {
        this.syncThemes();
        return JSON.parse(this._native.get_all_tags());
    }

    getTagThemeMap() {
        this.syncThemes();
        const groups = JSON.parse(this._native.get_tag_groups());
        const map = new Map();
        for (const [tag, themes] of Object.entries(groups.ambiguous ?? {})) {
            map.set(tag, themes);
        }
        for (const [tag, theme] of Object.entries(groups.unique ?? {})) {
            map.set(tag, [theme]);
        }
        return map;
    }

    getThemesByTag(tag) {
        this.syncThemes();
        return JSON.parse(this._native.get_themes_by_tag(tag));
    }

    getThemesByTagFiltered(tag, allowedThemeNames) {
        this.syncThemes();
        return JSON.parse(this._native.get_themes_by_tag_filtered(tag, allowedThemeNames));
    }

    getTagsFromThemes(themeNames) {
        this.syncThemes();
        return JSON.parse(this._native.get_tags_from_themes(themeNames));
    }

    getThemesWithTags() {
        this.syncThemes();
        return JSON.parse(this._native.get_themes_with_tags());
    }

    getTagGroups() {
        this.syncThemes();
        const result = JSON.parse(this._native.get_tag_groups());
        return {
            ambiguous: new Map(Object.entries(result.ambiguous ?? {})),
            unique: new Map(Object.entries(result.unique ?? {}))
        };
    }

    formatTagsForPrompt() {
        this.syncThemes();
        return this._native.format_tags_for_prompt();
    }

    formatDisambiguationPrompt(selectedTag) {
        this.syncThemes();
        return this._native.format_disambiguation_prompt(selectedTag);
    }

    invalidateCache() {
        this._cacheTimestamp = 0;
        this._native.invalidate_cache();
    }

    log(level, message, data = null) { this.logger?.[level]?.('ThemeTagService', message, data); }
    destroy() { this._native.destroy(); }
}
