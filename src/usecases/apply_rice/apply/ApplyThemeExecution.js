import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ScriptBuilder} from '../../../infrastructure/scripts/ScriptBuilder.js';
import {Events} from '../../../app/eventBus.js';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import {ApplyThemeResult} from './ApplyThemeResult.js';
import {createLocalThemeObject, themesDir} from './ApplyThemeHelpers.js';
import {processGtkEvents} from '../../../infrastructure/utils/Utils.js';
import {tryRun} from '../../../infrastructure/utils/ErrorUtils.js';

class ApplyThemeExecution {
    standardizeOptions(options = {}) {
        return {
            isReapplying: false,
            selectedInstallScript: null,
            variant: null,
            source: 'unknown',
            ...options
        };
    }

    buildEnvExportString(patchedEnv) {
        return Object.entries(patchedEnv)
            .filter(([, v]) => typeof v === 'string' && v.length > 0)
            .map(([k, v]) => `export ${k}='${v}'`)
            .join('; ');
    }

    async execute(themeName, options = {}) {
        const normalizedOptions = this.standardizeOptions(options);
        const result = new ApplyThemeResult(true, null);
        const startTime = Date.now();

        this.eventBus?.emit?.(Events.THEME_APPLY_START, {themeName});

        return new Promise((resolve) => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.executeThemeApplication(themeName, normalizedOptions, result, startTime)
                    .then(resolve)
                    .catch((e) => {
                        result.success = false;
                        result.addError(e?.message || 'Unknown error');
                        resolve(result);
                    });
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    async executeThemeApplication(themeName, normalizedOptions, result, startTime) {
        processGtkEvents();

        let theme = this.validateThemeSync(themeName);

        if (!theme) {
            let message = this.translate('THEME_NOT_FOUND', {theme: themeName});
            result.success = false;
            result.addError(message);
            this.notifier?.error(this.translate('ERROR'), message);
            return result;
        }

        result.theme = theme;

        let settings = this.loadSettings();
        processGtkEvents();

        let operations = this.getOperationFlags(settings, themeName, normalizedOptions);

        processGtkEvents();

        let parameterService = this.diContainer?.get?.('hyprlandParameterService'),
            hotkeyService = this.diContainer?.get?.('hotkeyService'),
            overrideErrors = [];
        if (theme?.path) {
            let parametersWritten = parameterService && tryRun(
                'ApplyThemeExecution.writeEffectiveOverrides.parameters',
                () => parameterService.writeEffectiveOverrides(theme.path, settings)
            );
            parameterService && !parametersWritten && overrideErrors.push('parameters: write failed');

            let hotkeysWritten = hotkeyService && tryRun(
                'ApplyThemeExecution.writeEffectiveOverrides.hotkeys',
                () => hotkeyService.writeEffectiveOverrides(theme.path, settings)
            );
            hotkeyService && !hotkeysWritten && overrideErrors.push('hotkeys: write failed');

            overrideErrors.length > 0
                && this.logger?.warn?.(`[ApplyTheme] Override write warnings: ${overrideErrors.join('; ')}`);
        }

        processGtkEvents();

        let scriptPrep = this.prepareScripts(
            theme,
            settings,
            operations,
            normalizedOptions.selectedInstallScript
        );
        if (!scriptPrep.success) {
            return {success: false, error: scriptPrep.error};
        }

        let {installScript, patchedEnv, flagFiles} = scriptPrep;

        let shouldMonitorScripts = Object.keys(flagFiles).length > 0
            && !operations.isReapplying
            && !operations.skipInstall
            && installScript;
        shouldMonitorScripts && this.startScriptMonitoring(theme, flagFiles, installScript);

        let started = this.runEmbeddedSwitchTheme(theme, settings, patchedEnv, result, {
            startTime,
            variant: normalizedOptions.variant,
            isApplyOperation: operations.isApplyOperation,
            isInstallOperation: operations.isInstallOperation,
            onUIUpdate: normalizedOptions.onUIUpdate,
            onComplete: (finalResult, actualElapsedTime) =>
                this.handleApplyCompletion(theme, themeName, settings, operations, finalResult, actualElapsedTime, shouldMonitorScripts)
        });

        if (!started) {
            result.success = false;
            this.getClickStates()?.set(themeName, false);
            this.eventBus?.emit?.(Events.THEME_APPLY_ERROR, {themeName, error: 'Failed to start theme switch'});
            this.eventBus?.emit?.(Events.THEME_APPLY_COMPLETE, {theme: themeName, success: false});
            return result;
        }

        result.addMessage(this.translate('SWITCH_THEME_ASYNC_MESSAGE'));
        return result;
    }

    validateThemeSync(themeName) {
        const themeDir = `${themesDir()}/${themeName}`;
        return this.themeRepository.loadLocalTheme(themeName) ||
            (Gio.File.new_for_path(themeDir).query_exists(null) ? createLocalThemeObject(themeName, themeDir) : null);
    }

    async execAsync(command) {
        return new Promise((complete, fail) => {
            const [ok, pid] = GLib.spawn_async(null, command, null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);

            if (!ok) {
                fail(new Error('Failed to spawn command'));
                return;
            }

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
                status === 0
                    ? complete()
                    : fail(new Error(`Command failed with status ${status}`));
            });
        });
    }

