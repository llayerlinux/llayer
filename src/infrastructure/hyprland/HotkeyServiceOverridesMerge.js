import { HotkeyCollection } from '../../domain/valueObjects/HotkeyCollection.js';
import { HotkeyAction } from '../../domain/valueObjects/HotkeyOverride.js';

function buildSyntheticOverrideId(combo, data) {
    return `global:${`${combo}:${data.dispatcher || ''}:${data.args || ''}`.replace(/\s+/g, '_')}`;
}

function withNormalizedModifiers(data, metadata, modifiers) {
    return {
        ...data,
        metadata: {
            ...metadata,
            modifiers
        }
    };
}

export function applyHotkeyServiceOverridesMerge(targetPrototype) {
    targetPrototype.getMergedHotkeys = function(themePath, settings) {
        const collection = new HotkeyCollection(),
            originals = this.parseThemeOriginals(themePath);
        collection.loadOriginals(originals);

        let duplicateOriginalIds = this.findDuplicateOriginalIds(originals, themePath);
        collection.loadGlobals(this.remapGlobalOverridesForTheme(
            this.getGlobalOverrides(settings), collection, themePath
        ));

        let perRice = this.getPerRiceOverrides(themePath);
        if (duplicateOriginalIds.size > 0) {
            let cleanedEntries = Object.entries(perRice)
                .filter(([id, data]) => !(data?.action === HotkeyAction.DELETE && duplicateOriginalIds.has(id)));
            if (cleanedEntries.length !== Object.keys(perRice).length) {
                perRice = Object.fromEntries(cleanedEntries);
                this.savePerRiceOverrides(themePath, perRice);
            }
        }
        collection.loadPerRice(perRice);

        return collection;
    };

    targetPrototype.findDuplicateOriginalIds = function(originals, themePath) {
        const signatureCounts = new Map(),
            idBySignature = new Map();

        for (const hotkey of (originals ?? []).filter(Boolean)) {
            let combo = this.buildKeyCombo(
                    this.standardizeModifiers(hotkey.modifiers ?? [], themePath), hotkey.key || ''
                ),
                action = `${hotkey.dispatcher || ''} ${hotkey.args || ''}`.trim();
            if (combo && action) {
                let signature = `${combo}|${action}`;
                signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
                !idBySignature.has(signature) && idBySignature.set(signature, []);
                idBySignature.get(signature).push(hotkey.id);
            }
        }

        let duplicateIds = new Set();
        for (const [signature, count] of signatureCounts.entries()) {
            count > 1 && (idBySignature.get(signature) ?? []).forEach(id => duplicateIds.add(id));
        }
        return duplicateIds;
    };

    targetPrototype.remapGlobalOverridesForTheme = function(globals, collection, themePath) {
        let remapped = {};

        for (const [id, data] of Object.entries(globals ?? {})) {
            if (!(data && typeof data === 'object')) continue;

            let original = collection.getOriginalHotkey(id),
                metadata = data.metadata ?? {},
                hasOriginalMeta = (metadata.originalDispatcher ?? null) !== null
                    || (metadata.originalArgs ?? null) !== null,
                normalizedModifiers = metadata.modifiers
                    ? this.standardizeModifiers(metadata.modifiers, themePath) : null,
                originalMatches = original
                    && (original.dispatcher || '') === (metadata.originalDispatcher || '')
                    && (original.args || '') === (metadata.originalArgs || ''),
                mustRemapSynthetic = hasOriginalMeta
                    && ((!original && metadata.key) || (original && !originalMatches)),
                syntheticModifiers = this.standardizeModifiers(metadata.modifiers ?? [], themePath),
                remappedId = mustRemapSynthetic
                    ? buildSyntheticOverrideId(this.buildKeyCombo(syntheticModifiers, metadata.key || ''), data)
                    : id;
            remapped[remappedId] = mustRemapSynthetic
                ? withNormalizedModifiers(data, metadata, syntheticModifiers)
                : (normalizedModifiers ? withNormalizedModifiers(data, metadata, normalizedModifiers) : data);
        }

        return remapped;
    };

    targetPrototype.getGroupedHotkeys = function(themePath, settings) {
        const collection = this.getMergedHotkeys(themePath, settings),
            groups = new Map();

        for (const hotkey of collection.getAllOriginalHotkeys()) {
            !groups.has(hotkey.keyCombo) && groups.set(hotkey.keyCombo, {
                keyCombo: hotkey.keyCombo,
                displayKeyCombo: hotkey.displayKeyCombo,
                modifiers: hotkey.modifiers,
                key: hotkey.key,
                hotkeys: [],
                addedHotkeys: []
            });
            groups.get(hotkey.keyCombo).hotkeys.push({
                hotkey,
                override: collection.getEffectiveOverride(hotkey.id),
                source: collection.getEffectiveSource(hotkey.id),
                isOverridden: collection.isOverridden(hotkey.id)
            });
        }

        return groups;
    };
}
