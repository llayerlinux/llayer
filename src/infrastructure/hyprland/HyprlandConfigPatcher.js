import GLib from 'gi://GLib';
import { tryOrNull, tryRun } from '../utils/ErrorUtils.js';

export function patchConfigSource(configPath, sourceLine, {confMarker, comment}) {
    if (!configPath || !GLib.file_test(configPath, GLib.FileTest.EXISTS)) return false;

    const result = tryOrNull('patchConfigSource.read', () => GLib.file_get_contents(configPath));
    if (!result) return false;
    const [ok, contents] = result;
    if (!ok) return false;

    const text = new TextDecoder().decode(contents);
    const lines = text.split('\n');
    const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed === ''
            || (!trimmed.includes(confMarker) && trimmed !== comment);
    });
    const base = filtered.join('\n').replace(/\s+$/, '');
    const suffix = [comment, sourceLine].join('\n');
    const next = base ? `${base}\n\n${suffix}\n` : `${suffix}\n`;
    return tryRun('patchConfigSource.write', () => GLib.file_set_contents(configPath, next));
}

export function patchConfigSourceCandidates(candidates, sourceLine, options) {
    let anyPatched = false;
    for (const configPath of candidates) {
        anyPatched = patchConfigSource(configPath, sourceLine, options) || anyPatched;
    }
    return anyPatched;
}
