import GLib from 'gi://GLib';
import {ViewTabName} from '../common/Constants.js';
import { Events } from '../../app/eventBus.js';
import { TIMEOUTS } from '../../infrastructure/constants/Timeouts.js';
import { ensureArray, firstDefined, isPlainObject } from '../../infrastructure/utils/Utils.js';

export const ThemeSelectorLocalization = {
    getStoreSettingsSnapshot() {
        const settingsFromStore = this.controller?.store?.getState?.()?.settings;
        if (isPlainObject(settingsFromStore)) {
            return settingsFromStore;
        }
        return isPlainObject(this.store?.snapshot?.settings) ? this.store.snapshot.settings : null;
    },

    getLanguageCandidates(languageCode) {
        const full = typeof languageCode === 'string' ? languageCode.trim() : '';
        const normalized = full.toLowerCase().split(/[_@.]/)[0];
        if (!full) return [];
        if (normalized && normalized !== full) {
            return [full, normalized];
        }
        return [full];
    },

    scheduleIdle(callback) {
        if (typeof callback !== 'function') return;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            callback();
            return GLib.SOURCE_REMOVE;
        });
    },

    tryTranslate(key, params) {
        const translated = typeof this.t === 'function'
            ? this.t(key, isPlainObject(params) ? params : undefined)
            : null;
        return typeof translated === 'string' ? translated : null;
    },

    interpolateParams(key, params) {
        return isPlainObject(params)
            ? Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k] ?? '')),
                String(key)
            )
            : String(key ?? '');
    },

    translate(key, params = null) {
        return this.tryTranslate(key, params) ?? this.interpolateParams(key, params);
    },

    pickLocalizedValue(values = {}, languageCandidates = []) {
        return languageCandidates
            .map((languageCode) => values[languageCode])
            .find(Boolean)
            ?? values.en
            ?? values.ru
            ?? Object.values(values).find(Boolean)
            ?? null;
    },

    translateText(text, defaultText = null) {
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        if (!normalizedText || !this.t) return defaultText ?? text;

        this.ensureValueTranslationCache();
        return this.pickLocalizedValue(
            isPlainObject(this.valueTranslationCache.get(normalizedText)?.values) ? this.valueTranslationCache.get(normalizedText).values : {},
            this.getLanguageCandidates(this.t?.getCurrentLanguage?.() ?? null)
        ) ?? defaultText ?? text;
    },

    ensureValueTranslationCache() {
        if (!this.valueTranslationCache) {
            this.valueTranslationCache = this.buildValueTranslationCache();
        }
    },

    buildValueTranslationCache() {
        const cache = new Map();

        for (const [langCode, entries] of Object.entries(
            isPlainObject(this.container?.has?.('translations') ? this.container.get('translations') : null)
                ? (this.container.get('translations'))
                : {}
        )) {
            for (const [entryKey, entryValue] of Object.entries(isPlainObject(entries) ? entries : {})) {
                if (typeof entryValue !== 'string' || !entryValue.trim()) continue;

                cache.has(entryValue.trim()) || cache.set(entryValue.trim(), {key: entryKey, values: {}});
                cache.get(entryValue.trim()).values[langCode] = entryValue;
            }
        }
        return cache;
    },

    getLocalizationEventBus() {
        return typeof this.getEventBus === 'function' ? this.getEventBus() : null;
    },

    scheduleLocalizationRetry() {
        if (this.localizationRetryId) return;
        this.localizationRetryId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.PROGRESS_POLL_MS, () => {
            this.localizationRetryId = null;
            this.setupLocalizationListeners();
            return GLib.SOURCE_REMOVE;
        }) || 0;
    },

    getPreviousSettings() {
        return isPlainObject(this.currentSettings) && Object.keys(this.currentSettings).length > 0
            ? this.currentSettings
            : this.getStoreSettingsSnapshot();
    },

    handleLocalizationEvent(settings, options = {}) {
        const opts = {...options};
        const isInitial = opts.initial === true;
        const prev = this.getPreviousSettings();
        const hasSettingsAndPrev = isPlainObject(settings) && isPlainObject(prev);

        opts.languageChanged ??= isInitial || (hasSettingsAndPrev && settings.language !== prev.language);
        opts.themeChanged ??= isInitial
            || (hasSettingsAndPrev && (settings.theme !== prev.theme || settings.gtkTheme !== prev.gtkTheme));

        if (opts.immediate) {
            this.onAppSettingsLocalizationUpdated(settings, opts);
        } else {
            this.scheduleIdle(() => this.onAppSettingsLocalizationUpdated(settings, opts));
        }
    },

    setupLocalizationListeners() {
        if (this.localizationHandlers) return;

        const bus = this.getLocalizationEventBus();
        if (!bus || typeof bus.on !== 'function') {
            this.scheduleLocalizationRetry();
            return;
        }

        this.localizationRetryId && GLib.source_remove(this.localizationRetryId);
        this.localizationRetryId = null;

        const mergedEvents = {...Events, ...(isPlainObject(bus.Events) ? bus.Events : {})},
              commitEvent = mergedEvents.APPSETTINGS_COMMITTED,
              loadedEvent = mergedEvents.APPSETTINGS_LOADED;

        const handler = (payload, sourceEvent) => {
            const payloadData = isPlainObject(payload) ? payload : {};
            const settings = isPlainObject(payloadData.settings) ? payloadData.settings : payload,
                  payloadDiff = isPlainObject(payloadData.diff) ? payloadData.diff : null;
            this.handleLocalizationEvent(settings, (sourceEvent === commitEvent && payloadDiff)
                ? {
                    immediate: payloadDiff.immediate ?? true,
                    languageChanged: !!payloadDiff.languageChanged,
                    themeChanged: !!payloadDiff.themeChanged
                }
                : null);
        };

        this.localizationHandlers = {
            bus, handler, commitEvent, loadedEvent,
            commitListenerId: bus.on(commitEvent, handler),
            loadedListenerId: bus.on(loadedEvent, handler)
        };

        const initialSettings = this.getStoreSettingsSnapshot(),
              initOpts = {initial: true, immediate: true, languageChanged: true, themeChanged: true};
        initialSettings && (
            this.handleLocalizationEvent(initialSettings, initOpts),
            this.onSettingsApplied(initialSettings, {...initOpts, skipLocalization: true})
        );
    },

    onAppSettingsLocalizationUpdated(settings, {initial = false, languageChanged = false, themeChanged = false} = {}) {
        const language = firstDefined(
            isPlainObject(settings) ? settings.language : null,
            this.getStoreSettingsSnapshot()?.language ?? null
        );

        const translator = this.t;
        const canSetLanguage = language
            && translator
            && typeof translator.setLanguageOverride === 'function'
            && (translator?.getCurrentLanguage?.() ?? null) !== language;
        if (canSetLanguage) {
            translator.setLanguageOverride(language);
        }
        this.t = translator;

        this.updateLocalizationControllers();
        (initial || languageChanged) && this.applyLocalizationToUI({languageChanged: true, themeChanged});
    },

    updateLocalizationControllers() {
        const translations = firstDefined(
            this.tryGetService?.('translations'),
            this.DI?.get?.('translations'),
            {}
        );
        this.moreSectionsView?.controller?.setTranslations?.(translations);
        this.aboutView?.controller?.setTranslations?.(translations);
    },

    shouldApplyLocalization(options = {}) {
        return options.force === true || options.languageChanged === true;
    },

    runLocalizedHandlers() {
        ensureArray(this.localizedElements)
            .filter((handler) => typeof handler === 'function')
            .forEach((handler) => handler());
    },

    syncLayoutForLocalization(languageChanged) {
        if (this.window) {
            if (languageChanged) {
                this.recreateWindowIfNeeded();
            }
            return;
        }
        this.rebuildMainLayout();
    },

    translateWidgets(widgets = []) {
        ensureArray(widgets)
            .filter(Boolean)
            .forEach((widget) => this.translateWidgetTexts(widget));
    },

    applyLocalizationToUI(options = {}) {
        if (!this.shouldApplyLocalization(options)) {
            return;
        }

        this.runLocalizedHandlers();
        this.syncLayoutForLocalization(options.languageChanged === true);

        this.registerWindowTranslation();
        const window = this.window;
        window?.set_title?.(this.translate('APP_TITLE'));
        if (this.themeContextMenuView) {
            this.themeContextMenuView.t = this.t;
        }

        this.moreSectionsView?.refresh?.();
        this.translateWidgets([
            this.aboutView?.notebook ?? null,
            this.DI?.get?.('tweaksController')?.view?.tweaksNotebookGlobal ?? null,
            this.downloadsContainer,
            window,
            this.mainContentBox
        ]);

        this.refreshActiveView?.();
        window?.show_all?.();
        window?.queue_draw?.();
    },

    translateWidgetTexts(widget, visited = new Set()) {
        if (!widget || typeof widget !== 'object' || visited.has(widget)) {
            return;
        }
        visited.add(widget);

        ['label', 'title', 'tooltip_text'].forEach((prop) => {
            const getterFn = widget[`get_${prop}`];
            const setterFn = widget[`set_${prop}`];
            const val = typeof getterFn === 'function' ? getterFn.call(widget) : null;
            const translated = typeof val === 'string' ? this.translateText(val) : null;
            if (translated && translated !== val && typeof setterFn === 'function') {
                setterFn.call(widget, translated);
            }
        });

        const children = typeof widget.get_children === 'function' ? widget.get_children() : null;
        Array.isArray(children) && children.forEach((child) => this.translateWidgetTexts(child, visited));
        widget.foreach?.((child) => this.translateWidgetTexts(child, visited));
        const child = typeof widget.get_child === 'function' ? widget.get_child() : null;
        this.translateWidgetTexts(child, visited);
    },

    registerWindowTranslation() {
        this.window && this.registerWidgetTranslation(
            this.window,
            'APP_TITLE',
            (widget, text) => widget?.set_title?.(text)
        );
    },

    registerLocalizedElement(callback) {
        if (!this.localizedElements) {
            this.localizedElements = [];
        }
        this.localizedElements.push(callback);
    },

    registerWidgetTranslation(widget, key, apply) {
        const handler = () => widget && apply(widget, this.translate(key));
        this.registerLocalizedElement(handler);
        handler();
    },

    onSettingsApplied(settings = {}, options = {}) {
        if (!settings || typeof settings !== 'object') {
            return;
        }

        const prev = (this.currentSettings && Object.keys(this.currentSettings).length > 0)
            ? {...this.currentSettings}
            : {};
        const languageChanged = options.languageChanged === true || settings.language !== prev.language;
        const themeChanged = options.themeChanged === true || settings.theme !== prev.theme || settings.gtkTheme !== prev.gtkTheme;

        this.currentSettings = {...prev, ...settings};
        const nextTheme = this.currentSettings.theme ?? settings.theme;

        if (themeChanged && nextTheme) {
            this.scheduleIdle(() => this.updateCurrentThemeStyles(nextTheme));
            const shouldRecreateWindow = !languageChanged
                && nextTheme !== (prev.theme ?? null)
                && (this.window?.get_visible?.() ?? false)
                && typeof this.recreateWindowIfNeeded === 'function';
            if (shouldRecreateWindow) {
                this.recreateWindowIfNeeded();
            }
        }

        const serverAddr = firstDefined(settings.serverAddress, settings.serverUrl);
        const shouldReloadNetwork = Boolean(serverAddr)
            && this.currentTab === ViewTabName.NETWORK
            && options.debounce !== true
            && typeof this.controller?.scheduleNetworkReload === 'function';
        if (serverAddr) {
            this.serverAddressOverride = serverAddr;
        }
        if (shouldReloadNetwork) {
            this.controller.scheduleNetworkReload(200);
        }

        if (options.debounce !== true && typeof this.refreshActiveView === 'function') {
            this.refreshActiveView();
        }
        this.window?.queue_draw?.();
    }
};

export function applyThemeSelectorLocalization(targetPrototype) {
    for (const [methodName, method] of Object.entries(ThemeSelectorLocalization)) {
        if (typeof method === 'function') {
            targetPrototype[methodName] = method;
        }
    }
}
