import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';
import { createAuditedNative } from '../audit/createAuditedNative.js';

export class SwayConfigParser {
    constructor(options = {}, auditLog = null) {
        this._native = createAuditedNative(
            new LastlayerSupporter.SwayConfigParser(),
            'SwayConfigParser',
            auditLog
        );
        this._logger = options.logger || null;
    }

    parseFile(path) {
        return JSON.parse(this._native.parse_file(path));
    }

    parse(content, sourcePath = '') {
        return JSON.parse(this._native.parse_content(content, sourcePath));
    }

    static detectSwayConfig(basePath) {
        return LastlayerSupporter.SwayConfigParser.detect_sway_config(basePath);
    }

    static findSwayConfigs(basePath) {
        return LastlayerSupporter.SwayConfigParser.find_sway_configs(basePath);
    }
}

export default SwayConfigParser;
