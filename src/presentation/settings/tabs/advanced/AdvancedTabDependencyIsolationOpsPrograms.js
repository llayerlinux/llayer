import { applyAdvancedTabDependencyIsolationOpsProgramsList } from './AdvancedTabDependencyIsolationOpsProgramsList.js';
import { applyAdvancedTabDependencyIsolationOpsProgramsScan } from './AdvancedTabDependencyIsolationOpsProgramsScan.js';
import { applyAdvancedTabDependencyIsolationOpsProgramsScanFast } from './AdvancedTabDependencyIsolationOpsProgramsScanFast.js';
import { applyAdvancedTabDependencyIsolationOpsProgramsUtils } from './AdvancedTabDependencyIsolationOpsProgramsUtils.js';

export function applyAdvancedTabDependencyIsolationOpsPrograms(prototype) {
    [
        applyAdvancedTabDependencyIsolationOpsProgramsList,
        applyAdvancedTabDependencyIsolationOpsProgramsScanFast,
        applyAdvancedTabDependencyIsolationOpsProgramsScan,
        applyAdvancedTabDependencyIsolationOpsProgramsUtils
    ].forEach((applyMixin) => applyMixin(prototype));
}
