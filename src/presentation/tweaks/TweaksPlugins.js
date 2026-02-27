import { TWEAKS_PLUGINS } from './plugins/index.js';

export const TweaksPlugins = TWEAKS_PLUGINS;

export function applyTweaksPlugins(targetPrototype) {
    for (const [methodName, method] of Object.entries(TweaksPlugins)) {
        typeof method === 'function' && (targetPrototype[methodName] = method);
    }
}
