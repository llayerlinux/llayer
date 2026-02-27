import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { HyprlandParameter } from '../../domain/entities/HyprlandParameter.js';
import { decodeBytes } from '../utils/Utils.js';
import { HYPRLAND_PARAMS } from './HyprlandParameterDefaults.js';
import { tryOrNull } from '../utils/ErrorUtils.js';

class HyprlandParameterServiceBase {
    log(msg, ...args) {
        this.logger?.info?.(`[HyprlandParameterService] ${msg}`, ...args);
    }

    initialize() {
        if (this._userHyprlandVersion) return;
        this._userHyprlandVersion = this.migration.detectUserVersion();
        this.log(`Detected Hyprland version: ${this._userHyprlandVersion}`);
    }

    getUserHyprlandVersion() {
        !this._userHyprlandVersion && this.initialize();
        return this._userHyprlandVersion;
    }

    buildParameterMap() {
        const map = new Map();
        for (const [path, def] of Object.entries(HYPRLAND_PARAMS)) {
            const [section, ...nameParts] = path.split(':');
            map.set(path, HyprlandParameter.fromDefinition(section, nameParts.join(':'), {
                ...def,
                fullPath: path
            }));
        }
        return map;
    }

    getThemeRootPath(themeName) {
        return `${GLib.get_home_dir()}/.config/themes/${themeName}`;
    }

    readJsonFile(path, errorMessage) {
        let [success, contents] = tryOrNull(
            'HyprlandParameterServiceBase.readJsonFile.read', () => GLib.file_get_contents(path)
        ) || [];
        if (!success || !contents) {
            errorMessage && this.log(errorMessage);
            return null;
        }
        let parsed = tryOrNull(
            'HyprlandParameterServiceBase.readJsonFile.parse',
            () => JSON.parse(decodeBytes(contents))
        );
        !parsed && errorMessage && this.log(errorMessage);
        return parsed;
    }

    readFileText(path) {
        const [success, contents] = GLib.file_get_contents(path);
        return success ? decodeBytes(contents) : null;
    }

    getAllParameters() {
        const params = Array.from(this.parameters.values());
        return params.sort((a, b) => b.popularity - a.popularity);
    }

    getParametersBySection() {
        const sections = {};
        for (const param of this.parameters.values()) {
            const section = param.section;
            if (!sections[section]) {
                sections[section] = [];
            }
            sections[section].push(param);
        }
        return sections;
    }

    getParameter(path) {
        return this.parameters.get(path) || null;
    }
}

export function applyHyprlandParameterServiceBase(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandParameterServiceBase.prototype);
}
