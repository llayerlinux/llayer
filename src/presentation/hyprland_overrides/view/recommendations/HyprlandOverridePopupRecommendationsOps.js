import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';
import {
    buildHotkeyTarget,
    findHotkeyOverride,
    findOriginalHotkeyAny,
    findOriginalHotkeyExact,
    isHotkeyOverrideMatch,
    runByRecommendationType
} from './HyprlandRecommendationsUtils.js';

function forEachDependent(rec, getRecommendationById, callback) {
    const dependents = Array.isArray(rec?.dependents) ? rec.dependents : [];
    dependents
        .map((depId) => getRecommendationById(depId))
        .filter(Boolean)
        .forEach((dependent) => callback(dependent));
}

function ensureObjectStore(ctx, key) {
    ctx[key] ||= {};
    return ctx[key];
}

function getThemePath(ctx) {
    return ctx.getCurrentThemePath?.() || ctx.getThemePath?.() || null;
}

function createRecommendedHotkeyPayload(rec, dispatcher, args) {
    return {
        dispatcher,
        args,
        action: HotkeyAction.ADD,
        isRecommended: true,
        metadata: {
            modifiers: rec.modifiers,
            key: rec.key,
            bindType: rec.bindType
        },
        timestamp: Date.now()
    };
}

function upsertRecommendedHotkeyOverride(overrides, target, newId, payload) {
    const existingEntry = findHotkeyOverride(overrides, target);
    const entryId = existingEntry?.id || newId;
    overrides[entryId] = existingEntry ? {
        ...overrides[existingEntry.id],
        ...payload
    } : payload;
    return entryId;
}

function setCurrentParamOverride(ctx, paramPath, value) {
    const current = ensureObjectStore(ctx, 'currentOverrides');
    current[paramPath] = value;
    ctx.saveCurrentOverrides?.();
}

function setGlobalParamOverride(ctx, paramPath, value, options = {}) {
    const global = ensureObjectStore(ctx, 'globalOverrides');
    global[paramPath] = value;
    ctx.globalOverrideInitiators && delete ctx.globalOverrideInitiators[paramPath];
    options.persist !== false && ctx.saveGlobalOverrides?.();
}

function ensureDuplicateBatch(options = {}) {
    if (options.batch && typeof options.batch === 'object') {
        return options.batch;
    }
    return {
        hotkeysChanged: false,
        paramsChanged: false
    };
}

function flushDuplicateBatch(ctx, batch) {
    batch.hotkeysChanged && ctx.saveGlobalHotkeyOverrides?.();
    batch.paramsChanged && ctx.saveGlobalOverrides?.();
}

function enterRecommendationTraversal(rec, options = {}) {
    const fromParent = options.fromParent === true;
    const visited = options.visited || new Set();
    const blocked = !rec || visited.has(rec.id) || (rec.parentId && !fromParent);
    return blocked ? null : (visited.add(rec.id), {fromParent, visited});
}

function withRecommendationTraversal(ctx, rec, options, visitor) {
    const traversal = enterRecommendationTraversal(rec, options);
    return traversal ? (visitor(traversal), true) : false;
}

function walkRecommendationDependents(ctx, rec, visited, visitFn) {
    forEachDependent(rec, ctx.getRecommendationById.bind(ctx), (dependent) => {
        visitFn(dependent, {fromParent: true, visited});
    });
}

function writeEffectiveOverridesIfNeeded(ctx) {
    const themePath = getThemePath(ctx);
    const settings = ctx.settingsManager?.getAll?.() ?? {};
    themePath && ctx.parameterService?.writeEffectiveOverrides?.(themePath, settings);
}

function sanitizeOverrides(overrides) {
    const clean = {};
    for (const [path, value] of Object.entries(overrides ?? {})) {
        (value !== null && value !== undefined && value !== '') && (clean[path] = value);
    }
    return clean;
}

function getCurrentParamValue(overrides, path, fallback) {
    return overrides?.[path] || fallback;
}

function hasSavedPreviousValue(saved) {
    return saved?.previousValue !== null && saved?.previousValue !== undefined;
}

function isKeybindRecommendation(rec) {
    return rec?.type === 'keybind';
}

function withKeybindRecommendation(rec, handler) {
    return isKeybindRecommendation(rec) ? handler(rec) : null;
}

function withTopLevelRecommendation(rec, handler) {
    return (rec && !rec.parentId) ? handler(rec) : undefined;
}

function applyRecommendationHotkeyValue(entry, fallbackDispatcher, value) {
    const parts = value.split(/\s+/);
    entry.override.dispatcher = parts[0] || fallbackDispatcher;
    entry.override.args = parts.slice(1).join(' ');
}

