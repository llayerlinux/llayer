import { applyHyprlandMigrationCore } from './HyprlandMigrationCore.js';
import { applyHyprlandMigrationUtils } from './HyprlandMigrationUtils.js';
import { applyHyprlandMigrationVersion } from './HyprlandMigrationVersion.js';

export class HyprlandMigration {
    constructor(logger = null) {
        this.logger = logger;
        this._cachedVersion = null;
    }
}

[
    applyHyprlandMigrationUtils,
    applyHyprlandMigrationVersion,
    applyHyprlandMigrationCore
].forEach((applyMixin) => applyMixin(HyprlandMigration.prototype));

export default HyprlandMigration;
