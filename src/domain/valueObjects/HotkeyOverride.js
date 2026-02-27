export const HotkeySource = {
    ORIGINAL: 'original',
    GLOBAL: 'global',
    PER_RICE: 'per-rice'
};

export const HotkeyAction = {
    REPLACE: 'replace',
    DELETE: 'delete',
    ADD: 'add',
    USE_GLOBAL: 'use_global'
};

function standardizeModifiers(modifiers) {
    let source = Array.isArray(modifiers) ? modifiers : [];
    let result = [];
    const modMap = {
        'super': 'SUPER',
        'shift': 'SHIFT',
        'ctrl': 'CTRL',
        'control': 'CTRL',
        'alt': 'ALT',
        '$mainmod': 'SUPER',
        'mod1': 'ALT',
        'mod4': 'SUPER'
    };

    for (const mod of source.filter((value) => value && typeof value === 'string')) {
        const parts = mod.split(/[\s+]+/).filter(p => p.length > 0);

        for (const part of parts) {
            const normalized = modMap[part.toLowerCase()] || part.toUpperCase();
            result.includes(normalized) || result.push(normalized);
        }
    }

    return result;
}

export class HotkeyOverride {
    constructor(hotkeyId, dispatcher, args, source = HotkeySource.GLOBAL, action = HotkeyAction.REPLACE, metadata = {}) {
        this.hotkeyId = hotkeyId;
        this.dispatcher = dispatcher;
        this.args = args;
        this.source = source;
        this.action = action;
        this.timestamp = Date.now();

        this.metadata = {
            modifiers: standardizeModifiers(metadata.modifiers),
            key: metadata.key || '',
            bindType: metadata.bindType || 'bind',
            originalDispatcher: metadata.originalDispatcher || '',
            originalArgs: metadata.originalArgs || ''
        };
    }

    toJSON() {
        return {
            hotkeyId: this.hotkeyId,
            dispatcher: this.dispatcher,
            args: this.args,
            source: this.source,
            action: this.action,
            timestamp: this.timestamp,
            metadata: this.metadata
        };
    }

    static fromJSON(json) {
        const override = new HotkeyOverride(
            json.hotkeyId,
            json.dispatcher,
            json.args,
            json.source || HotkeySource.GLOBAL,
            json.action || HotkeyAction.REPLACE,
            json.metadata ?? {}
        );
        json.timestamp && (override.timestamp = json.timestamp);
        return override;
    }

    static createOriginal(hotkeyId, dispatcher, args) {
        return new HotkeyOverride(hotkeyId, dispatcher, args, HotkeySource.ORIGINAL, HotkeyAction.REPLACE);
    }

    static buildMetadata({modifiers = [], key = '', bindType = 'bind', originalDispatcher = '', originalArgs = ''} = {}) {
        return {
            modifiers,
            key,
            bindType,
            originalDispatcher,
            originalArgs
        };
    }

    static create(source, action, hotkeyId, dispatcher, args, metadata = {}) {
        return new HotkeyOverride(hotkeyId, dispatcher, args, source, action, HotkeyOverride.buildMetadata(metadata));
    }
}
