import {
    applyTemplate,
    createTemplatePath,
    getCachedTemplate,
    loadTemplate
} from '../../../infrastructure/scripts/ScriptTemplateStore.js';

const ISOLATION_PREAMBLE_TEMPLATE = createTemplatePath('isolation_preamble.sh');
const POSTINSTALL_ISOLATION_PREAMBLE_TEMPLATE = createTemplatePath('postinstall_isolation_preamble.sh');
const APPLY_SCRIPT_PREAMBLE_TEMPLATE = createTemplatePath('apply_script_preamble.sh');
const APPLY_SCRIPT_SUDO_BLOCK_TEMPLATE = createTemplatePath('apply_script_sudo_block.sh');
const ISOLATION_WRAPPER_TEMPLATE = createTemplatePath('isolation_wrapper.sh');

const TEMPLATE_CACHE = new Map();
const getTemplate = (path) => getCachedTemplate(path, TEMPLATE_CACHE);

export {
    ISOLATION_PREAMBLE_TEMPLATE,
    POSTINSTALL_ISOLATION_PREAMBLE_TEMPLATE,
    APPLY_SCRIPT_PREAMBLE_TEMPLATE,
    APPLY_SCRIPT_SUDO_BLOCK_TEMPLATE,
    ISOLATION_WRAPPER_TEMPLATE,
    loadTemplate,
    applyTemplate,
    getTemplate as getCachedTemplate
};
