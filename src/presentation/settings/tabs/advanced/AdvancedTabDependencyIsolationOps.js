import { applyAdvancedTabDependencyIsolationOpsPrograms } from './AdvancedTabDependencyIsolationOpsPrograms.js';
import { applyAdvancedTabDependencyIsolationOpsVersions } from './AdvancedTabDependencyIsolationOpsVersions.js';
import { applyAdvancedTabDependencyIsolationOpsProcesses } from './AdvancedTabDependencyIsolationOpsProcesses.js';
import { applyAdvancedTabDependencyIsolationOpsHelp } from './AdvancedTabDependencyIsolationOpsHelp.js';

export function applyAdvancedTabDependencyIsolationOps(targetPrototype) {
    applyAdvancedTabDependencyIsolationOpsPrograms(targetPrototype);
    applyAdvancedTabDependencyIsolationOpsVersions(targetPrototype);
    applyAdvancedTabDependencyIsolationOpsProcesses(targetPrototype);
    applyAdvancedTabDependencyIsolationOpsHelp(targetPrototype);
}
