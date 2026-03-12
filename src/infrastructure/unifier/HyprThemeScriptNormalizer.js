import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { tryOrDefault, tryRun } from '../utils/ErrorUtils.js';

export class HyprThemeScriptNormalizer {
    constructor(options = {}) {
        this.logger = options.logger || null;
    }

    log(msg, ...args) {
        if (this.logger?.info) {
            this.logger.info(`[HyprThemeScriptNormalizer] ${msg}`, ...args);
        } else {
            print(`[HyprThemeScriptNormalizer] ${msg} ${args.join(' ')}`);
        }
    }

    patchThemeScripts(themeDir, themeName) {
        const result = { patchedFiles: 0, changes: [], errors: [] };
        const candidates = this.findThemeScripts(themeDir);

        for (const path of candidates) {
            const change = tryOrDefault(
                'HyprThemeScriptNormalizer.patchThemeScripts',
                () => this.patchScript(path, themeName),
                { applied: false, error: 'patch failed' }
            );
            if (change.applied) {
                result.patchedFiles += 1;
                result.changes.push(`${GLib.path_get_basename(path)}: ${change.summary}`);
                continue;
            }
            if (change.error)
                result.errors.push(`${path}: ${change.error}`);
        }

        if (result.patchedFiles > 0) {
            this.log(`Patched ${result.patchedFiles} hyprtheme script(s)`);
        }
        return result;
    }

    findThemeScripts(themeDir) {
        const out = [];
        const roots = [
            `${themeDir}/scripts`,
            `${themeDir}/start-scripts`,
            `${themeDir}/hyprland/scripts`,
        ];

        for (const root of roots) {
            if (!GLib.file_test(root, GLib.FileTest.IS_DIR))
                continue;
            this.walkFiles(root, 3, (path) => {
                const base = GLib.path_get_basename(path);
                if (base === 'hyprtheme.sh' || base === 'hyptheme.sh')
                    out.push(path);
            });
        }

        return out;
    }

    walkFiles(dirPath, maxDepth, onFile) {
        if (maxDepth < 0)
            return;
        const dir = Gio.File.new_for_path(dirPath);
        const enumerator = tryOrDefault(
            'HyprThemeScriptNormalizer.walkFiles.enumerate',
            () => dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null),
            null
        );
        if (!enumerator)
            return;

