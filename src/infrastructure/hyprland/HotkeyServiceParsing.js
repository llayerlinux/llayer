import {copyPrototypeDescriptors} from '../utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { HyprlandHotkey, resetHotkeyIdCounter } from '../../domain/entities/HyprlandHotkey.js';
import { tryOrNull } from '../utils/ErrorUtils.js';

const UTF8_DECODER = new TextDecoder('utf-8');
const HOTKEY_MODIFIER_NAMES = new Set(['CTRL', 'SHIFT', 'ALT', 'SUPER']);
const DISPLAY_MODIFIERS = {
    'SUPER': 'Super',
    'SHIFT': 'Shift',
    'CTRL': 'Ctrl',
    'CONTROL': 'Ctrl',
    'ALT': 'Alt'
};
const MOUSE_BUTTON_LABELS = {
    '272': 'Mouse Left',
    '273': 'Mouse Right',
    '274': 'Mouse Middle'
};

function standardizeModifierToken(modifier) {
    const upper = modifier.toUpperCase();
    const normalized = upper === 'CONTROL' ? 'CTRL' : upper;
    return HOTKEY_MODIFIER_NAMES.has(normalized) ? normalized : modifier;
}

class HotkeyServiceParsing {
    isDir(path) {
        return GLib.file_test(path, GLib.FileTest.IS_DIR);
    }

    isFile(path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    }

    readJsonFile(path) {
        const readResult = tryOrNull('HotkeyServiceParsing.readJsonFile.read', () => GLib.file_get_contents(path));
        const [success, contents] = readResult || [];
        if (!readResult) return {data: null, error: new Error('Failed to read json file')};
        if (!success) return {data: null, error: null};
        const parsed = tryOrNull('HotkeyServiceParsing.readJsonFile.parse', () => JSON.parse(UTF8_DECODER.decode(contents)));
        return parsed ? {data: parsed, error: null} : {data: null, error: new Error('Failed to parse json file')};
    }

    parseThemeOriginals(themePath, options = {}) {
        resetHotkeyIdCounter();

        const hotkeys = [];
        const confFiles = this.findAllConfFiles(themePath);
        const includeGenerated = options.includeGenerated === true;

        for (const confFile of confFiles) {
            const name = confFile.split('/').pop() || '';
            const isGeneratedFile = name.startsWith('.lastlayer-') && name.endsWith('.conf');
            if (!includeGenerated && isGeneratedFile) {
                continue;
            }
            hotkeys.push(...this.parseConfFile(confFile));
        }

        return hotkeys;
    }

    findAllConfFiles(themePath) {
        let confFiles = [];

        let scanDir = (dirPath) => {
            if (!this.isDir(dirPath)) return;

            const enumerator = tryOrNull(
                `findAllConfFiles.${dirPath}`,
                () => Gio.File.new_for_path(dirPath).enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                )
            );
            if (!enumerator) {
                this.log(`Error scanning directory ${dirPath}`);
                return;
            }

            let info;
            while ((info = enumerator.next_file(null))) {
                let name = info.get_name(),
                    fullPath = `${dirPath}/${name}`,
                    fileType = info.get_file_type();
                switch (fileType) {
                case Gio.FileType.DIRECTORY: {
                    const isIgnoredDir = ['.original', 'node_modules', '.git', '.backups'].includes(name)
                        || name.startsWith('.');
                    !isIgnoredDir && scanDir(fullPath);
                    break;
                }
                case Gio.FileType.REGULAR:
                    name.endsWith('.conf') && confFiles.push(fullPath);
                    break;
                default:
                    break;
                }
            }
            enumerator.close(null);
        };

        const hyprlandMainConf = `${themePath}/hyprland.conf`,
            hyprlandDir = `${themePath}/hyprland`;
        this.isFile(hyprlandMainConf) && confFiles.push(hyprlandMainConf);
        this.isDir(hyprlandDir) && scanDir(hyprlandDir);

