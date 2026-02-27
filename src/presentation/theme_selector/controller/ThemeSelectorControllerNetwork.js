import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import { applyThemeSelectorControllerNetworkApply } from './ThemeSelectorControllerNetworkApply.js';
import { applyThemeSelectorControllerNetworkLoad } from './ThemeSelectorControllerNetworkLoad.js';
import { applyThemeSelectorControllerNetworkStats } from './ThemeSelectorControllerNetworkStats.js';

class ThemeSelectorControllerNetwork {
}

export function applyThemeSelectorControllerNetwork(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerNetwork.prototype);
}

[
    applyThemeSelectorControllerNetworkLoad,
    applyThemeSelectorControllerNetworkStats,
    applyThemeSelectorControllerNetworkApply
].forEach((applyMixin) => applyMixin(ThemeSelectorControllerNetwork.prototype));
