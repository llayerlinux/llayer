import { ServerEditHttpService } from '../../infrastructure/network/ServerEditHttpService.js';

export function applyServerEditControllerHttp(targetPrototype) {
    targetPrototype.getHttpService = function() {
        this.httpService ||= new ServerEditHttpService();
        return this.httpService;
    };

    targetPrototype.sendHttpJsonCallback = function(method, url, payload, options = {}, callback) {
        this.getHttpService().sendJson({
            method,
            url,
            payload,
            timeout: 30,
            allowInsecure: !!options.allowInsecure,
            authorizationHeader: options.authorizationHeader,
            userAgent: 'LastLayer/ServerEdit/2.0'
        }, callback);
    };

    targetPrototype.sendHttpMultipartCallback = function(method, url, payload, options = {}, callback) {
        this.getHttpService().sendMultipart({
            method,
            url,
            payload,
            timeout: 120,
            allowInsecure: !!options.allowInsecure,
            authorizationHeader: options.authorizationHeader,
            userAgent: 'LastLayer/ServerEdit/2.0'
        }, callback);
    };
}
