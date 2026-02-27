import { applyHotkeyServiceOverrides } from './HotkeyServiceOverrides.js';
import { applyHotkeyServiceParsing } from './HotkeyServiceParsing.js';

export class HotkeyService {
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.themeRepository = options.themeRepository || null;
        this.settingsManager = options.settingsManager || null;
        this.modifierVarCache = new Map();
        this.bindPattern = /^(bind[mrelon]*)\s*=\s*(.+)$/i;
    }

    log(msg, ...args) {
        this.logger?.info?.(`[HotkeyService] ${msg}`, ...args);
    }
}

applyHotkeyServiceParsing(HotkeyService.prototype);
applyHotkeyServiceOverrides(HotkeyService.prototype);
