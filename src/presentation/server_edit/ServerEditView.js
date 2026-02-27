import {applyServerEditViewCore} from './view/ServerEditViewCore.js';
import {applyServerEditViewDialog} from './view/ServerEditViewDialog.js';

export class ServerEditView {
    constructor(container = null) {
        this.container = container;
        this.dialog = null;
        this.onCommit = null;
        this.onClose = null;
        this.theme = null;
        this.login = null;
        this.password = null;
        this.settings = null;
        this.applyButton = null;
        this.cancelButton = null;
        this.archivePath = null;
        this.previewPath = null;
    }
}

const SERVER_EDIT_VIEW_MIXINS = [
    applyServerEditViewDialog,
    applyServerEditViewCore
];

SERVER_EDIT_VIEW_MIXINS.forEach((applyMixin) => applyMixin(ServerEditView.prototype));
