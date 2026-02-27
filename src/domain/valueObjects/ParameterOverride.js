export const OverrideSource = {
    ORIGINAL: 'original',
    GLOBAL: 'global',
    PER_RICE: 'per-rice'
};

const standardizeOverrideSource = (source) =>
    Object.values(OverrideSource).includes(source) ? source : OverrideSource.GLOBAL;

export class ParameterOverride {
    constructor(parameterPath, value, source = OverrideSource.GLOBAL) {
        this.parameterPath = parameterPath;
        this.value = value;
        this.source = standardizeOverrideSource(source);
        this.timestamp = Date.now();
    }

    static create(parameterPath, value, source = OverrideSource.GLOBAL) {
        return new ParameterOverride(parameterPath, value, source);
    }

    static createForSource(source) {
        return (parameterPath, value) => ParameterOverride.create(parameterPath, value, source);
    }
}
