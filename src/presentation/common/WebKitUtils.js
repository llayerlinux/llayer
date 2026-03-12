import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';

export function getWebKit2() {
    for (const version of ['4.1', '4.0']) {
        const webKit = tryOrNull(`WebKitUtils.getWebKit2.${version}`, () => {
            imports.gi.versions.WebKit2 = version;
            return imports.gi.WebKit2;
        });
        if (webKit) {
            return webKit;
        }
    }

    return null;
}