        let info = null;
        while ((info = enumerator.next_file(null))) {
            const childPath = dir.get_child(info.get_name()).get_path();
            if (!childPath)
                continue;
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                this.walkFiles(childPath, maxDepth - 1, onFile);
                continue;
            }
            if (info.get_file_type() === Gio.FileType.REGULAR)
                onFile(childPath);
        }
        tryRun('HyprThemeScriptNormalizer.walkFiles.close', () => enumerator.close(null));
    }

    patchScript(path, themeName) {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok || !bytes) {
            return { applied: false };
        }

        const content = new TextDecoder('utf-8').decode(bytes);
        if (!content.includes('hyprctl reload')) {
            return { applied: false };
        }
        if (!content.includes('/.config/hypr/hyprland.conf') && !content.includes('COMMON_FILE') && !content.includes('hyprland.conf')) {
            return { applied: false };
        }

        const marker = 'LastLayer: re-apply runtime overrides after reload';
        let next = content;
        let changed = false;
        const summaries = [];

        if (!next.includes('LastLayer: skip opening tinkerer docs')) {
            const editorChainRe = /(^[ \t]*if[ \t]+command[ \t]+-v[ \t]+nvim[\s\S]*?^[ \t]*elif[ \t]+command[ \t]+-v[ \t]+xdg-open[^\n]*\n[\s\S]*?^[ \t]*fi[ \t]*\n)/m;
            if (editorChainRe.test(next) && next.includes('TINKERER_MD=')) {
                const replacement = [
                    '    # LastLayer: skip opening tinkerer docs',
                    '',
                ].join('\n');
                next = next.replace(editorChainRe, `${replacement}`);
                changed = true;
                summaries.push('tinkerer-no-open');
            }
        }

        if (!next.includes('LastLayer: skip opening tinkerer docs') && next.includes('LastLayer: avoid interactive editor in tinkerer mode')) {
            const oldBlock = /(^[ \t]*# LastLayer: avoid interactive editor in tinkerer mode[^\n]*\n(?:^[ \t]*if[^\n]*\n)?(?:^[ \t]*open_editor[^\n]*\n)?(?:^[ \t]*fi[^\n]*\n)?)/m;
            if (oldBlock.test(next)) {
                next = next.replace(oldBlock, '    # LastLayer: skip opening tinkerer docs\n');
                changed = true;
                summaries.push('tinkerer-no-open');
            }
        }

        if (!next.includes('LastLayer: prevent overlapping theme toggles')) {
            const lockSnippet = [
                '',
                '# LastLayer: prevent overlapping theme toggles',
                'if command -v flock >/dev/null 2>&1; then',
                `    exec 9>"$HOME/.cache/lastlayer/${themeName}-hyprtheme.lock"`,
                '    flock -n 9 || exit 0',
                'fi',
                '',
            ].join('\n');

            const setELine = /(^[ \t]*set -e[^\n]*\n)/m;
            if (setELine.test(next)) {
                next = next.replace(setELine, `$1${lockSnippet}`);
                changed = true;
                summaries.push('lock');
            }
        }

        const beforeSymlink = next;
        next = next.replace(
            /\n[ \t]*rm -f[ \t]+\"?\$COMMON_FILE\"?[ \t]*\n[ \t]*ln -fs[ \t]+\"?\$SRC\"?[ \t]+\"?\$COMMON_FILE\"?[ \t]*\n/g,
            '\nln -sfn "$SRC" "$COMMON_FILE"\n'
        );
        next = next.replace(/\bln -fs\b/g, 'ln -sfn');
        if (next !== beforeSymlink) {
            changed = true;
            summaries.push('atomic-symlink');
        }

        if (!next.includes('LastLayer: avoid theme-dir symlink') && next.includes('.config/themes/') && next.includes('ln -sfn')) {
            const linkLineRe = /(^[ \t]*ln -sfn[ \t]+\"?\$SRC\"?[ \t]+\"?\$COMMON_FILE\"?[ \t]*\n)/m;
            if (linkLineRe.test(next)) {
                const copyBlock = [
                    '# LastLayer: avoid theme-dir symlink',
                    'tmp="$(mktemp "${COMMON_FILE}.tmp.XXXXXX")"',
                    'cp -f "$SRC" "$tmp"',
                    'mv -f "$tmp" "$COMMON_FILE"',
                    '',
                ].join('\n');
                next = next.replace(linkLineRe, `${copyBlock}\n`);
                changed = true;
                summaries.push('no-theme-symlink');
            }
        }

        if (!next.includes(marker)) {
            const reloadLineRe = /(^[ \t]*hyprctl[ \t]+reload[^\n]*\n)/m;
            if (reloadLineRe.test(next)) {
                const overrideBlock = [
                    '',
                    `# ${marker}`,
                    '# The toggler swaps the main config file; runtime overrides can be lost on reload.',
                    'for f in "$HOME/.config/hypr/.lastlayer-overrides.conf" "$HOME/.config/hypr/.lastlayer-keybinds.conf" "$HOME/.config/hypr/.lastlayer-recommendations.conf"; do',
                    '  if [ -f "$f" ]; then',
                    '    hyprctl keyword source "$f" >/dev/null 2>&1 || true',
                    '  fi',
                    'done',
                    '',
                ].join('\n');

                next = next.replace(reloadLineRe, `$1${overrideBlock}`);
                changed = true;
                summaries.push('re-source-overrides');
            }
        }

        if (!changed) {
            return { applied: false };
        }

        GLib.file_set_contents(path, next);
        return { applied: true, summary: summaries.join(', ') || 'patched' };
    }
}
