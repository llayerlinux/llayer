import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';

const MAINMOD_OPTIONS = ['SUPER', 'ALT', 'CTRL', 'SHIFT', 'SUPER SHIFT', 'SUPER ALT', 'SUPER CTRL'];
const HOTKEY_MODIFIERS = new Set(['SUPER', 'ALT', 'CTRL', 'SHIFT', 'MOD1', 'MOD2', 'MOD3', 'MOD4', 'MOD5']);
const DEFAULT_MAINMOD = 'SUPER';
const MAINMOD_DEFINITION_REGEX = /^\$mainMod\s*=\s*(\S+)/i;
const UTF8_DECODER = new TextDecoder();

function parseMainModDefinition(line) {
    const match = line.match(MAINMOD_DEFINITION_REGEX);
    return match ? match[1].toUpperCase() : null;
}

function isHiddenDirectory(name) {
    return name.startsWith('.');
}

function isConfFile(name) {
    return name.endsWith('.conf');
}

function readFileLines(path, context) {
    const [ok, data] = tryOrDefault(context, () => GLib.file_get_contents(path), [false, null]);
    return ok && data ? UTF8_DECODER.decode(data).split('\n') : null;
}

export function applyHotkeyMainModSupport(prototype) {
    prototype.getMainModInfo = function() {
        const themePath = this.getCurrentThemePath?.(),
            hyprlandDir = `${themePath}/hyprland`;
        if (!(themePath && GLib.file_test(hyprlandDir, GLib.FileTest.IS_DIR))) return null;

        const confFiles = [],
            mainHyprlandConf = `${themePath}/hyprland.conf`,
            scanDir = (dir) => {
            tryRun('getMainModInfo.scanDir', () => {
                const enumerator = Gio.File.new_for_path(dir).enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
                let info;
                while ((info = enumerator.next_file(null))) {
                    const name = info.get_name(), fullPath = `${dir}/${name}`;
                    switch (info.get_file_type()) {
                    case Gio.FileType.DIRECTORY:
                        isHiddenDirectory(name) || scanDir(fullPath);
                        break;
                    case Gio.FileType.REGULAR:
                        isConfFile(name) && confFiles.push(fullPath);
                        break;
                    default:
                        break;
                    }
                }
                enumerator.close(null);
            });
        };
        GLib.file_test(mainHyprlandConf, GLib.FileTest.IS_REGULAR) && confFiles.push(mainHyprlandConf);
        scanDir(hyprlandDir);

        let mainModDef = null, mainModUsed = false;

        for (const filePath of confFiles) {
            for (const [index, rawLine] of (readFileLines(filePath, 'getMainModInfo.parseFile') ?? []).entries()) {
                const line = rawLine.trim(), mainModValue = parseMainModDefinition(line);
                if (mainModValue && !mainModDef) {
                    mainModDef = {
                        value: mainModValue,
                        file: filePath,
                        lineNumber: index + 1
                    };
                }
                mainModUsed ||= /\$mainMod/i.test(line) && /^bind/i.test(line);
            }
        }

        return (mainModDef || mainModUsed) ? {
            used: mainModUsed,
            value: mainModDef?.value || DEFAULT_MAINMOD,
            file: mainModDef?.file || null,
            lineNumber: mainModDef?.lineNumber || 0
        } : null;
    };

    prototype.buildMainModRow = function(container) {
        const mainModInfo = this.getMainModInfo();
        if (!mainModInfo?.used) return;

        const rowBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, margin_bottom: 4
        }),
            label = new Gtk.Label({ label: '$mainMod', halign: Gtk.Align.START });
        label.get_style_context().add_class('dim-label');
        label.set_tooltip_text(this.t('MAINMOD_TOOLTIP') || 'The primary modifier key used for most hotkeys in this theme');
        rowBox.pack_start(label, false, false, 0);

        const combo = new Gtk.ComboBoxText();
        MAINMOD_OPTIONS.forEach((mod) => combo.append_text(mod));
        combo.set_active(Math.max(MAINMOD_OPTIONS.indexOf(mainModInfo.value), 0));
        this.applyPointerCursor?.(combo);

        combo.connect('changed', () => {
            const newValue = combo.get_active_text();
            if (newValue && newValue !== mainModInfo.value) {
                this.changeMainMod(mainModInfo, newValue);
                mainModInfo.value = newValue;
                this.setApplyPending?.(true);
            }
        });

        rowBox.pack_start(combo, false, false, 0);
        container.pack_start(rowBox, false, false, 0);

        const separator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 4, margin_bottom: 8 });
        separator.get_style_context().add_class('dim-label');
        container.pack_start(separator, false, false, 0);
    };

    prototype.changeMainMod = function(mainModInfo, newValue) {
        if (!mainModInfo.file) return undefined;

        const changed = tryRun('changeMainMod', () => {
            const [ok, data] = tryOrDefault('changeMainMod.readFile', () => GLib.file_get_contents(mainModInfo.file), [false, null]);
            if (ok && data) {
                const lines = UTF8_DECODER.decode(data).split('\n'),
                    lineIndex = lines.findIndex((line) => /^\$mainMod\s*=/i.test(line));
                if (lineIndex >= 0) {
                    lines[lineIndex] = `$mainMod = ${newValue}`;
                    GLib.file_set_contents(mainModInfo.file, lines.join('\n'));
                }
            }
        });
        changed || this.logger?.error?.('Failed to change mainMod');
    };

    prototype.standardizeKeyComboWithMainMod = function(keyCombo) {
        if (!keyCombo) return '';

        this._cachedMainModInfo ||= this.getMainModInfo();
        const mainModValue = this._cachedMainModInfo?.value || DEFAULT_MAINMOD,
            normalized = keyCombo.toUpperCase()
                .replace(/\$MAINMOD/gi, mainModValue)
                .replace(/\+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim(),
            separatorIndex = normalized.indexOf(':'),
            modsPart = (separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : ''),
            keyPart = (separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : normalized).trim(),
            parsed = {
                modifiers: modsPart
                    ? modsPart.split(/[_\s]+/).filter(Boolean).filter((part) => part !== 'NONE' && HOTKEY_MODIFIERS.has(part))
                    : [],
                key: keyPart
            };

        parsed.modifiers.sort();
        return parsed.key
            ? `${parsed.modifiers.length > 0 ? parsed.modifiers.join('_') : 'NONE'}:${parsed.key}`
            : '';
    };
}
