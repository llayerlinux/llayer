const TRUE_VALUES = new Set(['true', 'yes', 'on', '1']);
const FALSE_VALUES = new Set(['false', 'no', 'off', '0']);
const COLOR_PATTERNS = [
    /^rgba?\([0-9a-fA-F]{6,8}\)$/,
    /^rgb\([0-9a-fA-F]{6}\)$/,
    /^0x[0-9a-fA-F]{6,8}$/,
    /^#[0-9a-fA-F]{6,8}$/
];
const GRADIENT_PATTERN = /^(rgba?\([0-9a-fA-F]{6,8}\)\s*)+\d+deg$/;

export class HyprlandParameter {
    constructor(data = {}) {
        this.section = data.section || 'general';
        this.name = data.name || '';
        this.fullPath = data.fullPath || this.buildFullPath(data.section, data.name);
        this.type = data.type || 'str';
        this.defaultValue = data.defaultValue ?? null;
        this.description = data.description || '';
        this.min = data.min ?? null;
        this.max = data.max ?? null;
        this.options = data.options || null;
        this.popularity = data.popularity ?? 0;
    }

    buildFullPath(section, name) {
        if (!section || !name) return name || '';
        return `${section}:${name}`;
    }

    getDisplayName() {
        return this.name || this.fullPath;
    }

    hasOptions() {
        return Array.isArray(this.options) && this.options.length > 0;
    }

    getOptions() {
        return this.options ?? [];
    }

    validate(value) {
        if (value === null || value === undefined || value === '') return { valid: true, value: null };

        switch (this.type) {
            case 'int':
                return this.validateInt(value);
            case 'float':
                return this.validateFloat(value);
            case 'bool':
                return this.validateBool(value);
            case 'color':
                return this.validateColor(value);
            case 'gradient':
                return this.validateGradient(value);
            case 'vec2':
                return this.validateVec2(value);
            case 'str':
            default:
                return this.validateString(value);
        }
    }

    validateInt(value) {
        const num = parseInt(value, 10);
        if (isNaN(num)) return { valid: false, error: `Expected integer, got: ${value}` };
        if (this.min !== null && num < this.min) return { valid: false, error: `Value ${num} is below minimum ${this.min}` };
        if (this.max !== null && num > this.max) return { valid: false, error: `Value ${num} is above maximum ${this.max}` };
        if (this.options && !this.options.includes(num)) return { valid: false, error: `Value ${num} not in allowed options: ${this.options.join(', ')}` };
        return { valid: true, value: num };
    }

    validateFloat(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return { valid: false, error: `Expected float, got: ${value}` };
        if (this.min !== null && num < this.min) return { valid: false, error: `Value ${num} is below minimum ${this.min}` };
        if (this.max !== null && num > this.max) return { valid: false, error: `Value ${num} is above maximum ${this.max}` };
        return { valid: true, value: num };
    }

    validateBool(value) {
        const strVal = String(value).toLowerCase().trim();
        if (TRUE_VALUES.has(strVal)) return { valid: true, value: true };
        if (FALSE_VALUES.has(strVal)) return { valid: true, value: false };
        return { valid: false, error: `Expected boolean, got: ${value}` };
    }

    validateColor(value) {
        const strVal = String(value).trim();
        const isValid = COLOR_PATTERNS.some(p => p.test(strVal));

        if (!isValid) return { valid: false, error: `Invalid color format: ${value}` };
        return { valid: true, value: strVal };
    }

    validateGradient(value) {
        const strVal = String(value).trim();
        if (!GRADIENT_PATTERN.test(strVal) && !this.validateColor(strVal).valid) {
            return { valid: false, error: `Invalid gradient format: ${value}` };
        }
        return { valid: true, value: strVal };
    }

    validateVec2(value) {
        const strVal = String(value).trim();
        const parts = strVal.split(/\s+/);

        if (parts.length !== 2) return { valid: false, error: `Expected vec2 (two numbers), got: ${value}` };

        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);

        if (isNaN(x) || isNaN(y)) return { valid: false, error: `Invalid vec2 numbers: ${value}` };

        return { valid: true, value: `${x} ${y}` };
    }

    validateString(value) {
        const strVal = String(value);
        if (this.options && !this.options.includes(strVal)) {
            return { valid: false, error: `Value "${strVal}" not in allowed options: ${this.options.join(', ')}` };
        }
        return { valid: true, value: strVal };
    }

    formatValue(value) {
        if (value === null || value === undefined) return '';

        switch (this.type) {
            case 'bool':
                return value ? 'true' : 'false';
            case 'int':
                return String(parseInt(value, 10));
            case 'float':
                return String(parseFloat(value));
            default:
                return String(value);
        }
    }

    static fromDefinition(section, name, def) {
        const fullPath = def.fullPath || (name ? `${section}:${name}` : section);
        return new HyprlandParameter({
            section,
            name: name || section,
            fullPath,
            type: def.type || 'str',
            defaultValue: def.default ?? null,
            description: def.description || '',
            min: def.min ?? null,
            max: def.max ?? null,
            options: def.options || null,
            popularity: def.popularity ?? 0
        });
    }
}
