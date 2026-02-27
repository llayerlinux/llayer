import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrNull } from '../utils/ErrorUtils.js';
import { decodeBytes, applyParams } from '../utils/Utils.js';

const currentDir = GLib.get_current_dir();

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonEmptyObject = (value) => value && typeof value === 'object' && Object.keys(value).length > 0;

function buildTranslationCandidates(pathValue) {
    const normalized = isNonEmptyString(pathValue) ? pathValue.trim() : '';
    return normalized
        ? (normalized.endsWith('.js') ? [normalized] : [normalized, `${normalized}.js`])
        : [];
}

export class TranslationService {
    constructor(options = {}) {
        this.translationsPath = options.translationsPath
            || GLib.build_filenamev([currentDir, 'src', 'infrastructure', 'i18n', 'translations']);
        this.translations = {};
        this.languageOverride = null;
        this.availableLanguages = [];
        this.languageListeners = new Set();
        this.translatorFn = null;
        this.diContainer = options.diContainer || null;
        this.settingsService = options.settingsService || null;

        this.loadTranslations();
    }

    parseDefaultExportObject(sourceText) {
        const source = typeof sourceText === 'string' ? sourceText : '',
            match = source.match(/export\s+default\s+(\{[\s\S]*\});?\s*$/);
        return (source.length && match)
            ? (() => {
                const result = tryOrNull('TranslationService.parseDefaultExportObject', () => new Function(`return (${match[1]})`)());
                return (result && typeof result === 'object') ? result : {};
            })()
            : {};
    }

    loadTranslationsFromFile(file) {
        let path = file?.get_path?.();
        return path
            ? (() => {
                let result = tryOrNull('TranslationService.loadTranslationsFromFile', () => GLib.file_get_contents(path)),
                    [ok, content] = result || [];
                return ok && content ? this.parseDefaultExportObject(decodeBytes(content)) : {};
            })()
            : {};
    }

    loadTranslationsFromDirectory(dir) {
        if (!dir) return {};

        const bundlesByLang = new Map();
        let enumerator = tryOrNull(
            'TranslationService.loadTranslationsFromDirectory.enumerate',
            () => dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
        );
        if (!enumerator) return {};

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            let name = info.get_name();
            if (
                info.get_file_type() !== Gio.FileType.REGULAR
                || !name
                || !name.endsWith('.js')
                || !name.slice(0, -3).trim()
                || name.slice(0, -3).trim() === 'index'
            ) continue;

            let bundle = this.loadTranslationsFromFile(dir.get_child(name));
            isNonEmptyObject(bundle) && bundlesByLang.set(name.slice(0, -3).trim(), bundle);
        }
        enumerator.close(null);

        let result = {};
        for (const lang of [...bundlesByLang.keys()].sort((a, b) => a.localeCompare(b))) {
            result[lang] = bundlesByLang.get(lang);
        }
        return result;
    }

    loadTranslations() {
        let loaded = {};

        let candidates = buildTranslationCandidates(this.translationsPath);
        candidates.some((candidate) => {
            const file = tryOrNull('TranslationService.loadTranslations.file', () => Gio.File.new_for_path(candidate));
            if (!file || !file.query_exists(null)) return false;

            const type = tryOrNull('TranslationService.loadTranslations.fileType', () =>
                file.query_file_type(Gio.FileQueryInfoFlags.NONE, null)
            );
            if (!type) return false;

            loaded = (type === Gio.FileType.DIRECTORY)
                ? this.loadTranslationsFromDirectory(file)
                : this.loadTranslationsFromFile(file);
            return isNonEmptyObject(loaded);
        });

        this.translations = (loaded && typeof loaded === 'object') ? loaded : {};
        this.availableLanguages = Object.keys(this.translations);
        this.bindGlobals();
        this.notifyLanguageChanged();
        return this.translations;
    }

    setDependencies(diContainer, settingsService) {
        this.diContainer = diContainer || this.diContainer;
        this.settingsService = settingsService || this.settingsService;
        this.bindGlobals();
    }

    getTranslations() {
        return this.translations;
    }

    getAvailableLanguages() {
        return [...this.availableLanguages];
    }

    getCurrentLanguage() {
        return this.getLanguage();
    }

    setLanguageOverride(langCode) {
        this.languageOverride = isNonEmptyString(langCode)
            ? (this.parseLanguageCandidates(langCode).find((candidate) => this.translations?.[candidate]) || null)
            : null;
        this.notifyLanguageChanged();
    }

    notifyLanguageChanged() {
        const lang = this.getLanguage();
        for (const listener of this.languageListeners) {
            listener(lang);
        }
    }

    translateInternal(key, params = null) {
        if (key == null) return '';

        let normalizedKey = String(key);
        let matchedLang = this.buildPriorityLanguages().find(
            (langCode) => this.translations?.[langCode]
                && Object.prototype.hasOwnProperty.call(this.translations[langCode], normalizedKey)
        );
        if (matchedLang) {
            let value = this.translations[matchedLang][normalizedKey];
            return (typeof value === 'string' && params) ? applyParams(value, params) : value;
        }

        return (params && typeof params === 'object' && !Array.isArray(params))
            ? applyParams(normalizedKey, params)
            : normalizedKey;
    }

    getLanguage() {
        let DI = this.diContainer;
        let trySources = [
            this.languageOverride,
            DI?.has?.('appSettingsStore') ? DI.get('appSettingsStore')?.snapshot?.settings?.language : null,
            this.settingsService?.getSettings?.()?.language || this.settingsService?.settings?.language,
            GLib.getenv('LANG'),
            'en'
        ];

        const determineFromSource = (source) => {
            return source
                ? (this.parseLanguageCandidates(source)
                    .find((candidate) => this.translations?.[candidate]) || null)
                : null;
        };

        for (const source of trySources) {
            const resolved = determineFromSource(source);
            if (resolved) return resolved;
        }
        return this.availableLanguages[0] || 'en';
    }

    parseLanguageCandidates(langCode) {
        if (!langCode || typeof langCode !== 'string') return [];

        const trimmed = langCode.trim();
        const underscore = trimmed.toLowerCase().replace('-', '_');
        const variants = [];
        [trimmed, trimmed.toLowerCase(), underscore, underscore.split(/[_@\.]/)[0]]
            .forEach(v => { const n = v && String(v).trim(); n && !variants.includes(n) && variants.push(n); });

        return variants;
    }

    buildPriorityLanguages() {
        const result = [],
            seen = new Set(),
            add = (c) => {
            c && !seen.has(c) && (seen.add(c), result.push(c));
        };

        this.parseLanguageCandidates(this.getLanguage()).forEach(add);
        this.availableLanguages.forEach(add);

        return result;
    }

    getTranslator() {
        this.translatorFn ||= (() => {
            const fn = (key, params = null) => this.translateInternal(key, params);
            fn.getCurrentLanguage = () => this.getCurrentLanguage();
            fn.availableLanguages = () => this.getAvailableLanguages();
            fn.setLanguageOverride = (langCode) => this.setLanguageOverride(langCode);
            fn.standardizeCandidates = (langCode) => this.parseLanguageCandidates(langCode);
            return fn;
        })();
        return this.translatorFn;
    }

    bindGlobals() {
        const translator = this.getTranslator();

        const DI = this.diContainer;
        DI?.value && (
            DI.value('translationService', this),
            DI.value('translations', this.translations),
            DI.value('translator', translator)
        );
    }
}
