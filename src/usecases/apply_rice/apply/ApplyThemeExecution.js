import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ScriptBuilder} from '../../../infrastructure/scripts/ScriptBuilder.js';
import {Events} from '../../../app/eventBus.js';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import {ApplyThemeResult} from './ApplyThemeResult.js';
import {createLocalThemeObject, themesDir} from './ApplyThemeHelpers.js';
import {processGtkEvents} from '../../../infrastructure/utils/Utils.js';
import {tryOrNull, tryOrNullAsync, tryRun} from '../../../infrastructure/utils/ErrorUtils.js';

class ApplyThemeExecution {
    standardizeOptions(options = {}) {
        return {
            isReapplying: false,
            selectedInstallScript: null,
            variant: null,
            source: 'unknown',
            sanitizeConfigErrors: true,
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

        if (!normalizedOptions.isReapplying) {
            this.cancelActiveMonitoring?.();
        }

        this.eventBus?.emit?.(Events.THEME_APPLY_START, {themeName});

        return new Promise((resolve) => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.resolveThemeApplication(themeName, normalizedOptions, result, startTime)
                    .then(resolve);
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    async resolveThemeApplication(themeName, normalizedOptions, result, startTime) {
        const finalResult = await tryOrNullAsync(
            'ApplyThemeExecution.resolveThemeApplication',
            () => this.executeThemeApplication(themeName, normalizedOptions, result, startTime)
        );
        if (finalResult) {
            return finalResult;
        }

        result.success = false;
        result.addError('Unknown error');
        return result;
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

        const runOptions = {
            startTime,
            variant: normalizedOptions.variant,
            isApplyOperation: operations.isApplyOperation,
            isInstallOperation: operations.isInstallOperation,
            isReapplying: operations.isReapplying,
            sanitizeConfigErrors: normalizedOptions.sanitizeConfigErrors !== false,
            onUIUpdate: normalizedOptions.onUIUpdate,
            onComplete: (finalResult, actualElapsedTime) =>
                this.handleApplyCompletion(theme, themeName, settings, operations, finalResult, actualElapsedTime, runOptions),
            sync: normalizedOptions.sync || false
        };

        let started = runOptions.sync
            ? this.runEmbeddedSwitchThemeSync(theme, settings, patchedEnv, result, runOptions)
            : this.runEmbeddedSwitchTheme(theme, settings, patchedEnv, result, runOptions);

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

    handleApplyCompletion(theme, themeName, settings, operations, finalResult, actualElapsedTime, runOptions = {}) {
        const {isApplyOperation, isInstallOperation} = operations;
        const elapsedSeconds = (actualElapsedTime / 1000).toFixed(1);
        const isSuccessful = finalResult?.success === true;

        this.sendPerformanceStats(theme, {applyMs: actualElapsedTime});

        isSuccessful && theme?.name && this.settingsService?.setCurrentTheme(theme.name);
        isSuccessful && this.clearApplyPendingFlag(theme);
        if (isSuccessful && theme?.path && runOptions?.sanitizeConfigErrors !== false) {
            this.sanitizeThemeConfigErrors(theme.path);
        }

        isApplyOperation && isSuccessful && this.soundService?.playThemeApplySound();
        if (isApplyOperation && isSuccessful && settings.showApplyTime && this.notifier) {
            const title = this.translate('THEME_APPLIED_NOTIFY');
            const applyMessage = this.translate('THEME_APPLIED_WITH_TIME', {
                theme: theme.name,
                seconds: elapsedSeconds
            });
            this.notifier.success(title, applyMessage);
        }

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

        this.getClickStates()?.set(themeName, false);
    }

    clearApplyPendingFlag(theme) {
        const themeName = theme?.name;
        if (!themeName) return;

        const themePath = theme?.path || `${themesDir()}/${themeName}`;
        const pendingPath = `${themePath}/.lastlayer-apply-pending.json`;
        if (!GLib.file_test(pendingPath, GLib.FileTest.EXISTS)) return;

        const payload = {
            needsReapply: false,
            updatedAt: new Date().toISOString()
        };

        const cleared = tryRun(
            'ApplyThemeExecution.clearApplyPendingFlag',
            () => GLib.file_set_contents(pendingPath, JSON.stringify(payload, null, 2))
        );
        if (!cleared) {
            this.logger?.warn?.('[ApplyTheme] Failed to clear apply pending flag');
        }
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
            const success = exitCode === 0;
            const reapplyPending = this.isReapplyPending?.(theme.name);
            const killedByReapply = !success && reapplyPending;

            if (success) {
                result.addMessage(this.translate('SWITCH_THEME_SUCCESS_MESSAGE'));
            }

            if (killedByReapply) {
                return;
            }

            if (!success && !killedByReapply) {
                result.success = false;
                result.addError(this.translate('SWITCH_THEME_EXIT_CODE_ERROR', {code: exitCode}));
            }

            options.onUIUpdate?.(result, theme, actualElapsedTime);
            options.onComplete?.(result, actualElapsedTime);
        });
        result.addMessage(this.translate('SWITCH_THEME_ASYNC_MESSAGE'));
        return true;
    }

    runEmbeddedSwitchThemeSync(theme, settings, patchedEnv, result, options = {}) {
        const scriptContent = this.createEmbeddedSwitchTheme(theme, settings, patchedEnv, options.variant);
        const tempScript = `/tmp/switch_theme_embedded_${Date.now()}.sh`;

        GLib.file_set_contents(tempScript, scriptContent);
        GLib.spawn_command_line_sync(`${Commands.CHMOD} +x '${tempScript}'`);

        const startTimestamp = options.startTime || Date.now();

        let cmdLine = `${Commands.BASH} '${tempScript}'`;
        if (Object.keys(patchedEnv).length > 0) {
            const envString = Object.entries(patchedEnv)
                .filter(([, v]) => typeof v === 'string' && v.length > 0)
                .map(([k, v]) => `${k}='${v}'`).join(' ');
            if (envString.length) {
                cmdLine = `${Commands.BASH} -c "${envString} ${Commands.BASH} '${tempScript}'"`;
            }
        }

        const spawnResult = tryOrNull(
            'ApplyThemeExecution.runEmbeddedSwitchThemeSync.spawn',
            () => GLib.spawn_command_line_sync(cmdLine)
        );
        if (!spawnResult) {
            this.cleanupTempScript(tempScript);
            result.success = false;
            result.addError(this.translate('SWITCH_THEME_LAUNCH_ERROR', {error: 'Failed to start'}));
            return false;
        }

        const [success, , , exitStatus] = spawnResult;
        const actualElapsedTime = Date.now() - startTimestamp;

        this.cleanupTempScript(tempScript);

        if (success && exitStatus === 0) {
            result.addMessage(this.translate('SWITCH_THEME_SUCCESS_MESSAGE'));
        } else {
            result.success = false;
            result.addError(this.translate('SWITCH_THEME_EXIT_CODE_ERROR', {code: exitStatus}));
        }

        result.elapsedTime = actualElapsedTime;
        options.onComplete?.(result, actualElapsedTime);
        return true;
    }

    sanitizeThemeConfigErrors(themePath) {
        const sanitizeResult = tryOrNull(
            'ApplyThemeExecution.sanitizeThemeConfigErrors',
            () => this.diContainer?.get?.('hyprlandParameterService')
                ?.sanitizeActiveThemeConfigErrors?.(themePath, {maxPasses: 3})
        );
        if (!sanitizeResult) {
            this.logger?.warn?.('[ApplyTheme] Failed to sanitize Hyprland config errors');
            return;
        }

        if (sanitizeResult.fixedLines > 0) {
            this.logger?.info?.(
                `[ApplyTheme] Auto-disabled ${sanitizeResult.fixedLines} invalid Hyprland line(s) in ${sanitizeResult.touchedFiles?.length || 0} file(s)`
            );
        }
    }

    cleanupTempScript(tempScript) {
        const tempFile = Gio.File.new_for_path(tempScript);
        if (!tempFile.query_exists(null)) {
            return;
        }

        tryRun(
            'ApplyThemeExecution.cleanupTempScript',
            () => tempFile.delete(null)
        );
    }
}

export function applyApplyThemeExecution(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeExecution.prototype);
}