        return [...new Set(confFiles)].sort();
    }

    parseConfFile(filePath) {
        const [success, contents] = tryOrNull(`parseConfFile.${filePath}`, () => GLib.file_get_contents(filePath)) || [];
        if (!success || !contents) return [];
        return UTF8_DECODER.decode(contents).split('\n')
            .map((rawLine, i) => [rawLine.trim(), i + 1])
            .filter(([line]) => line && !line.startsWith('#'))
            .map(([line, lineNum]) => ((m) => m && this.parseBind(m[1].toLowerCase(), m[2].trim(), filePath, lineNum))(line.match(this.bindPattern)))
            .filter(Boolean);
    }

    parseBind(bindType, bindArgs, sourceFile = '', lineNumber = 0) {
        return HyprlandHotkey.fromBindLine(bindType, bindArgs, sourceFile, lineNumber);
    }

    buildKeyCombo(modifiers, key) {
        const sortedMods = [...(modifiers ?? [])].sort();
        const modStr = sortedMods.length > 0 ? sortedMods.join('_') : 'NONE';
        return `${modStr}:${key.toUpperCase()}`;
    }

    loadModifierVariables(themePath) {
        if (!themePath) return {};
        if (this.modifierVarCache.get(themePath)) return this.modifierVarCache.get(themePath);

        let vars = {};
        for (const filePath of [
            `${themePath}/hyprland/env.conf`,
            `${themePath}/hyprland/keybinds.conf`,
            `${themePath}/hyprland.conf`,
            `${themePath}/hyprland/general.conf`
        ].filter(p => GLib.file_test(p, GLib.FileTest.IS_REGULAR))) {
            let [ok, contents] = tryOrNull('loadModifierVariables', () => GLib.file_get_contents(filePath)) || [];
            (ok && contents) && UTF8_DECODER.decode(contents).split('\n').forEach((line) => {
                let trimmed = line.trim(),
                    match = trimmed && !trimmed.startsWith('#') && !trimmed.toLowerCase().startsWith('env ')
                        && trimmed.match(/^\$([A-Za-z0-9_]+)\s*=\s*(.+)$/);
                match && (vars[`$${match[1]}`] = match[2].trim());
            });
        }

        this.modifierVarCache.set(themePath, vars);
        return vars;
    }

    standardizeModifiers(modifiers, themePath) {
        const vars = this.loadModifierVariables(themePath);
        const expanded = [];
        for (const raw of (modifiers ?? []).map((mod) => String(mod ?? '').trim()).filter(Boolean)) {
            for (const part of (raw.includes('+') ? raw.split('+') : [raw]).map((chunk) => chunk.trim()).filter(Boolean)) {
                (vars[part] || null)
                    ? expanded.push(...vars[part].split(/[\s+]+/).map(v => v.trim()).filter(Boolean))
                    : expanded.push(part);
            }
        }

        return expanded.map((mod) => standardizeModifierToken(mod));
    }

    formatDisplayKeyCombo(modifiers, key) {
        return [...(modifiers ?? []).map(m => this.formatModifier(m)), this.formatKey(key)].join(' + ');
    }

    formatModifier(mod) {
        return DISPLAY_MODIFIERS[mod.toUpperCase()] || mod;
    }

    formatKey(key) {
        switch (true) {
        case key.startsWith('mouse:'): {
            const button = key.split(':')[1];
            return MOUSE_BUTTON_LABELS[button] || `Mouse ${button}`;
        }
        case /^[fF]\d+$/.test(key) || key.length === 1:
            return key.toUpperCase();
        default:
            return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
        }
    }

    getAvailableDispatchers(themePath) {
        const hotkeys = this.parseThemeOriginals(themePath);
        const dispatchers = new Set();

        for (const hotkey of hotkeys) {
            hotkey.dispatcher && dispatchers.add(hotkey.dispatcher);
        }

        for (const d of [
            'exec', 'killactive', 'workspace', 'movetoworkspace',
            'togglefloating', 'fullscreen', 'movefocus', 'movewindow',
            'resizeactive', 'exit', 'togglespecialworkspace', 'pseudo',
            'togglesplit', 'focusmonitor', 'movecurrentworkspacetomonitor'
        ]) {
            dispatchers.add(d);
        }

        return Array.from(dispatchers).sort();
    }
}

export function applyHotkeyServiceParsing(prototype) {
    copyPrototypeDescriptors(prototype, HotkeyServiceParsing.prototype);
}
