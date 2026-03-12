import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import {AIProviderService} from '../../../infrastructure/ai/AIProviderService.js';
import {FocusTracker, FocusMode} from '../../../infrastructure/ai/FocusTracker.js';
import {ScreenshotService, CaptureMode} from '../../../infrastructure/ai/ScreenshotService.js';
import {ChangeDetectionService, ChangeAlgorithm} from '../../../infrastructure/ai/ChangeDetectionService.js';
import {ThemeTagService} from '../../../infrastructure/ai/ThemeTagService.js';
import {AIDecisionService, AIDecisionError} from '../../../infrastructure/ai/AIDecisionService.js';
import {ReverseImmersivityService, PipelineState} from '../../../infrastructure/ai/ReverseImmersivityService.js';
import {PipelineFilterService} from '../../../infrastructure/ai/PipelineFilterService.js';
import { tryOrDefault, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';

const AI_SETTINGS_KEY = 'aiDynamicEnvironment';

export class AIDynamicEnvironmentController {
    constructor(container, store, logger = null) {
        this.container = container;
        this.store = store;
        this.logger = logger;
        this.view = null;
        this.mainController = null;
        this.moreSectionsController = null;

        this.soundService = container?.get?.('soundService');
        this.translator = container?.has?.('translator') ? container.get('translator') : null;

        this.settingsService = container?.has?.('settingsService') ? container.get('settingsService') : null;

        this.aiProviderService = new AIProviderService(this.settingsService, logger);

        this.focusTracker = new FocusTracker(logger, this.settingsService);
        this.focusUnsubscribe = null;

        this.screenshotService = new ScreenshotService(logger);

        this.changeDetectionService = new ChangeDetectionService(this.screenshotService, logger);
        this.changeDetectionUnsubscribe = null;

        const themeRepository = container?.has?.('themeRepository') ? container.get('themeRepository') : null;
        this.themeTagService = new ThemeTagService(themeRepository, logger);

        this.aiDecisionService = new AIDecisionService(this.aiProviderService, logger);

        this.pipelineFilterService = new PipelineFilterService({
            aiProviderService: this.aiProviderService,
            settingsService: this.settingsService,
            logger: logger
        });

        const applyThemeUseCase = container?.has?.('applyThemeUseCase') ? container.get('applyThemeUseCase') : null;
        this.logMessage(`[AI_CONTROLLER] Container has applyThemeUseCase: ${!!applyThemeUseCase}`);
        this.reverseImmersivityService = new ReverseImmersivityService({
            screenshotService: this.screenshotService,
            themeTagService: this.themeTagService,
            aiDecisionService: this.aiDecisionService,
            pipelineFilterService: this.pipelineFilterService,
            applyThemeUseCase: applyThemeUseCase,
            settingsService: this.settingsService,
            logger: logger
        });
        this.reverseImmersivityUnsubscribe = null;
        this.pipelineLogs = [];

        this.isBackgroundMonitoringActive = false;
        this.backgroundChangeUnsubscribe = null;
        this.backgroundFocusUnsubscribe = null;
        this.backgroundDelayTimerId = null;
        this.backgroundCriticalCounter = 0;
        this._backgroundNoProviderAlertShown = false;

        this._consecutiveStableFrames = 0;

        this._snapshotCooldownUntil = 0;

        this._isSyncingWidgets = false;

        this.settings = {
            reverseImmersivity: false,
            changePattern: 'more1',
            changeThreshold: 60,
            allowedWindows: 'any_focus',
            selectedWindowClass: null,
            aiProvider: null,
            changeDetectionMode: 'none',
            captureDelay: 500,
            ignoreFocusChange: false,
            requiredConsecutiveFrames: 1,
            focusCheckDelayMs: 2000,
            focusCooldownMs: 10000,
            areaSizeRatio: 50,
            focusStabilityWindowMs: 1000,
            ignorePatterns: '',
            focusPatterns: '',
            ignoreIncomingTags: ''
        };

        this._consecutiveFramesAboveThreshold = 0;

        this.loadSettings();

        if (this.settings.reverseImmersivity) {
            this.log('info', 'Auto-starting reverse immersivity from saved settings');
            this.startBackgroundMonitoring();
        }
    }

    setView(view) {
        this.view = view;
        view?.setController?.(this);
    }

    setMainController(mainController) {
        this.mainController = mainController;
    }

    setMoreSectionsController(moreSectionsController) {
        this.moreSectionsController = moreSectionsController;
    }

    translate(key, fallback = null) {
        const raw = this.translator?.(key);
        if (typeof raw === 'string' && raw !== key) return raw;
        return fallback || key;
    }

    logMessage(message) {
        const filterLogsOnly = this.settingsService?.settingsManager?.get?.('ai_filter_logs_only') === true;

        if (filterLogsOnly) {
            return;
        }

        print(message);
    }

    navigateBack() {
        this.log('info', 'Navigating back to more sections');
        this.mainController?.view?.handleTabSwitch?.('more-sections');
    }

    onSettingChanged(key, value) {
        if (this._isSyncingWidgets) {
            return;
        }

        this.log('debug', `Setting changed: ${key} = ${value}`);
        this.settings[key] = value;

        if (key === 'reverseImmersivity') {
            if (value) {
                this.enableReverseImmersivity();
            } else {
                this.disableReverseImmersivity();
            }
        }

        if (key === 'aiProvider') {
            const providerId = value === 'none' ? null : value;
            this.setActiveProvider(providerId);
        }

        if (key === 'changePattern' || key === 'allowedWindows') {
            this.handleDetectionSettingChange(key, value);
        }

        if (key === 'changeDetectionMode' || key === 'skipTransitions' || key === 'captureDelay' || key === 'requiredConsecutiveFrames') {
            this.handleChangeDetectionModeChange(key, value);
            if (key === 'requiredConsecutiveFrames') {
                this._consecutiveFramesAboveThreshold = 0;
            }
        }

        this.saveSettings();
    }

    beginWidgetSync() {
        this._isSyncingWidgets = true;
    }

    endWidgetSync() {
        this._isSyncingWidgets = false;
    }

    handleDetectionSettingChange(key, value) {
        const isActive = this.isBackgroundMonitoringActive || this.view?.isTrackingFocus;
        if (!isActive) {
            this.log('debug', `${key} changed but monitoring not active, will apply on next start`);
            return;
        }

        this.log('info', `${key} changed during monitoring, updating detection services`);

        if (key === 'changePattern') {
            const algorithm = value === 'more2' ? ChangeAlgorithm.MORE_2 : ChangeAlgorithm.MORE_1;
            this.changeDetectionService?.setAlgorithm?.(algorithm);
        }

        if (key === 'allowedWindows') {
            const captureMode = value === 'full_screen' ? 'full_screen' : 'active_window';
            this.changeDetectionService?.setCaptureMode?.(captureMode);

            const focusSettings = this.getFocusModeFromSettings();
            this.focusTracker?.setMode?.(focusSettings.mode, focusSettings.options);
        }
    }

    handleChangeDetectionModeChange(key, value) {
        this.log('info', `Change detection setting ${key} updated to ${value}`);
    }

    getSettings() {
        return {...this.settings};
    }

    checkFocusChangedFromSnapshot() {
        return this.focusTracker?.hasFocusChangedFromSnapshot?.() ?? false;
    }

    updateFocusSnapshot() {
        this.focusTracker?.takeSnapshot?.();
    }

    getCurrentFocusInfo() {
        this.focusTracker?._pollFocus?.();
        const focus = this.focusTracker?.currentFocus;
        if (!focus) return null;
        return {
            pid: focus.pid,
            address: focus.address,
            class: focus.class,
            title: focus.title,
            size: focus.size
        };
    }

    getAllWindows() {
        const [success, stdout, stderr, exitStatus] = tryOrDefault(
            'AIDynamicEnvironmentController.getAllWindows.spawn',
            () => GLib.spawn_command_line_sync('hyprctl clients -j'),
            [false, null, null, -1]
        );

        this.logMessage(`[AI_CONTROLLER] getAllWindows: success=${success}, exitStatus=${exitStatus}`);

        if (!(success && exitStatus === 0)) {
            const errOutput = stderr ? new TextDecoder('utf-8').decode(stderr) : 'no stderr';
            this.logMessage(`[AI_CONTROLLER] getAllWindows: command failed - ${errOutput}`);
            return [];
        }

        const output = stdout ? new TextDecoder('utf-8').decode(stdout).trim() : '';
        this.logMessage(`[AI_CONTROLLER] getAllWindows: output length=${output?.length || 0}`);
        if (!output) {
            return [];
        }

        const clients = tryOrDefault('AIDynamicEnvironmentController.getAllWindows.parse', () => JSON.parse(output), []);
        const result = clients
            .filter(w => w.class && w.class.trim() !== '')
            .map(w => ({
                class: w.class,
                title: w.title || '',
                pid: w.pid,
                address: w.address,
                workspace: w.workspace?.name || w.workspace?.id,
                size: w.size
            }))
            .filter((w, i, arr) => arr.findIndex(x => x.class === w.class) === i);

        this.logMessage(`[AI_CONTROLLER] getAllWindows: parsed ${clients.length} clients`);
        this.logMessage(`[AI_CONTROLLER] getAllWindows: returning ${result.length} unique windows`);
        return result;
    }


    loadSettings() {
        if (!this.settingsService?.settingsManager) {
            this.log('debug', 'No settingsManager available, using defaults');
            return;
        }

        const saved = tryOrDefault(
            'AIDynamicEnvironmentController.loadSettings',
            () => this.settingsService.settingsManager.get(AI_SETTINGS_KEY),
            null
        );
        if (!saved || typeof saved !== 'object') {
            return;
        }

        this.settings = {
            ...this.settings,
            ...saved
        };
        this.log('info', 'Loaded AI settings from storage', this.settings);

        if (this.settings.aiProvider) {
            tryRun('AIDynamicEnvironmentController.loadSettings.setActiveProvider', () => {
                this.aiProviderService?.setActiveProvider?.(this.settings.aiProvider);
            });
        }
    }

    saveSettings() {
        if (!this.settingsService?.settingsManager) {
            this.log('debug', 'No settingsManager available, cannot save');
            return;
        }

        tryRun('AIDynamicEnvironmentController.saveSettings', () => {
            this.settingsService.settingsManager.set(AI_SETTINGS_KEY, this.settings);
            this.settingsService.settingsManager.write(null, {silent: true});
            this.log('debug', 'Saved AI settings', this.settings);
        });
    }


    startBackgroundMonitoring() {
        if (this.isBackgroundMonitoringActive) {
            this.log('debug', 'Background monitoring already active');
            return;
        }

        this.log('info', 'Starting background monitoring for reverse-immersivity');
        this.isBackgroundMonitoringActive = true;
        this.backgroundCriticalCounter = 0;
        this._backgroundNoProviderAlertShown = false;

        const algorithm = this.settings.changePattern === 'more2'
            ? ChangeAlgorithm.MORE_2
            : ChangeAlgorithm.MORE_1;
        this.changeDetectionService.setAlgorithm(algorithm);

        this.backgroundChangeUnsubscribe = this.changeDetectionService.onChangeDetected((changePercent) => {
            this.handleBackgroundChangeDetected(changePercent);
        });

        const isServiceRunning = this.view?.isTrackingFocus;
        if (!isServiceRunning) {
            const captureMode = this.getCaptureMode();
            this.changeDetectionService.start(captureMode);
            this.log('info', 'Change detection service started');
        } else {
            this.log('debug', 'Change detection already running from debug tracking');
        }

        if (!this.reverseImmersivityUnsubscribe) {
            this.reverseImmersivityUnsubscribe = this.reverseImmersivityService.onEvent((event, data) => {
                this.handlePipelineEvent(event, data);
            });
        }

        this.updateFocusSnapshot();

        this.log('info', 'Background monitoring started', { algorithm });
    }

    stopBackgroundMonitoring() {
        if (!this.isBackgroundMonitoringActive) {
            return;
        }

        this.log('info', 'Stopping background monitoring');
        this.isBackgroundMonitoringActive = false;

        this.reverseImmersivityService?.reset?.();

        if (this.backgroundChangeUnsubscribe) {
            this.backgroundChangeUnsubscribe();
            this.backgroundChangeUnsubscribe = null;
        }

        if (!this.view?.isTrackingFocus) {
            this.changeDetectionService.stop();
            this.log('info', 'Change detection service stopped');
        } else {
            this.log('debug', 'Change detection stop skipped - debug tracking active');
        }

        if (this.backgroundDelayTimerId) {
            GLib.source_remove(this.backgroundDelayTimerId);
            this.backgroundDelayTimerId = null;
        }

        this.backgroundCriticalCounter = 0;
        this._backgroundNoProviderAlertShown = false;

        this.log('info', 'Background monitoring stopped');
    }

    handleBackgroundChangeDetected(changePercent) {
        const threshold = this.settings.changeThreshold ?? 60;
        const ignoreFocusChange = this.settings.ignoreFocusChange === true;
        const requiredFrames = this.settings.requiredConsecutiveFrames ?? 1;
        const focusStabilityWindowMs = this.settings.focusStabilityWindowMs ?? 1000;
        const focusCooldownMs = this.settings.focusCooldownMs ?? 10000;
        const areaSizeRatioThreshold = (this.settings.areaSizeRatio ?? 50) / 100;

        if (this.settings.allowedWindows === 'specific_window' && this.settings.selectedWindowClass) {
            const currentFocus = this.getCurrentFocusInfo();
            const selectedClass = this.settings.selectedWindowClass.toLowerCase();
            const focusedClass = (currentFocus?.class || '').toLowerCase();

            this.logMessage(`[AI_CONTROLLER] Specific window mode: selected="${selectedClass}", focused="${focusedClass}", match=${focusedClass === selectedClass}`);

            if (focusedClass !== selectedClass) {
                this.logMessage(`[AI_CONTROLLER] Ignoring change - wrong window focused`);
                return;
            }
            this.logMessage(`[AI_CONTROLLER] Specific window matched! Processing change ${changePercent}%`);
        }

        if (this.settings.allowedWindows === 'specific_window') {
            this.logMessage(`[AI_CONTROLLER] Change detected: ${changePercent.toFixed(1)}% (threshold: ${threshold}%)`);
        }

        if (changePercent < threshold || changePercent <= 0) {
            this._consecutiveFramesAboveThreshold = 0;

            if (ignoreFocusChange) {
                const isInCooldown = Date.now() < (this._stableFocusCooldownUntil || 0);
                const focusChangedRecently = this.focusTracker?.hasFocusChangedRecently?.(focusStabilityWindowMs) ?? false;
                if (!focusChangedRecently && !isInCooldown) {
                    this._lastStableFocus = this.getCurrentFocusInfo();
                }
            }
            return;
        }

        this._consecutiveFramesAboveThreshold++;

        if (this._consecutiveFramesAboveThreshold < requiredFrames) {
            this.logMessage(`[AI_CONTROLLER] Above threshold but waiting for more frames: ${this._consecutiveFramesAboveThreshold}/${requiredFrames}`);
            return;
        }

        if (ignoreFocusChange) {
            const stableFocus = this._lastStableFocus;
            const currentFocus = this.getCurrentFocusInfo();

            const stableArea = (stableFocus?.size?.[0] || 0) * (stableFocus?.size?.[1] || 0);
            const currentArea = (currentFocus?.size?.[0] || 0) * (currentFocus?.size?.[1] || 0);
            const areaRatio = stableArea > 0 && currentArea > 0
                ? Math.min(stableArea, currentArea) / Math.max(stableArea, currentArea)
                : 1;
            const significantSizeChange = areaRatio < areaSizeRatioThreshold;

            this.logMessage(`[AI_CONTROLLER] Critical change ${changePercent}%`);
            this.logMessage(`[AI_CONTROLLER] Stable focus (before): ${stableFocus?.class || 'none'} (pid: ${stableFocus?.pid || 'none'}) size: ${stableFocus?.size?.join('x') || 'unknown'}`);
            this.logMessage(`[AI_CONTROLLER] Current focus (now):   ${currentFocus?.class || 'none'} (pid: ${currentFocus?.pid || 'none'}) size: ${currentFocus?.size?.join('x') || 'unknown'}`);
            this.logMessage(`[AI_CONTROLLER] Area ratio: ${(areaRatio * 100).toFixed(1)}% (threshold: ${(areaSizeRatioThreshold * 100)}%, significant: ${significantSizeChange})`);

            const focusChangedFromStable = !stableFocus || !currentFocus ||
                                           stableFocus.pid !== currentFocus.pid ||
                                           stableFocus.address !== currentFocus.address ||
                                           significantSizeChange;

            if (focusChangedFromStable) {
                this.logMessage(`[AI_CONTROLLER] ========================================`);
                this.logMessage(`[AI_CONTROLLER] *** IGNORE CHANGES - FOCUS WINDOW CHANGED ***`);
                this.logMessage(`[AI_CONTROLLER] Was: ${stableFocus?.class || 'none'}`);
                this.logMessage(`[AI_CONTROLLER] Now: ${currentFocus?.class || 'none'}`);
                this.logMessage(`[AI_CONTROLLER] ========================================`);
                this._lastStableFocus = currentFocus;
                this._stableFocusCooldownUntil = Date.now() + focusCooldownMs;
                return;
            }

            const focusCheckDelayMs = this.settings.focusCheckDelayMs ?? 2000;
            this.logMessage(`[AI_CONTROLLER] Focus same as stable - waiting ${focusCheckDelayMs}ms to check for delayed focus change...`);

            if (this._focusCheckTimerId) {
                GLib.source_remove(this._focusCheckTimerId);
            }

            const focusAtCritical = currentFocus;
            this._focusCheckTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, focusCheckDelayMs, () => {
                this._focusCheckTimerId = null;
                const focusAfterWait = this.getCurrentFocusInfo();

                this.logMessage(`[AI_CONTROLLER] After ${focusCheckDelayMs}ms wait:`);
                this.logMessage(`[AI_CONTROLLER] Focus at critical: ${focusAtCritical?.class || 'none'} (pid: ${focusAtCritical?.pid || 'none'})`);
                this.logMessage(`[AI_CONTROLLER] Focus now:         ${focusAfterWait?.class || 'none'} (pid: ${focusAfterWait?.pid || 'none'})`);

                const focusChangedDuringWait = !focusAtCritical || !focusAfterWait ||
                                               focusAtCritical.pid !== focusAfterWait.pid ||
                                               focusAtCritical.address !== focusAfterWait.address;

                if (focusChangedDuringWait) {
                    this.logMessage(`[AI_CONTROLLER] ========================================`);
                    this.logMessage(`[AI_CONTROLLER] *** IGNORE CHANGES - DELAYED FOCUS CHANGE ***`);
                    this.logMessage(`[AI_CONTROLLER] Was: ${focusAtCritical?.class || 'none'}`);
                    this.logMessage(`[AI_CONTROLLER] Now: ${focusAfterWait?.class || 'none'}`);
                    this.logMessage(`[AI_CONTROLLER] ========================================`);
                    this._lastStableFocus = focusAfterWait;
                    this._stableFocusCooldownUntil = Date.now() + focusCooldownMs;
                    return GLib.SOURCE_REMOVE;
                }

                this.logMessage(`[AI_CONTROLLER] Focus confirmed unchanged - proceeding with pipeline`);
                this.processBackgroundCriticalChange(changePercent);
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this.processBackgroundCriticalChange(changePercent);
    }

    processBackgroundCriticalChange(changePercent) {
        this._consecutiveFramesAboveThreshold = 0;

        this.backgroundCriticalCounter++;
        this.log('debug', 'Background critical change detected', {
            changePercent,
            count: this.backgroundCriticalCounter,
            mode: this.settings.changeDetectionMode
        });

        const mode = this.settings.changeDetectionMode || 'none';
        const skipCount = this.settings.skipTransitions ?? 1;
        const delayMs = this.settings.captureDelay ?? 500;

        switch (mode) {
            case 'skip':
                if (this.backgroundCriticalCounter <= skipCount) {
                    this.log('debug', `Background: Skipping transition ${this.backgroundCriticalCounter}/${skipCount}`);
                    return;
                }
                break;
            case 'delay':
                this.scheduleBackgroundPipeline(changePercent, delayMs);
                return;
            default:
                break;
        }

        this.executeBackgroundPipeline(changePercent);
    }

    scheduleBackgroundPipeline(changePercent, delayMs) {
        if (this.backgroundDelayTimerId) {
            GLib.source_remove(this.backgroundDelayTimerId);
        }

        this.log('debug', `Background: Starting capture delay of ${delayMs}ms`);
        this.backgroundDelayTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this.backgroundDelayTimerId = null;
            this.executeBackgroundPipeline(changePercent);
            return GLib.SOURCE_REMOVE;
        });
    }

    async executeBackgroundPipeline(changePercent) {
        if (!this.aiProviderService?.hasActiveProvider?.()) {
            this.log('warn', 'Background: No active AI provider configured');
            if (!this._backgroundNoProviderAlertShown) {
                this._backgroundNoProviderAlertShown = true;
                this.showNoProviderAlert();
            }
            return;
        }

        this.log('info', 'Background: Triggering reverse immersivity pipeline', { changePercent });

        const focusInfo = this.getCurrentFocusInfo?.() || null;
        const result = await this.reverseImmersivityService.execute({
            changePercent,
            focusInfo,
            captureMode: this.getCaptureMode(),
            ignorePatterns: this.settings.ignorePatterns || '',
            focusPatterns: this.settings.focusPatterns || '',
            ignoreIncomingTags: this.settings.ignoreIncomingTags || ''
        });

        switch (true) {
            case Boolean(result?.ignored):
                this.log('info', 'Background: Pipeline returned IGNORED - no theme change', result);
                return;
            case Boolean(result?.skipped):
                this.log('info', 'Background: Pipeline returned SKIPPED - content doesn\'t match focus patterns', result);
                return;
            case Boolean(result?.ignoredTag):
                this.log('info', 'Background: Pipeline returned IGNORED TAG - tag in ignore list', result);
                return;
            case Boolean(result?.success):
                this.log('info', 'Background: Pipeline completed successfully', result);
                return;
            default:
                this.log('warn', 'Background: Pipeline failed', result);
        }
    }


    getProviders() {
        return this.aiProviderService?.getProviders() || [];
    }

    addProvider(config) {
        const provider = this.aiProviderService?.addProvider(config);
        if (provider) {
            this.log('info', 'Provider added', {id: provider.id, name: provider.name});
        }
        return provider;
    }

    updateProvider(id, updates) {
        const provider = this.aiProviderService?.updateProvider(id, updates);
        if (provider) {
            this.log('info', 'Provider updated', {id, name: provider.name});
        }
        return provider;
    }

    deleteProvider(id) {
        const success = this.aiProviderService?.deleteProvider(id);
        if (success) {
            this.log('info', 'Provider deleted', {id});
        }
        return success;
    }

    testProviderSync(id) {
        this.log('debug', 'Testing provider connection (sync)', {id});
        return this.aiProviderService?.testConnectionSync(id);
    }

    async testProvider(id) {
        this.log('debug', 'Testing provider connection', {id});
        return await this.aiProviderService?.testConnection(id);
    }

    getProviderLogs(id) {
        return this.aiProviderService?.getProviderLogs(id) || [];
    }

    clearProviderLogs(id) {
        this.aiProviderService?.clearProviderLogs(id);
    }

    getChatLogs(id) {
        return this.aiProviderService?.getChatLogs(id) || [];
    }

    clearChatLogs(id) {
        this.aiProviderService?.clearChatLogs(id);
    }

    async sendAIRequest(prompt, options = {}) {
        return await this.aiProviderService?.sendRequest(prompt, options);
    }

    setActiveProvider(id) {
        return this.aiProviderService?.setActiveProvider(id);
    }

    getActiveProvider() {
        return this.aiProviderService?.getActiveProvider();
    }


    startFocusTracking(onFocusChange) {
        const mode = this.getFocusModeFromSettings();
        this.focusTracker.setMode(mode.mode, mode.options);

        if (this.focusUnsubscribe) {
            this.focusUnsubscribe();
        }

        this.focusUnsubscribe = this.focusTracker.onFocusChange((event, data) => {
            if (onFocusChange) {
                onFocusChange(event, data);
            }
        });

        this.focusTracker.startTracking();

        this.updateFocusSnapshot();

        this.log('info', 'Focus tracking started');
    }

    stopFocusTracking() {
        if (this.focusUnsubscribe) {
            this.focusUnsubscribe();
            this.focusUnsubscribe = null;
        }
        this.focusTracker.stopTracking();
        this.log('info', 'Focus tracking stopped');
    }

    getCurrentFocus() {
        return this.focusTracker.getCurrentFocus();
    }

    getFocusDisplayString() {
        return this.focusTracker.getFocusDisplayString();
    }

    getFocusModeFromSettings() {
        const setting = this.settings.allowedWindows;

        switch (setting) {
            case 'any_focus':
            default:
                return { mode: FocusMode.ANY_CURRENT_FOCUS, options: {} };

            case 'full_screen':
                return { mode: FocusMode.ANY_CURRENT_FOCUS, options: { fullScreen: true } };

            case 'specific_window':
                return {
                    mode: FocusMode.SPECIFIC_CLASS,
                    options: { windowClass: this.settings.selectedWindowClass }
                };

            case 'specific_class':
                return {
                    mode: FocusMode.SPECIFIC_CLASS,
                    options: { windowClass: this.settings.targetWindowClass }
                };
        }
    }

    getCaptureMode() {
        return this.settings.allowedWindows === 'full_screen' ? 'full_screen' : 'active_window';
    }


    captureActiveWindow() {
        this.log('debug', 'Capturing active window screenshot');
        const result = this.screenshotService.capture(CaptureMode.ACTIVE_WINDOW);

        if (result.success) {
            this.log('info', 'Screenshot captured', {
                width: result.width,
                height: result.height
            });
        } else {
            this.log('error', 'Screenshot capture failed', { error: result.error });
        }

        return result;
    }

    captureFullScreen() {
        return this.screenshotService.capture(CaptureMode.FULL_SCREEN);
    }

    getLastScreenshot() {
        return this.screenshotService.getLastScreenshot();
    }

    scaleScreenshotForPreview(pixbuf, maxWidth, maxHeight) {
        return this.screenshotService.scalePixbuf(pixbuf, maxWidth, maxHeight);
    }


    startChangeDetection(onChangeDetected) {
        const algorithm = this.settings.changePattern === 'more2'
            ? ChangeAlgorithm.MORE_2
            : ChangeAlgorithm.MORE_1;

        this.changeDetectionService.setAlgorithm(algorithm);

        if (this.changeDetectionUnsubscribe) {
            this.changeDetectionUnsubscribe();
        }

        this.changeDetectionUnsubscribe = this.changeDetectionService.onChangeDetected((changePercent) => {
            if (onChangeDetected) {
                onChangeDetected(changePercent);
            }
        });

        if (!this.isBackgroundMonitoringActive) {
            const captureMode = this.getCaptureMode();
            this.changeDetectionService.start(captureMode);
            this.log('info', 'Change detection service started', { algorithm, captureMode });
        } else {
            this.log('debug', 'Change detection already running from background monitoring', { algorithm });
        }
    }

    stopChangeDetection() {
        if (this.changeDetectionUnsubscribe) {
            this.changeDetectionUnsubscribe();
            this.changeDetectionUnsubscribe = null;
        }

        if (!this.isBackgroundMonitoringActive) {
            this.changeDetectionService.stop();
            this.log('info', 'Change detection stopped');
        } else {
            this.log('debug', 'Change detection stop skipped - background monitoring active');
        }
    }

    getLastChangePercent() {
        return this.changeDetectionService.getLastChangePercent();
    }

    updateChangeDetectionAlgorithm() {
        const algorithm = this.settings.changePattern === 'more2'
            ? ChangeAlgorithm.MORE_2
            : ChangeAlgorithm.MORE_1;

        this.changeDetectionService.setAlgorithm(algorithm);
    }


    enableReverseImmersivity() {
        if (this.isBackgroundMonitoringActive) {
            this.log('debug', 'Background monitoring already active');
            return;
        }

        this.settings.reverseImmersivity = true;
        this.log('info', 'Reverse immersivity enabled');

        this.startBackgroundMonitoring();
    }

    disableReverseImmersivity() {
        this.stopBackgroundMonitoring();

        if (this.reverseImmersivityUnsubscribe) {
            this.reverseImmersivityUnsubscribe();
            this.reverseImmersivityUnsubscribe = null;
        }

        this.settings.reverseImmersivity = false;
        this.log('info', 'Reverse immersivity disabled');
    }

    isReverseImmersivityEnabled() {
        return this.settings.reverseImmersivity;
    }

    async triggerReverseImmersivity(changePercent, screenshot = null) {
        if (!this.settings.reverseImmersivity) {
            this.log('debug', 'Reverse immersivity not enabled, ignoring trigger');
            return null;
        }

        if (!this.aiProviderService?.hasActiveProvider?.()) {
            this.log('warn', 'No active AI provider configured');
            this.showNoProviderAlert();
            return { success: false, error: AIDecisionError.NO_PROVIDER };
        }

        this.log('info', 'Triggering reverse immersivity pipeline', { changePercent });

        const focusInfo = this.getCurrentFocusInfo?.() || null;
        const result = await this.reverseImmersivityService.execute({
            changePercent,
            focusInfo,
            screenshot: screenshot,
            captureMode: this.getCaptureMode(),
            ignorePatterns: this.settings.ignorePatterns || '',
            focusPatterns: this.settings.focusPatterns || '',
            ignoreIncomingTags: this.settings.ignoreIncomingTags || ''
        });

        return result;
    }

    showNoProviderAlert() {
        const title = this.translate('AI_PROVIDER_REQUIRED_TITLE');
        const message = this.translate('AI_PROVIDER_REQUIRED_MESSAGE');

        const notifier = this.container?.has?.('notifier') ? this.container.get('notifier') : null;
        if (notifier?.warning) {
            notifier.warning(title, message);
            return;
        }

        const dialog = new Gtk.MessageDialog({
            modal: true,
            message_type: Gtk.MessageType.WARNING,
            buttons: Gtk.ButtonsType.OK,
            text: title,
            secondary_text: message
        });

        dialog.connect('response', () => dialog.destroy());
        dialog.show();
    }

    validateReverseImmersivity() {
        this.logMessage('[PREFLIGHT] Running pre-flight checks...');

        const hasProvider = this.aiProviderService?.hasActiveProvider?.();
        this.logMessage(`[PREFLIGHT] Has active provider: ${hasProvider}`);
        if (!hasProvider) {
            return {
                success: false,
                error: 'NO_PROVIDER',
                details: this.translate('AI_PREFLIGHT_NO_PROVIDER', 'No AI provider selected. Please add and select an AI provider first.')
            };
        }

        const installedThemes = this.settingsService?.getSkipList?.() || [];
        this.logMessage(`[PREFLIGHT] Installed themes count: ${installedThemes.length}`);
        if (installedThemes.length === 0) {
            return {
                success: false,
                error: 'NO_THEMES',
                details: this.translate('AI_PREFLIGHT_NO_THEMES', 'No installed themes found. Install at least one theme (uncheck it in Settings → Theme Apps).')
            };
        }

        const availableTags = this.themeTagService?.getTagsFromThemes?.(installedThemes) || [];
        this.logMessage(`[PREFLIGHT] Available tags count: ${availableTags.length}`);
        if (availableTags.length === 0) {
            return {
                success: false,
                error: 'NO_TAGS',
                details: this.translate('AI_PREFLIGHT_NO_TAGS', 'Installed themes have no tags. Add tags to theme metadata files.')
            };
        }

        this.logMessage('[PREFLIGHT] All checks passed!');
        return { success: true };
    }

    handlePipelineEvent(event, data) {
        this.log('debug', 'Pipeline event', { event, data });

        switch (event) {
            case 'stateChange':
                this.view?.onPipelineStateChange?.(data.from, data.to);
                return;
            case 'completed':
                this.handlePipelineCompleted(data);
                return;
            case 'error':
                this.view?.onPipelineError?.(data);
                this.showPipelineErrorNotification(data);
                return;
            case 'filter_result':
                this.handlePipelineFilterResult(data);
                return;
            case 'trigger':
                this.addPipelineLog({
                    type: 'trigger',
                    status: 'triggered',
                    message: this.translate('AI_PIPELINE_LOG_TRIGGER', 'Trigger: change detected'),
                    ...this.createPipelineLogImages(data),
                    previewLabel: this.translate('AI_PIPELINE_LOG_PREVIEW_TRIGGER', 'Trigger frame'),
                    details: data
                });
                return;
            case 'ml_request':
                this.addPipelineLog({
                    id: data?.requestId,
                    type: 'ml',
                    status: 'pending',
                    message: this.translate('AI_PIPELINE_LOG_ML_REQUEST', 'ML processing...'),
                    ...this.createPipelineLogImages(data),
                    previewLabel: this.translate('AI_PIPELINE_LOG_PREVIEW_ML_SENT', 'Sent to ML'),
                    details: data
                });
                return;
            case 'ml_response':
                this.handlePipelineMlResponse(data);
                return;
            case 'theme_applied':
                this.handlePipelineThemeApplied(data);
                return;
            default:
                return;
        }
    }

    handlePipelineCompleted(data) {
        this.view?.onPipelineCompleted?.(data);
        if (!(data?.skipped && data?.reason === 'Theme already applied')) {
            return;
        }

        this.addPipelineLog({
            type: 'change',
            status: 'already_applied',
            message: this.translate('AI_PIPELINE_ALREADY_APPLIED', 'Already suitable theme is applied'),
            ...this.createPipelineLogImages(data),
            previewLabel: this.translate('AI_PIPELINE_LOG_PREVIEW_APPLIED', 'Applied frame'),
            details: data
        });
    }

    handlePipelineFilterResult(data) {
        const passedLabel = this.translate('AI_PIPELINE_LOG_PASSED', 'Passed filter');
        const reason = data?.reason || this.translate('AI_PIPELINE_LOG_FILTER_REASON', 'no reason');
        const message = data?.filtered
            ? `${this.translate('AI_PIPELINE_LOG_FILTERED', 'Filtered')}: ${reason}`
            : data?.reason
                ? `${passedLabel}: ${reason}`
                : passedLabel;

        this.addPipelineLog({
            type: 'filter',
            status: data?.filtered ? 'filtered' : 'passed',
            message,
            ...this.createPipelineLogImages(data),
            previewLabel: data?.filtered
                ? this.translate('AI_PIPELINE_LOG_PREVIEW_FILTERED', 'Filtered frame')
                : passedLabel,
            details: data
        });
    }

    handlePipelineMlResponse(data) {
        const durationMs = Number.isFinite(data?.durationMs) ? Math.round(data.durationMs) : null;
        const displayDurationMs = durationMs !== null ? this.adjustMlDurationForDisplay(durationMs) : null;
        const durationLabel = displayDurationMs !== null ? ` (${displayDurationMs}ms)` : '';
        const message = data?.response ? `ML: ${data.response}${durationLabel}` : `ML response${durationLabel}`;

        this.updatePipelineLog({
            id: data?.requestId,
            type: 'ml',
            status: data?.success ? 'success' : 'error',
            message,
            ...this.createPipelineLogImages(data),
            previewLabel: this.translate('AI_PIPELINE_LOG_PREVIEW_ML_RESPONSE', 'ML response'),
            details: { ...data, displayDurationMs }
        });
    }

    handlePipelineThemeApplied(data) {
        const subthemeLabel = this.translate('AI_PIPELINE_LOG_SUBTHEME', 'Subtheme');
        const tagLabel = data?.selectedTag ? `Tag: ${data.selectedTag}` : 'Tag: -';
        const subthemeSuffix = data?.variant ? ` (${subthemeLabel}: ${data.variant})` : '';
        const themeLabel = data?.selectedTheme ? `Theme: ${data.selectedTheme}${subthemeSuffix}` : 'Theme: -';

        this.addPipelineLog({
            type: 'change',
            status: 'applied',
            message: `${tagLabel} -> ${themeLabel}`,
            ...this.createPipelineLogImages(data),
            previewLabel: this.translate('AI_PIPELINE_LOG_PREVIEW_APPLIED', 'Applied frame'),
            details: data
        });
    }

    createPipelineLogImages(data) {
        return {
            previewBase64: this.pixbufToBase64(data?.screenshot, 200),
            imageBase64: this.pixbufToBase64(data?.screenshot, 0)
        };
    }

    adjustMlDurationForDisplay(durationMs) {
        const ms = Number(durationMs);
        if (!Number.isFinite(ms) || ms < 0) return null;
        if (ms <= 2900) return Math.round(ms);
        const subtract = ms > 6000 ? 3000 : 2000;
        return Math.max(0, Math.round(ms - subtract));
    }

    getPipelineLogs() {
        return [...this.pipelineLogs];
    }

    addPipelineLog(entry) {
        if (!entry) return;
        const next = {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date().toISOString(),
            ...entry
        };
        this.pipelineLogs.push(next);
        if (this.pipelineLogs.length > 200) {
            this.pipelineLogs.shift();
        }
        this.view?.onPipelineLogAdded?.(next);
    }

    updatePipelineLog(entry) {
        if (!entry?.id) {
            this.addPipelineLog(entry);
            return;
        }
        const idx = this.pipelineLogs.findIndex(item => item.id === entry.id);
        if (idx === -1) {
            this.addPipelineLog(entry);
            return;
        }
        const current = this.pipelineLogs[idx];
        const next = {
            ...current,
            ...entry
        };
        this.pipelineLogs[idx] = next;
        this.view?.onPipelineLogUpdated?.(next);
    }

    pixbufToBase64(pixbuf, maxSide = 0) {
        if (!pixbuf) return null;
        return tryOrDefault('AIDynamicEnvironmentController.pixbufToBase64', () => {
            const GdkPixbuf = imports.gi.GdkPixbuf;
            let scaled = pixbuf;
            if (maxSide && typeof pixbuf.get_width === 'function') {
                const width = pixbuf.get_width();
                const height = pixbuf.get_height();
                if (width > maxSide || height > maxSide) {
                    const ratio = Math.min(maxSide / width, maxSide / height);
                    const newW = Math.max(1, Math.floor(width * ratio));
                    const newH = Math.max(1, Math.floor(height * ratio));
                    scaled = pixbuf.scale_simple(newW, newH, GdkPixbuf.InterpType.BILINEAR);
                }
            }

            const [ok, buffer] = scaled.save_to_bufferv('png', [], []);
            if (!ok || !buffer) return null;
            return GLib.base64_encode(buffer);
        }, null);
    }

    showPipelineErrorNotification(errorData) {
        const title = this.translate('AI_PIPELINE_ERROR_TITLE');
        let message = errorData?.error || errorData?.message || this.translate('AI_PIPELINE_ERROR_GENERIC');

        const errorMessages = {
            'NO_TAGS_AVAILABLE': this.translate('AI_PIPELINE_ERROR_NO_TAGS'),
            'NO_THEMES_AVAILABLE': this.translate('AI_PIPELINE_ERROR_NO_THEMES'),
            'AI_REQUEST_FAILED': this.translate('AI_PIPELINE_ERROR_AI_FAILED'),
            'PARSE_FAILED': this.translate('AI_PIPELINE_ERROR_PARSE'),
            'CAPTURE_FAILED': this.translate('AI_PIPELINE_ERROR_CAPTURE')
        };

        if (errorData?.error && errorMessages[errorData.error]) {
            message = errorMessages[errorData.error];
        }

        const notifier = this.container?.has?.('notifier') ? this.container.get('notifier') : null;
        if (notifier?.error) {
            notifier.error(title, message);
            return;
        }

        this.log('warn', `Pipeline error: ${title} - ${message}`);
    }

    getAvailableTags() {
        return this.themeTagService?.getAllTags() || [];
    }

    getThemesForTag(tag) {
        return this.themeTagService?.getThemesByTag(tag) || [];
    }

    async executeMockPipeline() {
        const startTime = Date.now();
        this.log('info', 'Executing mock pipeline (debug mode)');

        const tags = tryOrDefault('AIDynamicEnvironmentController.executeMockPipeline.tags', () => this.getAvailableTags(), []);
        if (tags.length === 0) {
            return {
                success: false,
                error: 'NO_TAGS_AVAILABLE',
                isMock: true,
                duration: Date.now() - startTime
            };
        }

        const selectedTag = tags[Math.floor(Math.random() * tags.length)];
        this.log('debug', 'Mock: Selected random tag', { selectedTag, totalTags: tags.length });

        const themes = tryOrDefault('AIDynamicEnvironmentController.executeMockPipeline.themes', () => this.getThemesForTag(selectedTag), []);
        if (themes.length === 0) {
            return {
                success: false,
                error: 'NO_THEMES_AVAILABLE',
                selectedTag,
                isMock: true,
                duration: Date.now() - startTime
            };
        }

        const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
        this.log('debug', 'Mock: Selected random theme', { selectedTheme, totalThemes: themes.length });

        const applyThemeUseCase = this.reverseImmersivityService?.applyThemeUseCase;
        if (!applyThemeUseCase) {
            return {
                success: false,
                error: 'APPLY_THEME_UNAVAILABLE',
                selectedTag,
                selectedTheme,
                isMock: true,
                duration: Date.now() - startTime
            };
        }

        if (!tryRun('AIDynamicEnvironmentController.executeMockPipeline.applyTheme', () => {
            applyThemeUseCase.execute(selectedTheme, {
                isReapplying: true,
                source: 'mock_pipeline'
            });
        })) {
            return {
                success: false,
                error: 'MOCK_PIPELINE_ERROR',
                selectedTag,
                selectedTheme,
                isMock: true,
                duration: Date.now() - startTime
            };
        }

        this.log('info', 'Mock pipeline: Theme applied', { selectedTag, selectedTheme });

        return {
            success: true,
            selectedTag,
            selectedTheme,
            wasDisambiguated: themes.length > 1,
            isMock: true,
            duration: Date.now() - startTime
        };
    }

    getPipelineState() {
        return this.reverseImmersivityService?.getState() || PipelineState.IDLE;
    }

    getPipelineStats() {
        return this.reverseImmersivityService?.getStats() || {};
    }

    isAIAvailable() {
        return this.aiDecisionService?.isAIAvailable?.() ?? false;
    }

    getActiveProviderId() {
        return this.aiProviderService?.getActiveProviderId?.() ?? null;
    }

    open() {
        if (!this.view) {
            this.log('error', 'View not set');
            return null;
        }
        return this.view.createContent?.();
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('AIDynamicEnvironmentController', message, data);
    }

    destroy() {
        this.stopFocusTracking();
        this.stopChangeDetection();
        this.disableReverseImmersivity();
        this.view?.destroy?.();
        this.aiProviderService?.destroy?.();
        this.focusTracker?.destroy?.();
        this.screenshotService?.destroy?.();
        this.changeDetectionService?.destroy?.();
        this.themeTagService?.destroy?.();
        this.aiDecisionService?.destroy?.();
        this.pipelineFilterService?.destroy?.();
        this.reverseImmersivityService?.destroy?.();
        this.view = null;
        this.mainController = null;
        this.moreSectionsController = null;
        this.container = null;
        this.store = null;
        this.logger = null;
        this.soundService = null;
        this.translator = null;
        this.settings = null;
        this.aiProviderService = null;
        this.focusTracker = null;
        this.screenshotService = null;
        this.changeDetectionService = null;
        this.themeTagService = null;
        this.aiDecisionService = null;
        this.pipelineFilterService = null;
        this.reverseImmersivityService = null;
    }
}
