export function applyHyprlandOverridePopupRowsValues(prototype) {
    prototype.stripComment = function(value) {
        if (value === null || value === undefined) {
            return value;
        }
        const str = String(value);
        const hashIndex = str.indexOf('#');
        return hashIndex === -1
            ? str.trim()
            : str.substring(0, hashIndex).trim();
    };

    prototype.getPlaceholder = function(param) {
        const type = param.type || 'str';
        const def = this.stripComment(param.defaultValue);

        const globalVal = this.globalOverrides[param.fullPath];
        switch (true) {
        case globalVal !== undefined:
            return `${this.t('GLOBAL_LABEL') || 'Global'}: ${this.stripComment(globalVal)}`;
        case def !== null && def !== undefined && def !== '':
            return `${type}: ${def}`;
        default:
            return type;
        }
    };

    prototype.getCurrentValue = function(paramPath) {
        return this.currentOverrides[paramPath]
            ?? this.globalOverrides[paramPath]
            ?? this.originalValues[paramPath]
            ?? null;
    };

    prototype.getOriginalValue = function(paramPath) {
        return this.originalValues[paramPath] ?? null;
    };
}
