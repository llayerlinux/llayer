import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';

class HyprlandParameterServiceParsing {
    parseThemeOriginals(themePath) {
        const originals = {},
            hyprlandDir = `${themePath}/hyprland`,
            configFiles = [
                `${hyprlandDir}/general.conf`,
                `${hyprlandDir}/hyprland.conf`,
                `${themePath}/hyprland.conf`
            ],
            allParams = new Map();

        for (const configFile of configFiles) {
            if (!GLib.file_test(configFile, GLib.FileTest.EXISTS)) continue;

            let parseResult = this.configParser.parseFile(configFile);
            if (!parseResult) continue;
            for (const [path, info] of parseResult.parameters) {
                allParams.set(path, info.value);
            }
        }

        for (const [path, value] of this.migration.migrate(allParams, this.getUserHyprlandVersion())) {
            originals[path] = value;
        }

        return originals;
    }

    parseConfigFile(filePath) {
        return (this.readFileText(filePath) || '').split('\n').reduce((acc, line) => ((t) => {
            if (!t || t.startsWith('#') || (t === '}' && (acc.s = '', true))) return acc;
            let m = t.match(/^(\w+)\s*\{/) || t.match(/^([a-zA-Z_][a-zA-Z0-9_.:]*)\s*=\s*(.+)$/);
            if (!m) return acc;
            m[2] === undefined ? (acc.s = m[1]) : ((fp) => this.parameters.has(fp)
                && (acc.v[fp] = m[2].trim()))(acc.s ? `${acc.s}:${m[1].trim()}` : m[1].trim());
            return acc;
        })(line.trim()), {v: {}, s: ''}).v;
    }
}

export function applyHyprlandParameterServiceParsing(prototype) {
    copyPrototypeDescriptors(prototype, HyprlandParameterServiceParsing.prototype);
}