    handleApplyCompletion(theme, themeName, settings, operations, finalResult, actualElapsedTime, monitoringStarted = false) {
        const {isApplyOperation, isInstallOperation} = operations;
        const elapsedSeconds = (actualElapsedTime / 1000).toFixed(1);
        const isSuccessful = finalResult?.success === true;

        this.sendPerformanceStats(theme, {applyMs: actualElapsedTime});

        isSuccessful && theme?.name && this.settingsService?.setCurrentTheme(theme.name);

        isApplyOperation && isSuccessful && this.soundService?.playThemeApplySound();
        isApplyOperation && isSuccessful && settings.showApplyTime && this.notifier && (() => {
            const title = this.translate('THEME_APPLIED_NOTIFY');
            const applyMessage = this.translate('THEME_APPLIED_WITH_TIME', {
                theme: theme.name,
                seconds: elapsedSeconds
            });
            this.notifier.success(title, applyMessage);
        })();

        isSuccessful && this.eventBus?.emit(Events.THEME_APPLY_SUCCESS, {
            theme,
            result: finalResult,
            wasFirstInstall: isInstallOperation,
            isReapply: isApplyOperation,
            elapsedTime: actualElapsedTime
        });

        this.eventBus?.emit(Events.THEME_APPLY_COMPLETE, {
            theme: themeName,
            success: isSuccessful
        });

        isSuccessful && !monitoringStarted && this.captureAutomaticRestorePoint(themeName);

        this.getClickStates()?.set(themeName, false);
    }

    createEmbeddedSwitchTheme(theme, settings, patchedEnv, variant = null) {
        return ScriptBuilder ? ScriptBuilder.buildApplyThemeSwitchScript(theme, settings, GLib.get_home_dir(), {variant}) : '';
    }

    runEmbeddedSwitchTheme(theme, settings, patchedEnv, result, options = {}) {
        processGtkEvents();
        const scriptContent = this.createEmbeddedSwitchTheme(theme, settings, patchedEnv, options.variant);
        const tempScript = `/tmp/switch_theme_embedded_${Date.now()}.sh`;

        processGtkEvents();
        const scriptFile = Gio.File.new_for_path(tempScript);
        scriptFile.replace_contents(scriptContent, null, false, Gio.FileCreateFlags.NONE, null);
        GLib.spawn_sync(null, [Commands.CHMOD, '+x', tempScript], null, GLib.SpawnFlags.SEARCH_PATH, null);
        processGtkEvents();

        const startTimestamp = options.startTime || Date.now();

        const envString = Object.keys(patchedEnv).length > 0
            ? this.buildEnvExportString(patchedEnv)
            : '';
        const cmd = envString.length
            ? [Commands.BASH, '-c', `${envString}; ${Commands.BASH} '${tempScript}'`]
            : [Commands.BASH, tempScript];

        const [spawnOk, pid] = GLib.spawn_async(GLib.get_home_dir(), cmd, null,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);

        if (!spawnOk || !pid) {
            result.addMessage(this.translate('SWITCH_THEME_LAUNCH_ERROR', {error: 'Failed to start'}));
            return false;
        }

        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (_pid, status) => {
            const tempFile = Gio.File.new_for_path(tempScript);
            tempFile.query_exists(null) && tempFile.delete(null);

            const actualElapsedTime = Date.now() - startTimestamp;
            const exitCode = status;
            const killedBySignal = exitCode === 15 || exitCode === 143 || exitCode === 9 || exitCode === 137;

            exitCode === 0 && result.addMessage(this.translate('SWITCH_THEME_SUCCESS_MESSAGE'));
            if (killedBySignal) {
                result.success = false;
                options.onComplete?.(result, actualElapsedTime);
                return;
            }
            exitCode !== 0 && (
                result.success = false,
                result.addError(this.translate('SWITCH_THEME_EXIT_CODE_ERROR', {code: exitCode}))
            );

            options.onUIUpdate?.(result, theme, actualElapsedTime);
            options.onComplete?.(result, actualElapsedTime);
        });
        result.addMessage(this.translate('SWITCH_THEME_ASYNC_MESSAGE'));
        return true;
    }
}

export function applyApplyThemeExecution(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeExecution.prototype);
}
