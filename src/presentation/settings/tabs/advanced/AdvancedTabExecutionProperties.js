import { applyAdvancedTabExecutionPropertiesCore } from './AdvancedTabExecutionPropertiesCore.js';
import { applyAdvancedTabExecutionPropertiesSection } from './AdvancedTabExecutionPropertiesSection.js';
import { applyAdvancedTabExecutionPropertiesTiming } from './AdvancedTabExecutionPropertiesTiming.js';

export function applyAdvancedTabExecutionProperties(targetPrototype) {
    [
        applyAdvancedTabExecutionPropertiesCore,
        applyAdvancedTabExecutionPropertiesSection,
        applyAdvancedTabExecutionPropertiesTiming
    ].forEach((applyMixin) => applyMixin(targetPrototype));
}
