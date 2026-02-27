import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import { applyServerEditViewDialogFiles } from './ServerEditViewDialogFiles.js';
import { applyServerEditViewDialogShortcuts } from './ServerEditViewDialogShortcuts.js';
import { applyServerEditViewDialogUI } from './ServerEditViewDialogUI.js';

class ServerEditViewDialog {
}

export function applyServerEditViewDialog(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ServerEditViewDialog.prototype);
}

[
    applyServerEditViewDialogFiles,
    applyServerEditViewDialogShortcuts,
    applyServerEditViewDialogUI
].forEach((applyMixin) => applyMixin(ServerEditViewDialog.prototype));
