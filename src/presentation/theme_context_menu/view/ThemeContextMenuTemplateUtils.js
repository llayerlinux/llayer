import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';
import { TEMPLATE_DIR, loadTemplate, applyTemplate } from '../../../infrastructure/scripts/ScriptTemplateStore.js';

export function getWebKit2() {
    return tryOrNull('getWebKit2', () => imports.gi.WebKit2);
}

export { TEMPLATE_DIR, loadTemplate, applyTemplate };
