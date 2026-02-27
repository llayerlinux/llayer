import { ParameterOverride, OverrideSource } from './ParameterOverride.js';

const OVERRIDE_PRIORITY = [
    ['perRice', OverrideSource.PER_RICE],
    ['global', OverrideSource.GLOBAL],
    ['original', OverrideSource.ORIGINAL]
];

export class OverrideCollection {
    constructor() {
        this.original = new Map();
        this.global = new Map();
        this.perRice = new Map();
        this.createOriginalOverride = ParameterOverride.createForSource(OverrideSource.ORIGINAL);
        this.createGlobalOverride = ParameterOverride.createForSource(OverrideSource.GLOBAL);
        this.createPerRiceOverride = ParameterOverride.createForSource(OverrideSource.PER_RICE);
    }

    isValidValue(value) {
        return value !== null && value !== undefined && value !== '';
    }

    getOverrideValue(map, parameterPath) {
        return map.get(parameterPath)?.value ?? null;
    }

    mapKeysToArray(map) {
        return [...map.keys()];
    }

    mapToObject(map) {
        const result = {};
        for (const [path, override] of map) {
            result[path] = override?.value;
        }
        return result;
    }

    setScopedValue(map, parameterPath, value, createOverride) {
        this.isValidValue(value)
            ? map.set(parameterPath, createOverride(parameterPath, value))
            : map.delete(parameterPath);
    }

    setOriginal(parameterPath, value) {
        this.setScopedValue(this.original, parameterPath, value, this.createOriginalOverride);
    }

    setGlobal(parameterPath, value) {
        this.setScopedValue(this.global, parameterPath, value, this.createGlobalOverride);
    }

    setPerRice(parameterPath, value) {
        this.setScopedValue(this.perRice, parameterPath, value, this.createPerRiceOverride);
    }

    getOriginal(parameterPath) {
        return this.getOverrideValue(this.original, parameterPath);
    }

    getGlobal(parameterPath) {
        return this.getOverrideValue(this.global, parameterPath);
    }

    getPerRice(parameterPath) {
        return this.getOverrideValue(this.perRice, parameterPath);
    }

    getEffectivePair(parameterPath) {
        const match = OVERRIDE_PRIORITY
            .map(([field, source]) => ({override: this[field].get(parameterPath), source}))
            .find(({override}) => Boolean(override));
        return match ? {override: match.override, source: match.source} : null;
    }

    getEffectiveValue(parameterPath) {
        return this.getEffectivePair(parameterPath)?.override?.value ?? null;
    }

    getEffectiveOverride(parameterPath) {
        return this.getEffectivePair(parameterPath)?.override ?? null;
    }

    getEffectiveSource(parameterPath) {
        return this.getEffectivePair(parameterPath)?.source ?? null;
    }

    hasOverride(parameterPath) {
        return this.global.has(parameterPath) || this.perRice.has(parameterPath);
    }

    hasPerRiceOverride(parameterPath) {
        return this.perRice.has(parameterPath);
    }

    hasGlobalOverride(parameterPath) {
        return this.global.has(parameterPath);
    }

    isOverridden(parameterPath) {
        const effective = this.getEffectiveValue(parameterPath);
        const original = this.getOriginal(parameterPath);
        return effective !== null && effective !== original;
    }

    getAllOverriddenPaths() {
        const paths = new Set();
        for (const path of this.global.keys()) paths.add(path);
        for (const path of this.perRice.keys()) paths.add(path);
        return [...paths];
    }

    getAllOriginalPaths() {
        return this.mapKeysToArray(this.original);
    }

    getAllPaths() {
        const paths = new Set();
        for (const [field] of OVERRIDE_PRIORITY) {
            for (const path of this[field].keys()) {
                paths.add(path);
            }
        }
        return [...paths];
    }

    getEffectiveOverrides() {
        const result = {};
        for (const path of this.getAllPaths()) {
            const value = this.getEffectiveValue(path);
            value !== null && (result[path] = {
                value,
                source: this.getEffectiveSource(path),
                originalValue: this.getOriginal(path)
            });
        }
        return result;
    }

    getApplicableOverrides() {
        const result = {};
        for (const path of this.getAllOverriddenPaths()) {
            const value = this.getEffectiveValue(path);
            const originalValue = this.getOriginal(path);
            value !== null && value !== originalValue && (result[path] = value);
        }
        return result;
    }

    clearPerRice(parameterPath) {
        this.perRice.delete(parameterPath);
    }

    clearAllPerRice() {
        this.perRice.clear();
    }

    clearGlobal(parameterPath) {
        this.global.delete(parameterPath);
    }

    clearAllGlobal() {
        this.global.clear();
    }

    loadOriginals(originalsMap) {
        this.original.clear();
        for (const [path, value] of Object.entries(originalsMap)) {
            this.setOriginal(path, value);
        }
    }

    loadGlobals(globalsMap) {
        this.global.clear();
        for (const [path, value] of Object.entries(globalsMap)) {
            this.setGlobal(path, value);
        }
    }

    loadPerRice(perRiceMap) {
        this.perRice.clear();
        for (const [path, value] of Object.entries(perRiceMap)) {
            this.setPerRice(path, value);
        }
    }

    toJSON() {
        return {
            original: this.mapToObject(this.original),
            global: this.mapToObject(this.global),
            perRice: this.mapToObject(this.perRice)
        };
    }

}
