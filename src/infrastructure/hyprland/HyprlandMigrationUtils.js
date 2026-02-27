export function applyHyprlandMigrationUtils(targetPrototype) {
    targetPrototype.log = function(msg) {
        this.logger?.info?.(`[HyprlandMigration] ${msg}`);
    };

    targetPrototype.parseVersion = function(versionStr) {
        if (!versionStr || versionStr === 'unknown') {
            return [0, 0, 0];
        }
        const clean = versionStr.replace(/^v/, '').split('-')[0];
        const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
    };

    targetPrototype.compareVersions = function(a, b) {
        const va = this.parseVersion(a);
        const vb = this.parseVersion(b);
        for (let i = 0; i < 3; i++) {
            const delta = va[i] - vb[i];
            if (delta !== 0) {
                return delta;
            }
        }
        return 0;
    };

    targetPrototype.isVersionAtLeast = function(userVersion, targetVersion) {
        return this.compareVersions(userVersion, targetVersion) >= 0;
    };

    targetPrototype.isTruthyString = function(value) {
        return value === 'true' || value === 'yes' || value === '1';
    };

    targetPrototype.isFalsyString = function(value) {
        return value === 'false' || value === 'no' || value === '0';
    };

    targetPrototype.transformValue = function(value, transform) {
        if (!transform) {
            return value;
        }

        switch (transform) {
            case 'invert':
                return this.isTruthyString(value)
                    ? 'false'
                    : (this.isFalsyString(value) ? 'true' : value);

            case 'boolToInt':
                return ({
                    'true': '1',
                    'yes': '1',
                    'false': '0',
                    'no': '0'
                })[value] || value;

            case 'intToBool': {
                switch (value) {
                case '0':
                    return 'false';
                default:
                    return (value === '1' || parseInt(value, 10) > 0) ? 'true' : value;
                }
            }
            default:
                return value;
        }
    };
}
