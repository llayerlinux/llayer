import { applyServerEditControllerFlow } from './ServerEditControllerFlow.js';
import { applyServerEditControllerHandlers } from './ServerEditControllerHandlers.js';
import { applyServerEditControllerHttp } from './ServerEditControllerHttp.js';
import { applyServerEditControllerPayload } from './ServerEditControllerPayload.js';
import { applyServerEditControllerRequests } from './ServerEditControllerRequests.js';

export class ServerEditController {
    constructor(editView, eventBus, logger, httpService = null) {
        this.editView = editView;
        this.eventBus = eventBus;
        this.logger = logger;
        this.httpService = httpService;
        this.theme = null;
        this.login = null;
        this.password = null;
        this.settings = null;
        this.t = (key) => key;
        this.themeSelectedListenerId = null;
    }
}

[
    applyServerEditControllerFlow,
    applyServerEditControllerHandlers,
    applyServerEditControllerPayload,
    applyServerEditControllerRequests,
    applyServerEditControllerHttp
].forEach((applyMixin) => applyMixin(ServerEditController.prototype));
