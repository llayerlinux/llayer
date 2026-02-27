import { HotkeyOverride, HotkeySource, HotkeyAction } from './HotkeyOverride.js';

const HOTKEY_OVERRIDE_PRIORITY = [
    { source: HotkeySource.PER_RICE, mapKey: 'perRice' },
    { source: HotkeySource.GLOBAL, mapKey: 'global' },
    { source: HotkeySource.ORIGINAL, mapKey: 'original' }
];

export class HotkeyCollection {
    constructor() {
        this.original = new Map();
        this.global = new Map();
        this.perRice = new Map();
        this.originalHotkeys = new Map();
        this.globalByKeyCombo = new Map();
        this.hotkeyIdToKeyCombo = new Map();
    }

    buildOverride(action, hotkeyId, dispatcher, args, originalHotkey, metadata, source) {
        const origDispatcher = originalHotkey?.dispatcher || '';
        const origArgs = originalHotkey?.args || '';

        switch (action) {
        case HotkeyAction.DELETE:
            return HotkeyOverride.create(source, action, hotkeyId, null, null,
                {originalDispatcher: origDispatcher, originalArgs: origArgs});
        case HotkeyAction.ADD:
            return HotkeyOverride.create(source, action, hotkeyId, dispatcher, args,
                {modifiers: metadata.modifiers ?? [], key: metadata.key || '', bindType: metadata.bindType || 'bind'});
        default:
            return HotkeyOverride.create(source, action, hotkeyId, dispatcher, args,
                {originalDispatcher: origDispatcher, originalArgs: origArgs});
        }
    }

    setOriginal(hotkey) {
        if (hotkey && hotkey.id) {
            this.originalHotkeys.set(hotkey.id, hotkey);
            this.original.set(hotkey.id, HotkeyOverride.createOriginal(
                hotkey.id,
                hotkey.dispatcher,
                hotkey.args
            ));
            hotkey.keyCombo && this.hotkeyIdToKeyCombo.set(hotkey.id, hotkey.keyCombo);
        }
    }

    setGlobal(hotkeyId, dispatcher, args, action = HotkeyAction.REPLACE, metadata = {}) {
        const originalHotkey = this.originalHotkeys.get(hotkeyId);
        const override = this.buildOverride(action, hotkeyId, dispatcher, args, originalHotkey, metadata, HotkeySource.GLOBAL);
        this.global.set(hotkeyId, override);
    }

    setPerRice(hotkeyId, dispatcher, args, action = HotkeyAction.REPLACE, metadata = {}) {
        const originalHotkey = this.originalHotkeys.get(hotkeyId);
        const override = this.buildOverride(action, hotkeyId, dispatcher, args, originalHotkey, metadata, HotkeySource.PER_RICE);
        this.perRice.set(hotkeyId, override);
    }

    getOriginal(hotkeyId) {
        return this.original.get(hotkeyId) ?? null;
    }

    getGlobal(hotkeyId) {
        const direct = this.global.get(hotkeyId);
        if (direct) return direct;
        const keyCombo = this.hotkeyIdToKeyCombo.get(hotkeyId);
        return keyCombo ? (this.globalByKeyCombo.get(keyCombo) ?? null) : null;
    }

    hasGlobalOverride(hotkeyId) {
        if (this.global.has(hotkeyId)) return true;

        const keyCombo = this.hotkeyIdToKeyCombo.get(hotkeyId);
        return keyCombo && this.globalByKeyCombo.has(keyCombo);
    }

    getPerRice(hotkeyId) {
        return this.perRice.get(hotkeyId) ?? null;
    }

    getOriginalHotkey(hotkeyId) {
        return this.originalHotkeys.get(hotkeyId) ?? null;
    }

    getMapOverride(mapKey, hotkeyId) {
        return mapKey === 'global' ? this.getGlobal(hotkeyId) : (this[mapKey].get(hotkeyId) ?? null);
    }

    determineEffectiveState(hotkeyId) {
        const perRiceOverride = this.perRice.get(hotkeyId);
        if (perRiceOverride && perRiceOverride.action !== HotkeyAction.USE_GLOBAL) {
            return { override: perRiceOverride, source: HotkeySource.PER_RICE };
        }

        for (const { source, mapKey } of HOTKEY_OVERRIDE_PRIORITY.slice(1)) {
            const override = this.getMapOverride(mapKey, hotkeyId);
            if (override) return { override, source };
        }
        return null;
    }

    getEffectiveOverride(hotkeyId) {
        return this.determineEffectiveState(hotkeyId)?.override ?? null;
    }

    getEffectiveSource(hotkeyId) {
        return this.determineEffectiveState(hotkeyId)?.source ?? null;
    }

    isUseGlobal(hotkeyId) {
        return this.perRice.get(hotkeyId)?.action === HotkeyAction.USE_GLOBAL;
    }

    hasOverride(hotkeyId) {
        return this.hasGlobalOverride(hotkeyId) || this.perRice.has(hotkeyId);
    }

    hasPerRiceOverride(hotkeyId) {
        return this.perRice.has(hotkeyId);
    }

