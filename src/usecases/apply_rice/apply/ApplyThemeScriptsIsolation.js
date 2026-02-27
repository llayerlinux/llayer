import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Commands } from '../../../infrastructure/constants/Commands.js';
import { processGtkEvents } from '../../../infrastructure/utils/Utils.js';
import { tryOrNull, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import {
    ISOLATION_PREAMBLE_TEMPLATE,
    POSTINSTALL_ISOLATION_PREAMBLE_TEMPLATE,
    APPLY_SCRIPT_PREAMBLE_TEMPLATE,
    APPLY_SCRIPT_SUDO_BLOCK_TEMPLATE,
    ISOLATION_WRAPPER_TEMPLATE,
    loadTemplate,
    applyTemplate,
    getCachedTemplate
} from './ApplyThemeScriptsTemplates.js';
import {
    ISOLATION_PREAMBLE_CACHE,
    PATTERN_PACMAN_FILE,
    PATTERN_SCRIPT_SHEBANG,
    PATTERN_WRAPPER_BINARY,
    WIDGET_BINARIES
} from './ApplyThemeScriptsConstants.js';

function requireTemplate(template, logger, warningText) {
    return template || (logger?.warn?.(warningText), null);
}

class ApplyThemeScriptsIsolation {
    getIsolationPreambleTemplate() {
        this._isolationPreambleTemplate ||= requireTemplate(
            loadTemplate(ISOLATION_PREAMBLE_TEMPLATE),
            this.logger,
            '[ApplyThemeScripts] Isolation preamble template missing'
        );
        return this._isolationPreambleTemplate || null;
    }

    renderIsolationPreamble({prefix, mode, themeName, venvPath, baseProgramsPath}) {
        const template = this.getIsolationPreambleTemplate();
        return template ? applyTemplate(template, {
            PREFIX: prefix,
            MODE: mode,
            THEME_NAME: themeName,
            VENV_PATH: venvPath,
            BASE_PROGRAMS_PATH: baseProgramsPath
        }) : '';
    }

    renderPostInstallIsolationPreamble({prefix, mode, venvPath}) {
        const template = requireTemplate(
            getCachedTemplate(POSTINSTALL_ISOLATION_PREAMBLE_TEMPLATE),
            this.logger,
            '[ApplyThemeScripts] Post-install isolation preamble template missing'
        );
        return template ? applyTemplate(template, {
            PREFIX: prefix,
            MODE: mode,
            VENV_PATH: venvPath
        }) : null;
    }

    renderApplyScriptPreamble({scriptDir, flagFile, sudoDir}) {
        const template = requireTemplate(
            getCachedTemplate(APPLY_SCRIPT_PREAMBLE_TEMPLATE),
            this.logger,
            '[ApplyThemeScripts] Apply script preamble template missing'
        );
        return template ? applyTemplate(template, {
            SCRIPT_DIR: scriptDir,
            FLAG_FILE: flagFile,
            SUDO_DIR: sudoDir
        }) : null;
    }

    renderApplyScriptSudoBlock() {
        return requireTemplate(
            getCachedTemplate(APPLY_SCRIPT_SUDO_BLOCK_TEMPLATE),
            this.logger,
            '[ApplyThemeScripts] Apply script sudo template missing'
        );
    }

    renderIsolationWrapperScript({binaryName, realBinaryPath, prefix, venvPath}) {
        const template = requireTemplate(
            getCachedTemplate(ISOLATION_WRAPPER_TEMPLATE),
            this.logger,
            '[ApplyThemeScripts] Isolation wrapper template missing'
        );
        return template ? applyTemplate(template, {
            PREFIX: prefix,
            BINARY_NAME: binaryName,
            VENV_PATH: venvPath,
            REAL_BINARY_PATH: realBinaryPath
        }) : null;
    }

    getIsolationCacheKey(themeName, settings) {
        const mode = this.getIsolationModeForRice(themeName, settings);
        return `${themeName}:${mode}:${settings.enable_dependency_isolation ? '1' : '0'}`;
    }

    getCachedIsolationPreamble(themeName, settings) {
        let cacheKey = this.getIsolationCacheKey(themeName, settings);
        if (ISOLATION_PREAMBLE_CACHE.has(cacheKey)) return ISOLATION_PREAMBLE_CACHE.get(cacheKey);

        const ts = Date.now(),
            cached = {
                preamble: this.generateIsolationPreamble(themeName, settings),
                timestamp: ts,
                path: `/tmp/lastlayer_isolation_preamble_${themeName}_${ts}.sh`
            };
        ISOLATION_PREAMBLE_CACHE.set(cacheKey, cached);
        return cached;
    }

    getIsolationModeForRice(themeName, settings) {
        return settings.per_rice_isolation_mode?.[themeName] || settings.isolation_grouping_mode || 'hybrid';
    }

    getIsolationPrefix(themeName, settings) {
        const basePath = `${this.getHomeDir()}/.local/share/lastlayer/programs`;
        const mode = this.getIsolationModeForRice(themeName, settings);

        switch (mode) {
            case 'per-rice':
                return `${basePath}/rices/${themeName}`;
            case 'per-program':
                return `${basePath}`;
            case 'disabled':
                return null;
            case 'hybrid':
            default:
                return `${basePath}/shared`;
        }
    }

    generateIsolationPreamble(themeName, settings) {
        const [mode, prefix] = [
            this.getIsolationModeForRice(themeName, settings),
            this.getIsolationPrefix(themeName, settings)
        ];
        if (!settings.enable_dependency_isolation || mode === 'disabled' || !prefix) return '';

        return this.renderIsolationPreamble({
            prefix, mode, themeName,
            baseProgramsPath: `${this.getHomeDir()}/.local/share/lastlayer/programs`,
            venvPath: `${this.getHomeDir()}/.local/share/lastlayer/programs/rices/${themeName}/venv`
        });
    }

    generateWrapperScript(binaryName, realBinaryPath, prefix, venvPath) {
        return this.renderIsolationWrapperScript({binaryName, realBinaryPath, prefix, venvPath}) || '';
    }

    readPathText(path) {
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return '';
        const [ok, content] = tryOrNull('applyScriptsIsolation.readPathText', () => GLib.file_get_contents(path)) || [];
        return ok ? new TextDecoder('utf-8').decode(content) : '';
    }

    extractWrapperRealBinary(wrapperText = '') {
        if (typeof wrapperText !== 'string' || wrapperText.length === 0) return null;
        return wrapperText.match(PATTERN_WRAPPER_BINARY)?.[1]?.trim()
            || wrapperText.match(/^\s*exec\s+"([^"]+)"\s+"\$@"/m)?.[1]?.trim()
            || null;
    }

    isIsolationWrapperScript(wrapperText = '', binaryName = '') {
        if (typeof wrapperText !== 'string' || wrapperText.length === 0) return false;
        if (wrapperText.includes('LASTLAYER ISOLATION WRAPPER')) return true;
        if (binaryName && wrapperText.includes(`__LL_ISOLATION_BINARY="${binaryName}"`)) return true;
        return wrapperText.includes('__LL_ISOLATION_PREFIX=')
            && wrapperText.includes('exec "')
            && wrapperText.includes('" "$@"');
    }

    isIsolationWrapperPath(path, binaryName = '') {
        const text = this.readPathText(path);
        return this.isIsolationWrapperScript(text, binaryName);
    }

    findRealBinary(binaryName, prefix) {
        const candidates = [
            `${prefix}/bin/${binaryName}-real`,
            `${GLib.get_home_dir()}/.local/bin/${binaryName}`,
            `/usr/local/bin/${binaryName}`,
            `/usr/bin/${binaryName}`,
            `/bin/${binaryName}`
        ];

        for (const candidate of candidates) {
            if (!GLib.file_test(candidate, GLib.FileTest.IS_EXECUTABLE)) continue;
            if (this.isIsolationWrapperPath(candidate, binaryName)) continue;
            return candidate;
        }

        return null;
    }

    copyPackageToPrefix(packageName, prefix) {
        processGtkEvents();

        const [checkOk, checkOut] = GLib.spawn_command_line_sync(`pacman -Qq ${packageName} 2>/dev/null`);
        if (!checkOk || !checkOut || checkOut.length === 0) return false;

        const [ok, stdout] = GLib.spawn_command_line_sync(`pacman -Ql ${packageName} 2>/dev/null`);
        if (!ok || !stdout) return false;

        for (const subdir of ['lib', 'share']) GLib.mkdir_with_parents(`${prefix}/${subdir}`, 0o755);

        const libFiles = [], shareFiles = [], dirsToCreate = new Set();

        for (const line of new TextDecoder('utf-8').decode(stdout).trim().split('\n')) {
            const filePath = line.match(PATTERN_PACMAN_FILE)?.[1]?.trim() || null,
                target = filePath?.startsWith('/usr/lib/')
                    ? {base: 'lib', files: libFiles, strip: '/usr/lib/'.length}
                    : filePath?.startsWith('/usr/share/')
                        ? {base: 'share', files: shareFiles, strip: '/usr/share/'.length}
                        : null,
                relPath = target ? filePath.substring(target.strip) : null,
                destPath = relPath ? `${prefix}/${target.base}/${relPath}` : null,
                destDir = destPath ? destPath.substring(0, destPath.lastIndexOf('/')) : null;

            Boolean(destPath) && !filePath.endsWith('/') && GLib.file_test(filePath, GLib.FileTest.EXISTS)
                && !GLib.file_test(destPath, GLib.FileTest.EXISTS)
                && (dirsToCreate.add(destDir), target.files.push({ src: filePath, dest: destPath }));
        }

        [...dirsToCreate].forEach((dir) => GLib.mkdir_with_parents(dir, 0o755));

        processGtkEvents();

        let allFiles = [...libFiles, ...shareFiles],
            copiedAny = false;

        for (let i = 0; i < allFiles.length; i += 50) {
            i > 0 && processGtkEvents();

            for (const { src, dest } of allFiles.slice(i, i + 50)) {
                tryRun('copyPackageToPrefix.gioCopy', () => {
                    Gio.File.new_for_path(src).copy(Gio.File.new_for_path(dest), Gio.FileCopyFlags.NONE, null, null);
                }) || GLib.spawn_command_line_sync(`cp -a "${src}" "${dest}" 2>/dev/null`);
                copiedAny = true;
            }
        }

        return copiedAny;
    }

    ensureWidgetWrappers(themeName, settings) {
        let prefix = this.getIsolationPrefix(themeName, settings);
        if (!prefix) return;

        let venvPath = `${GLib.get_home_dir()}/.local/share/lastlayer/programs/rices/${themeName}/venv`,
              binDir = `${prefix}/bin`,
              wrappersToCreate = [],
              packagesToCopy = [];

        for (const subdir of ['bin', 'lib', 'share']) GLib.mkdir_with_parents(`${prefix}/${subdir}`, 0o755);

        for (const bin of WIDGET_BINARIES) {
            let systemBinary = this.findRealBinary(bin, prefix);
            if (!systemBinary) continue;

            const wrapperPath = `${binDir}/${bin}`;
            let needsUpdate = true;
            if (GLib.file_test(wrapperPath, GLib.FileTest.EXISTS)) {
                let text = this.readPathText(wrapperPath),
                    isWrapper = this.isIsolationWrapperScript(text, bin),
                    currentRealBinary = this.extractWrapperRealBinary(text);

                isWrapper && currentRealBinary === systemBinary && (needsUpdate = false);

                !isWrapper
                    && text.length > 0
                    && !GLib.file_test(`${binDir}/${bin}-real`, GLib.FileTest.EXISTS)
                    && GLib.spawn_sync(
                        null, [Commands.MV, wrapperPath, `${binDir}/${bin}-real`], null, GLib.SpawnFlags.SEARCH_PATH, null
                    );
            }

            if (!needsUpdate) continue;
            packagesToCopy.push(bin);
            let wrapperContent = this.generateWrapperScript(bin, systemBinary, prefix, venvPath);
            if (!wrapperContent) {
                this.logger?.warn?.('[ApplyThemeScripts] Isolation wrapper template missing');
                continue;
            }
            wrappersToCreate.push({path: `${binDir}/${bin}`, content: wrapperContent});
        }

        processGtkEvents();
        for (const pkg of packagesToCopy) this.copyPackageToPrefix(pkg, prefix);

        processGtkEvents();
        let wrapperPaths = wrappersToCreate.map(({path, content}) => (GLib.file_set_contents(path, content), path));
        wrapperPaths.length > 0
            && GLib.spawn_sync(null, [Commands.CHMOD, '+x', ...wrapperPaths], null, GLib.SpawnFlags.SEARCH_PATH, null);
    }

    patchPostInstallScriptSync(scriptPath, theme, settings) {
        if (!Gio.File.new_for_path(scriptPath).query_exists(null)) return null;

        let [ok, content] = GLib.file_get_contents(scriptPath);
        if (!ok) return null;

        this.ensureWidgetWrappers(theme.name, settings);

        let preamble = this.renderPostInstallIsolationPreamble({
            prefix: this.getIsolationPrefix(theme.name, settings),
            mode: this.getIsolationModeForRice(theme.name, settings),
            venvPath: `${GLib.get_home_dir()}/.local/share/lastlayer/programs/rices/${theme.name}/venv`
        });
        if (!preamble) return null;

        let tmpPath = `/tmp/lastlayer_patched_postinstall_script_${Date.now()}.sh`;
        GLib.file_set_contents(tmpPath, `${preamble}${new TextDecoder('utf-8').decode(content).replace(PATTERN_SCRIPT_SHEBANG, '')}`);
        GLib.spawn_sync(null, [Commands.CHMOD, '+x', tmpPath], null, GLib.SpawnFlags.SEARCH_PATH, null);

        return tmpPath;
    }
}

export function applyApplyThemeScriptsIsolation(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeScriptsIsolation.prototype);
}