export function applyHyprlandOverridePopupRecommendationsOps(prototype) {


    prototype.getRecommendationHotkeyCollection = function() {
        this.recommendationHotkeyCollection ??= (() => {
            this.initHotkeyService?.();
            const themePath = this.getCurrentThemePath?.() || this.getThemePath?.();
            const settings = this.settingsManager?.getAll?.() ?? {};
            return (themePath && this.hotkeyService)
                ? this.hotkeyService.getMergedHotkeys(themePath, settings)
                : null;
        })();
        return this.recommendationHotkeyCollection;
    };


    prototype.checkBindingExists = function(key, modifiers, bindType) {
        const mods = Array.isArray(modifiers) ? modifiers : (modifiers ? [modifiers] : []);
        const target = buildHotkeyTarget(key, mods, bindType);
        const collection = this.getRecommendationHotkeyCollection?.();
        return !!(
            findHotkeyOverride(this.currentHotkeyOverrides, target)
            || findHotkeyOverride(this.globalHotkeyOverrides, target)
            || findOriginalHotkeyAny(collection, target)
        );
    };

    prototype.findOriginalRecommendationHotkey = function(rec, options = {}) {
        const { allowFallback = false } = options;
        return withKeybindRecommendation(rec, (item) => {
            const target = buildHotkeyTarget(item.key, item.modifiers, item.bindType);
            const collection = this.getRecommendationHotkeyCollection?.();
            const exact = findOriginalHotkeyExact(collection, target, item.dispatcher, item.args);
            return (exact || !allowFallback) ? exact : findOriginalHotkeyAny(collection, target);
        });
    };

    prototype.findRecommendationOverride = function(rec) {
        return withKeybindRecommendation(rec, (item) => {
            const target = buildHotkeyTarget(item.key, item.modifiers, item.bindType);
            return (
                findHotkeyOverride(this.currentHotkeyOverrides, target)
                || findHotkeyOverride(this.globalHotkeyOverrides, target)
            )?.override || null;
        });
    };


    prototype.applyRecommendation = function(rec, options = {}) {
        withRecommendationTraversal(this, rec, options, (traversal) => {
            const previousValue = this.getRecommendationCurrentValue(rec);
            this.saveRecommendationState(rec.id, { applied: true, previousValue });

            runByRecommendationType(rec, {
                'keybind': (item) => this.applyKeybindRecommendation(item),
                'dropdown': (item) => this.applyDropdownRecommendation(item),
                'param': (item) => this.applyParamRecommendation(item),
                'rule': (item) => this.applyRuleRecommendation(item),
                'workspaceRule': (item) => this.applyWorkspaceRuleRecommendation(item)
            });

            !traversal.fromParent && this.setApplyPending?.(true);

            walkRecommendationDependents(this, rec, traversal.visited, (dependent, childOptions) => {
                this.applyRecommendation(dependent, childOptions);
            });
        });
    };

    prototype.applyKeybindRecommendation = function(rec) {
        const overrides = ensureObjectStore(this, 'currentHotkeyOverrides');

        this.initHotkeyService?.();

        const target = buildHotkeyTarget(rec.key, rec.modifiers, rec.bindType);
        const payload = createRecommendedHotkeyPayload(rec, rec.dispatcher, rec.args);
        upsertRecommendedHotkeyOverride(overrides, target, `rec_${rec.id}_${Date.now()}`, payload);

        this.savePerRiceHotkeyOverrides?.();
        this.loadHotkeysForTheme?.();
    };

    prototype.applyDropdownRecommendation = function(rec) {
        setCurrentParamOverride(this, rec.paramPath, rec.recommendedValue);
    };

    prototype.applyParamRecommendation = function(rec) {
        setCurrentParamOverride(this, rec.paramPath, rec.defaultValue);
    };


    prototype.updateRecommendationValue = function(rec, value) {
        return withTopLevelRecommendation(rec, (item) => {
            runByRecommendationType(item, {
                'keybind': (keybindRec) => {
                    const target = buildHotkeyTarget(keybindRec.key, keybindRec.modifiers, keybindRec.bindType);
                    const entry = findHotkeyOverride(this.currentHotkeyOverrides, target);
                    const isMatch = entry && isHotkeyOverrideMatch(entry.override, target);
                    isMatch && applyRecommendationHotkeyValue(entry, keybindRec.dispatcher, value);
                },
                'dropdown': (dropdownRec) => {
                    setCurrentParamOverride(this, dropdownRec.paramPath, value);
                    this.setApplyPending?.(true);
                },
                'param': (paramRec) => {
                    ensureObjectStore(this, 'currentOverrides')[paramRec.paramPath] = value;
                }
            });
        });
    };

    prototype.duplicateRecommendationToGlobal = function(rec, options = {}) {
        const batch = ensureDuplicateBatch(options);
        withRecommendationTraversal(this, rec, options, (traversal) => {
            runByRecommendationType(rec, {
                'keybind': (item) => {
                    const globalHotkeyOverrides = ensureObjectStore(this, 'globalHotkeyOverrides');

                    this.initHotkeyService?.();

                    const existingOverride = this.findRecommendationOverride?.(item);
                    const dispatcher = existingOverride?.dispatcher || item.dispatcher;
                    const args = existingOverride?.args || item.args;

                    const target = buildHotkeyTarget(item.key, item.modifiers, item.bindType);
                    const payload = createRecommendedHotkeyPayload(item, dispatcher, args);
                    const entryId = upsertRecommendedHotkeyOverride(
                        globalHotkeyOverrides,
                        target,
                        `rec_${item.id}_global_${Date.now()}`,
                        payload
                    );
                    this.globalHotkeyInitiators && delete this.globalHotkeyInitiators[entryId];
                    batch.hotkeysChanged = true;
                },
                'dropdown': (item) => {
                    setGlobalParamOverride(
                        this,
                        item.paramPath,
                        getCurrentParamValue(this.currentOverrides, item.paramPath, item.recommendedValue),
                        { persist: false }
                    );
                    batch.paramsChanged = true;
                },
                'param': (item) => {
                    setGlobalParamOverride(
                        this,
                        item.paramPath,
                        getCurrentParamValue(this.currentOverrides, item.paramPath, item.defaultValue),
                        { persist: false }
                    );
                    batch.paramsChanged = true;
                },
                'rule': (item) => this.applyRuleRecommendation?.(item)
            });

            walkRecommendationDependents(this, rec, traversal.visited, (dependent, childOptions) => {
                this.duplicateRecommendationToGlobal(dependent, { ...childOptions, batch });
            });

            !traversal.fromParent && (
                flushDuplicateBatch(this, batch),
                this.setApplyPending?.(true)
            );
        });
    };

    prototype.revertRecommendation = function(rec, options = {}) {
        withRecommendationTraversal(this, rec, options, (traversal) => {
            const savedRecs = this.getSavedRecommendations();
            const saved = savedRecs[rec.id];

            const canRevert = hasSavedPreviousValue(saved);
            const restoreParamOverride = (item) => {
                const currentOverrides = this.currentOverrides;
                const canWriteCurrent = !!currentOverrides;
                canWriteCurrent && (
                    saved.previousValue === ''
                        ? delete currentOverrides[item.paramPath]
                        : currentOverrides[item.paramPath] = saved.previousValue
                );
                this.saveCurrentOverrides?.();
            };

            canRevert && (
                runByRecommendationType(rec, {
                    'keybind': (item) => {
                        const target = buildHotkeyTarget(item.key, item.modifiers, item.bindType);
                        const match = findHotkeyOverride(this.currentHotkeyOverrides, target);
                        match && delete this.currentHotkeyOverrides[match.id];
                        this.savePerRiceHotkeyOverrides?.();
                        this.loadHotkeysForTheme?.();
                    },
                    'dropdown': (item) => restoreParamOverride(item),
                    'param': (item) => restoreParamOverride(item),
                    'rule': (item) => this.revertRuleRecommendation?.(item, saved.previousValue),
                    'workspaceRule': (item) => this.revertWorkspaceRuleRecommendation?.(item)
                }),
                this.clearRecommendationState(rec.id)
            );

            canRevert && !traversal.fromParent && this.setApplyPending?.(true);

            walkRecommendationDependents(this, rec, traversal.visited, (dependent, childOptions) => {
                this.revertRecommendation(dependent, childOptions);
            });
        });
    };

    prototype.saveCurrentOverrides = function() {
        const themeName = this.currentTheme?.name;
        const canSave = Boolean(this.currentTheme && this.themeRepository && themeName);
        return canSave
            ? (() => {
                ensureObjectStore(this, 'currentOverrides');

                const cleanedOverrides = sanitizeOverrides(this.currentOverrides);
                this.currentOverrides = cleanedOverrides;

                const success = this.themeRepository.writeOverrides(themeName, cleanedOverrides);
                success && writeEffectiveOverridesIfNeeded(this);
                success && this.setApplyPending?.(true);
                return success;
            })()
            : false;
    };

    prototype.saveGlobalOverrides = function() {
        return this.settingsManager?.set
            ? (
                this.settingsManager.writeGlobalHyprland?.(this.globalOverrides ?? {}),
                this.globalOverrideInitiators = {
                    ...(this.settingsManager.readGlobalHyprlandState?.()?.initiators ?? {})
                },
                this.settingsManager.set('hyprlandOverrides', this.globalOverrides ?? {}),
                this.settingsManager.write?.(null, { silent: true, force: true }),
                writeEffectiveOverridesIfNeeded(this),
                this.setApplyPending?.(true),
                true
            )
            : false;
    };
}
