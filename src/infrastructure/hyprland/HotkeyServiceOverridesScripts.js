import GLib from 'gi://GLib';
import { HotkeyAction } from '../../domain/valueObjects/HotkeyOverride.js';
import { tryRun } from '../utils/ErrorUtils.js';
import { patchConfigSource } from './HyprlandConfigPatcher.js';

export function applyHotkeyServiceOverridesScripts(targetPrototype) {
    targetPrototype.generateOverrideScript = function(collection, _themePath) {
        const lines = ['# Hyprland hotkey overrides', 'applyHotkeyOverrides() {'],
            overrides = collection.getApplicableOverrides();

        for (const [, override] of Object.entries(overrides)) {
            const metadata = override.metadata ?? {},
                modStr = (metadata.modifiers ?? []).join(' '), key = metadata.key || '',
                bindType = metadata.bindType || 'bind',
                dispatcher = override.dispatcher || '', args = override.args || '';

            switch (override.action) {
                case HotkeyAction.DELETE:
                    lines.push(`    # Delete: ${modStr} + ${key}`);
                    lines.push(`    hyprctl keyword unbind "${modStr}, ${key}" 2>/dev/null || true`);
                    break;
                case HotkeyAction.ADD:
                case HotkeyAction.REPLACE:
                    lines.push(`    # ${override.action === HotkeyAction.ADD ? 'Add' : 'Replace'}: ${modStr} + ${key}`);
                    lines.push(`    hyprctl keyword unbind "${modStr}, ${key}" 2>/dev/null || true`);
                    lines.push(`    hyprctl keyword ${bindType} "${modStr}, ${key}, ${dispatcher}, ${args}" 2>/dev/null || true`);
                    break;
                default:
                    break;
            }
        }

        lines.push('}');
        lines.push('');
        lines.push('applyHotkeyOverrides');

        return lines.join('\n');
    };

    targetPrototype.getEffectiveOverridesPath = function(themePath) {
        return `${themePath}/.effective_hotkeys.json`;
    };

    targetPrototype.writeEffectiveOverrides = function(themePath, settings, {skipMainConfigPatch = false} = {}) {
        const collection = this.getMergedHotkeys(themePath, settings),
            effective = collection.getEffectiveOverrides(),
            filteredEffective = {};

        for (const [id, entry] of Object.entries(effective)) {
            if (!entry) continue;

            if (entry?.metadata?.modifiers) {
                entry.metadata.modifiers = this.standardizeModifiers(entry.metadata.modifiers, themePath);
            }

            if (entry.action === HotkeyAction.ADD) {
                filteredEffective[id] = entry;
                continue;
            }

            const originalHotkey = collection.getOriginalHotkey(id);
            if (originalHotkey) {
                entry.metadata = {
                    ...(entry.metadata ?? {}),
                    modifiers: this.standardizeModifiers(originalHotkey.modifiers ?? [], themePath),
                    key: originalHotkey.key || '',
                    bindType: originalHotkey.bindType || 'bind'
                };
            }

            if (entry.action === HotkeyAction.DELETE && !originalHotkey) continue;

            filteredEffective[id] = entry;
        }

        const data = {generatedAt: new Date().toISOString(), hotkeys: filteredEffective},
            saved = tryRun('writeEffectiveOverrides.hotkeys', () => {
            GLib.file_set_contents(this.getEffectiveOverridesPath(themePath), JSON.stringify(data, null, 2));
        });
        if (!saved) {
            this.log('Error writing effective hotkey overrides');
        }

        this.writeKeybindsConf(themePath, filteredEffective, {skipMainConfigPatch});

        return data.hotkeys;
    };

    targetPrototype.writeKeybindsConf = function(themePath, effective, {skipMainConfigPatch = false} = {}) {
        const lines = [
            '# LastLayer hotkey overrides - auto-generated',
            '# This file is sourced after theme keybinds.conf to apply overrides',
            ''
        ],
            vars = this.loadModifierVariables(themePath),
            buildModifierVariants = (mods) => {
            let base = this.standardizeModifiers(mods ?? [], themePath);
            let variants = new Map([[base.join(' '), base]]);

            let superVars = Object.entries(vars)
                .filter(([, v]) => String(v).trim().toUpperCase() === 'SUPER')
                .map(([k]) => k);

            superVars.length > 0 && base.some((m) => m.toUpperCase() === 'SUPER')
                && superVars.forEach((v) => {
                    let replaced = base.map((m) => m.toUpperCase() === 'SUPER' ? v : m);
                    variants.set(replaced.join(' '), replaced);
                });

            return Array.from(variants.values());
        };

        const formatMods = (mods) => (mods ?? []).join(' ').trim(),
            existingActions = new Map(),
            originals = this.parseThemeOriginals(themePath, { includeGenerated: false }) ?? [];
        for (const hk of originals) {
            const mods = this.standardizeModifiers(hk.modifiers ?? [], themePath),
                combo = this.buildKeyCombo(mods, hk.key || ''),
                action = `${hk.dispatcher || ''} ${hk.args || ''}`.trim();
            if (!combo || !action) continue;
            if (!existingActions.has(combo)) {
                existingActions.set(combo, new Set());
            }
            existingActions.get(combo).add(action);
        }

        const seenKeyCombos = new Set();

        for (const [, entry] of Object.entries(effective ?? {})) {
            if (!entry || entry.source === 'original') continue;

            const metadata = entry.metadata ?? {},
                modVariants = buildModifierVariants(metadata.modifiers ?? []),
                key = metadata.key || '';
            if (!key) continue;

            const mods = modVariants[0], combo = this.buildKeyCombo(mods, key),
                dispatcher = entry.dispatcher || '', args = entry.args || '',
                bindType = metadata.bindType || 'bind', action = entry.action || 'replace';

            if (seenKeyCombos.has(combo)) continue;

            const existing = existingActions.get(combo) || new Set(),
                shouldUnbind = action === HotkeyAction.DELETE || action === HotkeyAction.REPLACE
                    || (action === HotkeyAction.ADD && existing.size > 0);

            if (action === HotkeyAction.DELETE && existing.size === 0) continue;

            switch (action) {
                case HotkeyAction.DELETE:
                    modVariants.forEach((mv) => lines.push(
                        `# Delete: ${formatMods(mv)} + ${key}`, `unbind = ${formatMods(mv)}, ${key}`
                    ));
                    break;
                case HotkeyAction.ADD:
                case HotkeyAction.REPLACE: {
                    shouldUnbind && modVariants.forEach((mv) =>
                        lines.push(`# Unbind before apply: ${formatMods(mv)} + ${key}`, `unbind = ${formatMods(mv)}, ${key}`)
                    );

                    const modsStrBase = formatMods(modVariants[0]),
                        bindLine = (modsStr) => args
                            ? `${bindType} = ${modsStr}, ${key}, ${dispatcher}, ${args}`
                            : `${bindType} = ${modsStr}, ${key}, ${dispatcher}`;
                    lines.push(`# ${action === HotkeyAction.ADD ? 'Add' : 'Replace'}: ${modsStrBase} + ${key} -> ${dispatcher} ${args}`);
                    lines.push(bindLine(modsStrBase));
                    break;
                }
                default:
                    break;
            }

            lines.push('');
            seenKeyCombos.add(combo);
        }

        if (!GLib.file_test(`${themePath}/hyprland`, GLib.FileTest.IS_DIR)) return;

        const saved = tryRun('writeKeybindsConf', () => {
            GLib.file_set_contents(`${themePath}/hyprland/.lastlayer-keybinds.conf`, lines.join('\n'));
            this.ensureKeybindsSource(themePath, {skipMainConfigPatch});
        });
        if (!saved) {
            this.log('Error writing keybinds conf');
        }
    };

    targetPrototype.ensureKeybindsSource = function(themePath, {skipMainConfigPatch = false} = {}) {
        if (!themePath) return false;
        const sourceLine = `source=${themePath}/hyprland/.lastlayer-keybinds.conf`,
            patchOpts = {
                confMarker: '.lastlayer-keybinds.conf',
                comment: '# LastLayer hotkey overrides (auto-generated)'
            },
            candidates = [`${themePath}/hyprland.conf`];
        !skipMainConfigPatch && candidates.push(`${GLib.get_home_dir()}/.config/hypr/hyprland.conf`);

        let anyPatched = false;
        for (const configPath of candidates) {
            const patched = patchConfigSource(configPath, sourceLine, patchOpts);
            !patched && configPath && GLib.file_test(configPath, GLib.FileTest.EXISTS)
                && this.log(`Error patching config for hotkey overrides (${configPath})`);
            anyPatched = patched || anyPatched;
        }
        return anyPatched;
    };
}
