import { HyprlandConfigParser } from './HyprlandConfigParser.js';
import { HyprlandMigration } from './HyprlandMigration.js';
import { applyHyprlandParameterServiceApply } from './HyprlandParameterServiceApply.js';
import { applyHyprlandParameterServiceBase } from './HyprlandParameterServiceBase.js';
import { applyHyprlandParameterServiceEffective } from './HyprlandParameterServiceEffective.js';
import { applyHyprlandParameterServiceOverrides } from './HyprlandParameterServiceOverrides.js';
import { applyHyprlandParameterServiceParsing } from './HyprlandParameterServiceParsing.js';

export class HyprlandParameterService {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.themeRepository = options.themeRepository || null;
        this.settingsManager = options.settingsManager || null;
        this.parameters = this.buildParameterMap();

        this.configParser = new HyprlandConfigParser();
        this.migration = new HyprlandMigration(this.logger);
        this._userHyprlandVersion = null;
    }
}

[
    applyHyprlandParameterServiceBase,
    applyHyprlandParameterServiceParsing,
    applyHyprlandParameterServiceOverrides,
    applyHyprlandParameterServiceEffective,
    applyHyprlandParameterServiceApply
].forEach((applyMixin) => applyMixin(HyprlandParameterService.prototype));
