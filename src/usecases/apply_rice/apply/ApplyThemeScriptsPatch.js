import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Commands } from '../../../infrastructure/constants/Commands.js';
import { themesDir } from './ApplyThemeHelpers.js';
import { processGtkEvents } from '../../../infrastructure/utils/Utils.js';
import {
    PATTERN_TRAILING_BACKGROUND,
    PATTERN_SCRIPT_DIR,
    PATTERN_SUDO_USAGE,
    PATTERN_SCRIPT_SHEBANG,
    PATTERN_TERMINAL_LAUNCHER,
    PATTERN_TERMINAL_INJECT
} from './ApplyThemeScriptsConstants.js';

class ApplyThemeScriptsPatch {
    findFirstExistingPath(candidates = []) {
        for (const candidate of candidates) {
            if (typeof candidate !== 'string' || candidate.length === 0) {
                continue;
            }
            if (Gio.File.new_for_path(candidate).query_exists(null)) {
                return candidate;
            }
        }
        return null;
    }

    preparePatchedInstallEnv(installScript, theme, settings) {
        const patchedScript = installScript ? this.patchInstallScriptSync(installScript, theme, settings) : null;
        if (!patchedScript) return {patchedEnv: {}, flagFiles: {}};

        ((f) => f.query_exists(null) && f.delete(null))(Gio.File.new_for_path(patchedScript.flagFile));

        return {
            patchedEnv: {PATCHED_INSTALL_SCRIPT: patchedScript.path, PATCHED_INSTALL_SCRIPT_FLAG_FILE: patchedScript.flagFile},
            flagFiles: {PATCHED_INSTALL_SCRIPT_FLAG_FILE: patchedScript.flagFile}
        };
    }

    preparePatchedPostInstallEnv(postInstallScript, theme, settings) {
        const patchedEnv = {};

        const shouldPatch = postInstallScript && settings.enable_dependency_isolation;
        if (!shouldPatch) return {patchedEnv};

        const patchedScript = this.patchPostInstallScriptSync(postInstallScript, theme, settings);
        patchedScript && (patchedEnv.PATCHED_POSTINSTALL_SCRIPT = patchedScript);
        return {patchedEnv};
    }

    selectInstallScript(theme, selectedInstallScript = null) {
        const themeDir = `${themesDir()}/${theme.name}`;
        if (selectedInstallScript) {
            const selectedCandidates = [
                `${themeDir}/start-scripts/${selectedInstallScript}`,
                `${themeDir}/scripts/${selectedInstallScript}`,
                `${themeDir}/${selectedInstallScript}`
            ];
            return this.findFirstExistingPath(selectedCandidates) || selectedCandidates[0];
        }

        return this.findFirstExistingPath([
            `${themeDir}/start-scripts/installThemeApps.sh`,
            `${themeDir}/start-scripts/install_theme_apps.sh`,
            `${themeDir}/scripts/installThemeApps.sh`,
            `${themeDir}/scripts/install_theme_apps.sh`
        ]);
    }

    selectPostInstallScript(theme) {
        const themeDir = `${themesDir()}/${theme.name}`;
        const candidates = [
            `${themeDir}/start-scripts/setAfterInstallActions.sh`,
            `${themeDir}/start-scripts/set_after_install_actions.sh`,
            `${themeDir}/scripts/setAfterInstallActions.sh`,
            `${themeDir}/scripts/set_after_install_actions.sh`
        ];
        return this.findFirstExistingPath(candidates);
    }

    prepareScripts(theme, settings, operations, selectedInstallScript) {
        processGtkEvents();

        const installScript = operations.skipInstall ? null : this.selectInstallScript(theme, selectedInstallScript),
            postInstallScript = this.selectPostInstallScript(theme);

        processGtkEvents();
        const verifyScript = (script, error) =>
            (!script || this.enforceScriptSafetySync(script, settings)) ? null : error,
            scriptError = verifyScript(installScript, 'Install script safety check failed')
                || verifyScript(postInstallScript, 'Post-install script safety check failed');
        if (scriptError) return {success: false, error: scriptError};

        processGtkEvents();
        const {patchedEnv, flagFiles} = this.preparePatchedInstallEnv(installScript, theme, settings);

        processGtkEvents();
        const postInstallResult = this.preparePatchedPostInstallEnv(postInstallScript, theme, settings);
        Object.assign(patchedEnv, postInstallResult.patchedEnv);

        return {
            success: true,
            installScript,
            postInstallScript: postInstallResult.patchedEnv.PATCHED_POSTINSTALL_SCRIPT || postInstallScript,
            patchedEnv,
            flagFiles
        };
    }

    patchInstallScriptSync(scriptPath, theme, settings) {
        processGtkEvents();
        const [ok, content] = Gio.File.new_for_path(scriptPath).query_exists(null)
            ? GLib.file_get_contents(scriptPath) : [false, null];
        if (!ok) return null;

        let text = new TextDecoder('utf-8').decode(content)
            .replace(PATTERN_TRAILING_BACKGROUND, "'");

        const timestamp = Date.now(),
            scriptDir = scriptPath.replace(PATTERN_SCRIPT_DIR, ''),
            flagFile = `/tmp/lastlayer_script_completed_${theme.name}_${timestamp}.flag`,
            usesSudo = PATTERN_SUDO_USAGE.test(text),
            sudoDir = `/tmp/lastlayer_sudo_${theme.name}_${timestamp}`;

        processGtkEvents();
        const {preamble: isolationPreamble, path: isolationPreamblePath} = settings.enable_dependency_isolation
            ? this.getCachedIsolationPreamble(theme.name, settings)
            : {preamble: '', path: ''};
        settings.enable_dependency_isolation
            && isolationPreamble
            && !GLib.file_test(isolationPreamblePath, GLib.FileTest.EXISTS)
            && (GLib.file_set_contents(isolationPreamblePath, isolationPreamble),
                GLib.spawn_sync(null, [Commands.CHMOD, '+x', isolationPreamblePath], null, GLib.SpawnFlags.SEARCH_PATH, null));
        processGtkEvents();

        const preambleBase = this.renderApplyScriptPreamble({scriptDir, flagFile, sudoDir}),
            sudoBlock = usesSudo ? this.renderApplyScriptSudoBlock() : '';
        if (!preambleBase || (usesSudo && !sudoBlock)) return null;

        text = text.replace(PATTERN_SCRIPT_SHEBANG, '');

        PATTERN_TERMINAL_LAUNCHER.test(text) && settings.enable_dependency_isolation && (text = text.replace(
            PATTERN_TERMINAL_INJECT,
            `$1set +e\nsource "${isolationPreamblePath}"\n`
        ));

        text = `${preambleBase}${sudoBlock}${isolationPreamble}\n${text}\n\nllWriteFlag\n`;
        settings.patcher_hold_terminal && (text += `echo "\\n ${this.translate('SCRIPT_HOLD_TERMINAL_MESSAGE', 'Script finished. Press Enter to close the terminal...')}"\nread -r`);

        GLib.file_set_contents(`/tmp/lastlayer_patched_install_script_${timestamp}.sh`, text);
        GLib.spawn_sync(null, [Commands.CHMOD, '+x', `/tmp/lastlayer_patched_install_script_${timestamp}.sh`], null, GLib.SpawnFlags.SEARCH_PATH, null);
        return {path: `/tmp/lastlayer_patched_install_script_${timestamp}.sh`, flagFile};
    }
}

export function applyApplyThemeScriptsPatch(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeScriptsPatch.prototype);
}