    isOverridden(hotkeyId) {
        const effective = this.getEffectiveOverride(hotkeyId),
            original = this.getOriginal(hotkeyId);

        if (!effective || !original) return !!effective && effective.action === HotkeyAction.ADD;

        return (
            effective.dispatcher !== original.dispatcher ||
            effective.args !== original.args ||
            effective.action !== original.action
        );
    }

    getAllOverriddenIds() {
        const ids = new Set();
        for (const id of this.global.keys()) ids.add(id);
        for (const id of this.perRice.keys()) ids.add(id);
        return [...ids];
    }

    getAllOriginalIds() {
        return [...this.original.keys()];
    }

    getAllIds() {
        const ids = new Set();
        HOTKEY_OVERRIDE_PRIORITY.forEach(({ mapKey }) => {
            for (const id of this[mapKey].keys()) {
                ids.add(id);
            }
        });
        return [...ids];
    }

    getAllOriginalHotkeys() {
        return [...this.originalHotkeys.values()];
    }

    getHotkeysGroupedByKeyCombo() {
        const groups = new Map();
        for (const hotkey of this.originalHotkeys.values()) {
            const combo = hotkey.keyCombo;
            !groups.has(combo) && groups.set(combo, []);
            groups.get(combo).push(hotkey);
        }
        return groups;
    }

    getEffectiveOverrides() {
        const result = {};
        for (const id of this.getAllIds()) {
            const override = this.getEffectiveOverride(id);
            override && (result[id] = {
                dispatcher: override.dispatcher,
                args: override.args,
                action: override.action,
                source: this.getEffectiveSource(id),
                metadata: override.metadata
            });
        }
        return result;
    }

    getApplicableOverrides() {
        const result = {};

        function shouldPersistReplace(override, original) {
            if (!original) return !!override.metadata?.key;
            return override.dispatcher !== original.dispatcher || override.args !== original.args;
        }

        for (const id of this.getAllOverriddenIds()) {
            const override = this.getEffectiveOverride(id),
                  original = this.getOriginal(id);
            if (!override) continue;

            switch (override.action) {
            case HotkeyAction.ADD:
            case HotkeyAction.DELETE:
                result[id] = override.toJSON();
                break;
            default:
                shouldPersistReplace(override, original) && (result[id] = override.toJSON());
            }
        }
        return result;
    }

    clearPerRice(hotkeyId) {
        this.perRice.delete(hotkeyId);
    }

    clearAllPerRice() {
        this.perRice.clear();
    }

    clearGlobal(hotkeyId) {
        this.global.delete(hotkeyId);
    }

    clearAllGlobal() {
        this.global.clear();
    }

    loadOriginals(hotkeys) {
        this.original.clear();
        this.originalHotkeys.clear();
        for (const hotkey of hotkeys) {
            this.setOriginal(hotkey);
        }
    }

    buildKeyCombo(modifiers, key) {
        const normalized = (modifiers ?? [])
            .map(m => m.toUpperCase())
            .sort();
        const modStr = normalized.length > 0 ? normalized.join('_') : 'NONE';
        return `${modStr}:${(key || '').toUpperCase()}`;
    }

    getOverrideTimestamp(override) {
        const parsed = Number(override?.timestamp);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    loadGlobals(globalsMap) {
        this.global.clear();
        this.globalByKeyCombo.clear();

        for (const [id, data] of Object.entries(globalsMap)) {
            let override = HotkeyOverride.fromJSON({ hotkeyId: id, ...data });
            override.source = HotkeySource.GLOBAL;
            this.global.set(id, override);

            if (override.metadata?.key) {
                let keyCombo = this.buildKeyCombo(
                    override.metadata.modifiers,
                    override.metadata.key
                );
                let current = this.globalByKeyCombo.get(keyCombo);
                (!current || this.getOverrideTimestamp(override) >= this.getOverrideTimestamp(current))
                    && this.globalByKeyCombo.set(keyCombo, override);
            }
        }
    }

    loadPerRice(perRiceMap) {
        this.perRice.clear();
        for (const [id, data] of Object.entries(perRiceMap)) {
            const override = HotkeyOverride.fromJSON({ hotkeyId: id, ...data });
            override.source = HotkeySource.PER_RICE;
            this.perRice.set(id, override);
        }
    }

    toJSON() {
        const globalObj = {};
        for (const [id, override] of this.global) {
            globalObj[id] = {
                dispatcher: override.dispatcher,
                args: override.args,
                action: override.action,
                metadata: override.metadata,
                timestamp: override.timestamp
            };
        }

        const perRiceObj = {};
        for (const [id, override] of this.perRice) {
            perRiceObj[id] = {
                dispatcher: override.dispatcher,
                args: override.args,
                action: override.action,
                metadata: override.metadata,
                timestamp: override.timestamp
            };
        }

        const originalObj = {};
        for (const [id, hotkey] of this.originalHotkeys) {
            originalObj[id] = hotkey.toJSON();
        }

        return {
            original: originalObj,
            global: globalObj,
            perRice: perRiceObj
        };
    }

}
