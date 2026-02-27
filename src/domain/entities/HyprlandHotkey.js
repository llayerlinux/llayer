let hotkeyIdCounter = 0;

function generateHotkeyId() {
    return `hk_${Date.now()}_${++hotkeyIdCounter}`;
}

const seenIds = new Map();
const MODIFIER_LABELS = {
    SUPER: 'Super',
    SHIFT: 'Shift',
    CTRL: 'Ctrl',
    CONTROL: 'Ctrl',
    ALT: 'Alt',
    MOD1: 'Alt',
    MOD2: 'Num',
    MOD3: 'Mod3',
    MOD4: 'Super',
    MOD5: 'Mod5'
};
const MOUSE_BUTTON_LABELS = {
    '272': 'Mouse Left',
    '273': 'Mouse Right',
    '274': 'Mouse Middle'
};
const VALID_BIND_TYPES = ['bind', 'bindm', 'bindr', 'binde', 'bindl', 'bindle', 'bindrl', 'bindn'];

function generateStableId(sourceFile, lineNumber, modifiers, key, dispatcher, args) {
    const baseId = sourceFile && lineNumber > 0
        ? `hk_${sourceFile.replace(/^.*\/\.config\/themes\/[^/]+\//, '')}:${lineNumber}`
        : ((modStr, argsHash) => `hk_${modStr}:${key}:${dispatcher}${argsHash}`)(
            (modifiers ?? []).sort().join('_') || 'NONE', args ? `:${args.substring(0, 30)}` : '');

    let count = seenIds.get(baseId) || 0;
    seenIds.set(baseId, count + 1);

    return count > 0 ? `${baseId}#${count}` : baseId;
}

export function resetHotkeyIdCounter() {
    seenIds.clear();
}

export class HyprlandHotkey {
    constructor(data = {}) {
        this.id = data.id || generateHotkeyId();
        this.modifiers = data.modifiers ?? [];
        this.key = data.key || '';
        this.dispatcher = data.dispatcher || '';
        this.args = data.args || '';
        this.bindType = data.bindType || 'bind';
        this.sourceFile = data.sourceFile || '';
        this.lineNumber = data.lineNumber || 0;
        this.description = data.description || '';
        this.isDeleted = data.isDeleted || false;
    }

    get keyCombo() {
        const sortedMods = [...this.modifiers]
            .map(m => m.toUpperCase())
            .sort();
        const modStr = sortedMods.length > 0 ? sortedMods.join('_') : 'NONE';
        return `${modStr}:${this.key.toUpperCase()}`;
    }

    get bindLine() {
        const modStr = this.modifiers.length > 0 ? this.modifiers.join(' ') : '';
        const argsStr = this.args ? `, ${this.args}` : '';
        return `${this.bindType} = ${modStr}, ${this.key}, ${this.dispatcher}${argsStr}`;
    }

    get displayAction() {
        return this.args ? `${this.dispatcher} ${this.args}` : this.dispatcher;
    }

    get displayKeyCombo() {
        const modNames = this.modifiers.map(m => this.formatModifier(m));
        const keyName = this.formatKey(this.key);
        return [...modNames, keyName].join(' + ');
    }

    formatModifier(mod) {
        return MODIFIER_LABELS[mod.toUpperCase()] || mod;
    }

    formatKey(key) {
        const mouseButton = key.startsWith('mouse:') ? key.split(':')[1] : null;
        return mouseButton
            ? (MOUSE_BUTTON_LABELS[mouseButton] || `Mouse ${mouseButton}`)
            : (/^[fF]\d+$/.test(key) || key.length === 1)
                ? key.toUpperCase()
                : key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    }

    get unbindLine() {
        const modStr = this.modifiers.length > 0 ? this.modifiers.join(' ') : '';
        return `unbind = ${modStr}, ${this.key}`;
    }

    matchesKeyCombo(keyCombo) {
        return this.keyCombo === keyCombo;
    }

    hasSameAction(other) {
        return this.dispatcher === other.dispatcher && this.args === other.args;
    }

    clone(overrides = {}) {
        return new HyprlandHotkey({
            id: generateHotkeyId(),
            modifiers: [...this.modifiers],
            key: this.key,
            dispatcher: this.dispatcher,
            args: this.args,
            bindType: this.bindType,
            sourceFile: this.sourceFile,
            lineNumber: this.lineNumber,
            description: this.description,
            isDeleted: this.isDeleted,
            ...overrides
        });
    }

    toJSON() {
        return {
            id: this.id,
            modifiers: this.modifiers,
            key: this.key,
            dispatcher: this.dispatcher,
            args: this.args,
            bindType: this.bindType,
            sourceFile: this.sourceFile,
            lineNumber: this.lineNumber,
            description: this.description,
            isDeleted: this.isDeleted
        };
    }

    static fromBindLine(bindType, bindArgs, sourceFile = '', lineNumber = 0) {
        const parts = bindArgs.split(',').map(p => p.trim());
        return parts.length >= 3
            ? (() => {
                let modifiers = parts[0].split(/\s+/).filter(m => m.length > 0),
                    key = parts[1],
                    dispatcher = parts[2],
                    args = parts.slice(3).join(', ').trim();

                return new HyprlandHotkey({
                    id: generateStableId(sourceFile, lineNumber, modifiers, key, dispatcher, args),
                    modifiers,
                    key,
                    dispatcher,
                    args,
                    bindType,
                    sourceFile,
                    lineNumber
                });
            })()
            : null;
    }

    static fromJSON(data) {
        return new HyprlandHotkey(data);
    }

    validate() {
        const errors = [];
        !this.key && errors.push('Key is required');
        !this.dispatcher && errors.push('Dispatcher is required');
        !VALID_BIND_TYPES.includes(this.bindType) && errors.push(`Invalid bind type: ${this.bindType}`);

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
