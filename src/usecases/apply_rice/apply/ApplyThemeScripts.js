import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { applyApplyThemeScriptsIsolation } from './ApplyThemeScriptsIsolation.js';
import { applyApplyThemeScriptsPatch } from './ApplyThemeScriptsPatch.js';
import { applyApplyThemeScriptsMonitor } from './ApplyThemeScriptsMonitor.js';
import { ISOLATION_PREAMBLE_CACHE } from './ApplyThemeScriptsConstants.js';

class ApplyThemeScripts {
    static clearIsolationCache() {
        ISOLATION_PREAMBLE_CACHE.clear();
    }

    getHomeDir() {
        return GLib.get_home_dir();
    }
}

export function applyApplyThemeScripts(targetProto) {
    applyApplyThemeScriptsIsolation(targetProto);
    applyApplyThemeScriptsPatch(targetProto);
    applyApplyThemeScriptsMonitor(targetProto);
    copyPrototypeDescriptors(targetProto, ApplyThemeScripts.prototype);
}
