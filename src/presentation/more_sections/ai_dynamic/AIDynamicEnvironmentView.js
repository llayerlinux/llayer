import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { PipelineFilterDialog } from './PipelineFilterDialog.js';
import { addPointerCursor, wrapTabLabel } from '../../common/ViewUtils.js';
import { tryOrDefault, tryOrFalse, tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

export class AIDynamicEnvironmentView {
    constructor(controller, logger = null) {
        this.controller = controller;
        this.isTrackingFocus = false;
        this.focusPollId = null;
        this.lastFullScreenshot = null;
        this._accelGroup = null;
        this._accelGroupConnected = false;
        this.logger = logger;
        this.rootWidget = null;
        this.notebook = null;
        this.widgets = {};

        this._aiMockEnabled = false;

        this.soundService = controller?.soundService;

        this._pipelineLogDialog = null;
        this._pipelineLogListBox = null;
        this._pipelineLogEmptyLabel = null;
        this._pipelineLogRowMap = null;
        this._pipelineLogScrolled = null;
    }

    ensureExpandedLayout() {
        if (this.rootWidget && this.isWidgetValid(this.rootWidget)) {
            this.rootWidget.set_hexpand(true);
            this.rootWidget.set_vexpand(true);
            this.rootWidget.set_halign(Gtk.Align.FILL);
            this.rootWidget.set_valign(Gtk.Align.FILL);
        }

        if (this.notebook && this.isWidgetValid(this.notebook)) {
            this.notebook.set_hexpand(true);
            this.notebook.set_vexpand(true);
            this.notebook.set_halign(Gtk.Align.FILL);
            this.notebook.set_valign(Gtk.Align.FILL);
        }
    }

    setController(controller) {
        this.controller = controller;
    }

    t(key, fallback = null) {
        const value = this.controller?.translate?.(key);
        return typeof value === 'string' && value !== key ? value : (fallback ?? key);
    }

    isWidgetValid(widget) {
        if (!widget)
            return false;
        return tryOrFalse('AIDynamicEnvironmentView.isWidgetValid', () => {
            widget.get_visible();
            return true;
        });
    }

    applyWidgetSetting(widget, isEligible, applyValue) {
        if (!(widget && this.isWidgetValid(widget) && isEligible))
            return;
        applyValue(widget);
    }

    invalidateWidgets() {
        this.rootWidget = null;
        this.notebook = null;
        this.widgets = {};
        this.thresholdScale = null;
        this.thresholdValueLabel = null;
        this.lastFullScreenshot = null;
    }

    createContent() {
        if (this.rootWidget && this.isWidgetValid(this.rootWidget)) {
            this.ensureExpandedLayout();
            return this.rootWidget;
        }

        this.invalidateWidgets();

        const wrapper = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: true
        });
        wrapper.set_halign(Gtk.Align.FILL);
        wrapper.set_valign(Gtk.Align.FILL);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: false,
            spacing: 0,
            margin_top: 8,
            valign: Gtk.Align.FILL
        });
        mainBox.set_halign(Gtk.Align.FILL);
        mainBox.set_size_request(560, -1);
        mainBox.get_style_context().add_class('ai-dynamic-view');

        this.notebook = new Gtk.Notebook({
            hexpand: true,
            vexpand: false,
            scrollable: true,
            halign: Gtk.Align.FILL,
            valign: Gtk.Align.START
        });
        this.notebook.set_tab_pos(Gtk.PositionType.TOP);
        this.notebook.set_size_request(560, 720);
        this.notebook.get_style_context().add_class('ai-dynamic-notebook');

        const immersivityTab = this.createImmersivityTab();
        const immersivityLabel = new Gtk.Label({label: this.t('AI_TAB_REVERSE_IMMERSION', 'Reverse immersion')});
        immersivityLabel.set_margin_start(6);
        immersivityLabel.set_margin_end(6);
        this.notebook.append_page(immersivityTab, wrapTabLabel(immersivityLabel));

        const aiConfigTab = this.createAIConfigTab();
        const aiConfigLabel = new Gtk.Label({label: this.t('AI_TAB_UI_REALTIME', 'UI Realtime')});
        aiConfigLabel.set_margin_start(6);
        aiConfigLabel.set_margin_end(6);
        this.notebook.append_page(aiConfigTab, wrapTabLabel(aiConfigLabel));

        const aiProvidersTab = this.createAIProvidersTab();
        const aiProvidersLabel = new Gtk.Label({label: this.t('AI_TAB_PROVIDERS', 'AI Providers')});
        aiProvidersLabel.set_margin_start(6);
        aiProvidersLabel.set_margin_end(6);
        this.notebook.append_page(aiProvidersTab, wrapTabLabel(aiProvidersLabel));

        const advancedTab = this.createAdvancedTab();
        const advancedLabel = new Gtk.Label({label: this.t('AI_TAB_ADVANCED', 'Advanced')});
        advancedLabel.set_margin_start(6);
        advancedLabel.set_margin_end(6);
        this.notebook.append_page(advancedTab, wrapTabLabel(advancedLabel));

        this.notebook.connect('switch-page', (notebook, page, pageNum) => {
            if (pageNum === 2) {
                this.refreshProvidersList();
            }
        });

        mainBox.pack_start(this.notebook, false, false, 0);

        wrapper.pack_start(mainBox, false, false, 0);

        wrapper.connect('destroy', () => {
            this.invalidateWidgets();
        });

        this.rootWidget = wrapper;
        this.ensureExpandedLayout();
        return this.rootWidget;
    }

    createImmersivityTab() {
        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_propagate_natural_height(false);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 8,
            margin_bottom: 16,
            margin_start: 12,
            margin_end: 12,
            hexpand: true,
            valign: Gtk.Align.START
        });

        const pipelineLogsBtn = new Gtk.Button();
        pipelineLogsBtn.set_image(new Gtk.Image({
            icon_name: 'document-open-recent-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        }));
        pipelineLogsBtn.set_tooltip_text(this.t('AI_PIPELINE_LOG_OPEN', 'Open pipeline log'));
        pipelineLogsBtn.get_style_context().add_class('flat');
        addPointerCursor(pipelineLogsBtn);
        pipelineLogsBtn.connect('clicked', () => this.showPipelineLogsDialog());

        const immersivityRow = this.createSwitchRow(
            this.t('AI_REVERSE_IMMERSIVITY', 'Reverse Immersivity'),
            this.t('AI_REVERSE_IMMERSIVITY_DESC', 'Enable reverse immersivity mode for windows'),
            'reverseImmersivity',
            [pipelineLogsBtn]
        );
        immersivityRow.set_margin_top(8);
        box.pack_start(immersivityRow, false, false, 0);

        const sep1 = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        sep1.get_style_context().add_class('ai-section-divider');
        sep1.set_margin_top(4);
        sep1.set_margin_bottom(4);
        box.pack_start(sep1, false, false, 0);

        const patternRow = this.createDropdownRow(
            this.t('AI_CHANGE_PATTERN', 'Change Pattern'),
            this.t('AI_CHANGE_PATTERN_DESC', 'Pattern for immersivity changes'),
            'changePattern',
            [
                ['more1', this.t('AI_PATTERN_MORE1', 'More 1 (Pixel difference)')],
                ['more2', this.t('AI_PATTERN_MORE2', 'More 2 (Histogram)')]
            ]
        );
        box.pack_start(patternRow, false, false, 0);

        const thresholdRow = this.createThresholdSlider();
        box.pack_start(thresholdRow, false, false, 0);

        const sep2 = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        sep2.get_style_context().add_class('ai-section-divider');
        sep2.set_margin_top(4);
        sep2.set_margin_bottom(4);
        box.pack_start(sep2, false, false, 0);

        const windowsContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        const windowsRow = this.createDropdownRow(
            this.t('AI_ALLOWED_WINDOWS', 'Allowed Windows'),
            this.t('AI_ALLOWED_WINDOWS_DESC', 'Windows allowed for immersivity effects'),
            'allowedWindows',
            [
                ['any_focus', this.t('AI_WINDOW_ANY_FOCUS', 'Any current focus')],
                ['full_screen', this.t('AI_WINDOW_FULL_SCREEN', 'Full screen')],
                ['specific_window', this.t('AI_WINDOW_SPECIFIC', 'Specific window')]
            ]
        );
        windowsContainer.pack_start(windowsRow, false, false, 0);

        const specificWindowBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 16,
            margin_top: 4
        });
        specificWindowBox.hide();

        const windowCombo = new Gtk.ComboBoxText();
        windowCombo.set_hexpand(true);
        this.widgets['specificWindowCombo'] = windowCombo;

        const refreshButton = new Gtk.Button({label: 'вџі'});
        refreshButton.set_tooltip_text(this.t('AI_REFRESH_WINDOWS', 'Refresh window list'));
        addPointerCursor(refreshButton);

        const refreshWindowList = () => {
            windowCombo.remove_all();
            const windows = this.controller?.getAllWindows?.() || [];
            const currentSelected = this.controller?.getSettings?.()?.selectedWindowClass;
            let foundSelected = false;
            let retroarchIndex = -1;

            print(`[AI_VIEW] Refreshing window list, found ${windows.length} windows`);
            windows.forEach((w, idx) => {
                const label = `${w.class} - ${w.title?.substring(0, 30) || '(no title)'}`;
                print(`[AI_VIEW]   - ${w.class}`);
                windowCombo.append(w.class, label);
                if (w.class === currentSelected) {
                    foundSelected = true;
                }
                if (w.class.toLowerCase?.() === 'retroarch') {
                    retroarchIndex = idx;
                }
            });

            this.applySpecificWindowSelection(windowCombo, windows, {
                currentSelected,
                foundSelected,
                retroarchIndex
            });
        };

        refreshButton.connect('clicked', () => {
            print(`[AI_VIEW] Refresh button clicked`);
            refreshWindowList();
        });

        windowCombo.connect('changed', () => {
            const selectedClass = windowCombo.get_active_id();
            if (selectedClass && selectedClass !== 'none') {
                this.controller?.onSettingChanged?.('selectedWindowClass', selectedClass);
            }
        });

        specificWindowBox.pack_start(windowCombo, true, true, 0);
        specificWindowBox.pack_start(refreshButton, false, false, 0);
        windowsContainer.pack_start(specificWindowBox, false, false, 0);
        this.widgets['specificWindowBox'] = specificWindowBox;
        this.refreshSpecificWindowList = refreshWindowList;

        this.updateSpecificWindowVisibility = () => {
            const windowsModeCombo = this.widgets['allowedWindows'];
            const mode = windowsModeCombo?.get_active_id?.();
            print(`[AI_VIEW] Updating specific window visibility, mode: ${mode}`);
            switch (mode) {
                case 'specific_window':
                    specificWindowBox.show();
                    windowCombo.show();
                    refreshButton.show();
                    refreshWindowList();
                    break;
                default:
                    specificWindowBox.hide();
                    break;
            }
        };

        box.pack_start(windowsContainer, false, false, 0);

        const sep3 = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        sep3.get_style_context().add_class('ai-section-divider');
        sep3.set_margin_top(4);
        sep3.set_margin_bottom(4);
        box.pack_start(sep3, false, false, 0);

        const providerRow = this.createDropdownRow(
            this.t('AI_PROVIDER', 'AI Provider'),
            this.t('AI_PROVIDER_DESC', 'Select AI provider for dynamic features'),
            'aiProvider',
            []
        );
        box.pack_start(providerRow, false, false, 0);

        const filterRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 8
        });

        const filterTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const filterLabel = new Gtk.Label({
            label: this.t('PIPELINE_FILTER', 'Pipeline Filter'),
            halign: Gtk.Align.START
        });
        filterLabel.get_style_context().add_class('ai-setting-label');
        filterTextBox.pack_start(filterLabel, false, false, 0);

        const filterDesc = new Gtk.Label({
            label: this.t('PIPELINE_FILTER_DESC', 'Pre-filter frames before AI processing'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 35,
            xalign: 0
        });
        filterDesc.get_style_context().add_class('ai-setting-desc');
        filterTextBox.pack_start(filterDesc, false, false, 0);

        filterRow.pack_start(filterTextBox, true, true, 0);

        const filterButton = new Gtk.Button({
            label: this.t('CONFIGURE', 'Configure...'),
            valign: Gtk.Align.CENTER
        });
        filterButton.get_style_context().add_class('ai-secondary-button');
        addPointerCursor(filterButton);
        filterButton.connect('clicked', () => this.showPipelineFilterDialog());
        filterRow.pack_end(filterButton, false, false, 0);

        this._filterStatusLabel = new Gtk.Label({
            label: '',
            valign: Gtk.Align.CENTER
        });
        this._filterStatusLabel.get_style_context().add_class('ai-setting-desc');
        filterRow.pack_end(this._filterStatusLabel, false, false, 8);

        this.updateFilterStatus();

        box.pack_start(filterRow, false, false, 0);

        const sep4 = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        sep4.get_style_context().add_class('ai-section-divider');
        sep4.set_margin_top(8);
        sep4.set_margin_bottom(4);
        box.pack_start(sep4, false, false, 0);

        const debugSection = this.createDebugSection();
        box.pack_start(debugSection, false, false, 0);

        scrolled.add(box);
        return scrolled;
    }

    createDebugSection() {
        const frame = new Gtk.Frame({
            label: this.t('AI_DEBUG_SECTION', 'Debug (Input Formation)'),
            hexpand: true
        });
        frame.get_style_context().add_class('ai-debug-frame');

        const innerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const focusRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const focusLabel = new Gtk.Label({
            label: this.t('AI_DEBUG_FOCUS', 'Active Focus:'),
            halign: Gtk.Align.START
        });
        focusLabel.get_style_context().add_class('ai-setting-label');
        focusRow.pack_start(focusLabel, false, false, 0);

        this.focusDisplayLabel = new Gtk.Label({
            label: this.t('AI_DEBUG_NO_TRACKING', 'Not tracking'),
            halign: Gtk.Align.START,
            hexpand: true,
            ellipsize: 3,
            max_width_chars: 50
        });
        this.focusDisplayLabel.get_style_context().add_class('dim-label');
        focusRow.pack_start(this.focusDisplayLabel, true, true, 0);

        innerBox.pack_start(focusRow, false, false, 0);

        const changeRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const changeLabel = new Gtk.Label({
            label: this.t('AI_DEBUG_CHANGE_PERCENT', 'Change:'),
            halign: Gtk.Align.START
        });
        changeLabel.get_style_context().add_class('ai-setting-label');
        changeRow.pack_start(changeLabel, false, false, 0);

        this.changePercentLabel = new Gtk.Label({
            label: '0%',
            halign: Gtk.Align.START,
            hexpand: true
        });
        this.changePercentLabel.get_style_context().add_class('dim-label');
        changeRow.pack_start(this.changePercentLabel, true, true, 0);

        innerBox.pack_start(changeRow, false, false, 0);

        const criticalRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const criticalLabel = new Gtk.Label({
            label: this.t('AI_DEBUG_CRITICAL', 'Critical:'),
            halign: Gtk.Align.START
        });
        criticalLabel.get_style_context().add_class('ai-setting-label');
        criticalRow.pack_start(criticalLabel, false, false, 0);

        this.criticalChangeLabel = new Gtk.Label({
            label: '-',
            halign: Gtk.Align.START
        });
        this.criticalChangeLabel.get_style_context().add_class('dim-label');
        criticalRow.pack_start(this.criticalChangeLabel, false, false, 0);

        const criticalSpacer = new Gtk.Box({ hexpand: true });
        criticalRow.pack_start(criticalSpacer, true, true, 0);

        this.lastCriticalTimeLabel = new Gtk.Label({
            label: '',
            halign: Gtk.Align.END
        });
        this.lastCriticalTimeLabel.get_style_context().add_class('dim-label');
        criticalRow.pack_start(this.lastCriticalTimeLabel, false, false, 0);

        const logButton = new Gtk.Button();
        logButton.set_image(new Gtk.Image({
            icon_name: 'document-open-recent-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        }));
        logButton.set_tooltip_text(this.t('AI_DEBUG_SHOW_LOG', 'Show critical events log'));
        logButton.get_style_context().add_class('flat');
        addPointerCursor(logButton);
        logButton.connect('clicked', () => this.showCriticalLogDialog());
        criticalRow.pack_end(logButton, false, false, 0);

        this._criticalEventsLog = [];

        innerBox.pack_start(criticalRow, false, false, 0);

        const hintLabel = new Gtk.Label({
            label: this.t('AI_DEBUG_SHORTCUT', 'Ctrl+D: manual capture (when focused). Auto-captures on critical change.'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 45,
            xalign: 0
        });
        hintLabel.get_style_context().add_class('dim-label');
        innerBox.pack_start(hintLabel, false, false, 0);

        const previewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_top: 8
        });

        const previewLabel = new Gtk.Label({
            label: this.t('AI_DEBUG_PREVIEW', 'Screenshot Preview:'),
            halign: Gtk.Align.START
        });
        previewLabel.get_style_context().add_class('ai-setting-label');
        previewBox.pack_start(previewLabel, false, false, 0);

        this.screenshotPreviewEventBox = new Gtk.EventBox();
        this.screenshotPreviewEventBox.set_visible_window(false);

        this.screenshotPreview = new Gtk.Image();
        this.screenshotPreview.set_size_request(200, 120);
        this.screenshotPreview.get_style_context().add_class('ai-screenshot-preview');

        this.screenshotPlaceholder = new Gtk.Label({
            label: this.t('AI_DEBUG_NO_SCREENSHOT', 'No screenshot captured'),
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });
        this.screenshotPlaceholder.get_style_context().add_class('dim-label');
        this.screenshotPlaceholder.set_size_request(200, 120);

        this.previewStack = new Gtk.Stack();
        this.previewStack.add_named(this.screenshotPlaceholder, 'placeholder');
        this.previewStack.add_named(this.screenshotPreview, 'preview');
        this.previewStack.set_visible_child_name('placeholder');

        this.screenshotPreviewEventBox.add(this.previewStack);

        this.screenshotPreviewEventBox.connect('button-press-event', () => {
            this.showFullScreenshotDialog();
            return true;
        });

        addPointerCursor(this.screenshotPreviewEventBox);
        previewBox.pack_start(this.screenshotPreviewEventBox, false, false, 0);
        innerBox.pack_start(previewBox, false, false, 0);

        const mockRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8
        });

        this._aiMockCheckbox = new Gtk.CheckButton({
            label: this.t('AI_DEBUG_MOCK_MODE', 'AI Mock (random tag/theme)')
        });
        this._aiMockCheckbox.set_active(this._aiMockEnabled);
        this._aiMockCheckbox.set_tooltip_text(
            this.t('AI_DEBUG_MOCK_MODE_DESC', 'Test theme application without AI provider - picks random tag and theme')
        );
        this._aiMockCheckbox.connect('toggled', (widget) => {
            this._aiMockEnabled = widget.get_active();
            this.log('info', `AI Mock mode ${this._aiMockEnabled ? 'enabled' : 'disabled'}`);
        });
        mockRow.pack_start(this._aiMockCheckbox, false, false, 0);

        innerBox.pack_start(mockRow, false, false, 0);

        const buttonRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8
        });

        this.trackingButton = new Gtk.Button({
            label: this.t('AI_DEBUG_START_TRACKING', 'Start Tracking')
        });
        this.trackingButton.get_style_context().add_class('ai-primary-button');
        addPointerCursor(this.trackingButton);
        this.trackingButton.connect('clicked', () => this.toggleTracking());
        buttonRow.pack_start(this.trackingButton, false, false, 0);

        this.screenshotButton = new Gtk.Button({
            label: this.t('AI_DEBUG_CAPTURE_BTN', 'Capture (Ctrl+D)')
        });
        this.screenshotButton.get_style_context().add_class('ai-secondary-button');
        this.screenshotButton.set_sensitive(false);
        addPointerCursor(this.screenshotButton);
        this.screenshotButton.connect('clicked', () => this.captureScreenshot());
        buttonRow.pack_start(this.screenshotButton, false, false, 0);

        innerBox.pack_start(buttonRow, false, false, 0);

        frame.add(innerBox);

        this.setupKeyboardShortcut();

        return frame;
    }

    toggleTracking() {
        if (this.isTrackingFocus) {
            this.endTracking();
        } else {
            this.beginTracking();
        }
    }

    startTracking() {
        if (!this.isTrackingFocus) {
            this.beginTracking();
        }
    }

    stopTracking() {
        if (this.isTrackingFocus) {
            this.endTracking();
        }
    }

    beginTracking() {
        this.isTrackingFocus = true;
        this.trackingButton?.set_label(this.t('AI_DEBUG_STOP_TRACKING', 'Stop Tracking'));
        this.screenshotButton?.set_sensitive(true);

        this.connectKeyboardShortcut();

        this.controller?.startFocusTracking?.((event, data) => {
            if (event === 'focus_changed' && data?.current) {
                this.updateFocusDisplay(data.current);
            }
        });

        this.controller?.startChangeDetection?.((changePercent) => {
            this.updateChangePercent(changePercent);
        });

        const currentFocus = this.controller?.getFocusDisplayString?.();
        this.focusDisplayLabel?.set_label(currentFocus || 'No window focused');
        this.changePercentLabel?.set_label('0%');

        this.focusPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            if (!this.isTrackingFocus) return GLib.SOURCE_REMOVE;

            const focusStr = this.controller?.getFocusDisplayString?.();
            this.focusDisplayLabel?.set_label(focusStr || 'No window focused');
            return GLib.SOURCE_CONTINUE;
        });
    }

    endTracking() {
        this.isTrackingFocus = false;
        this._frameCounter = 0;
        this._criticalCounter = 0;
        this.trackingButton?.set_label(this.t('AI_DEBUG_START_TRACKING', 'Start Tracking'));
        this.screenshotButton?.set_sensitive(false);
        this.controller?.stopFocusTracking?.();
        this.controller?.stopChangeDetection?.();
        this.focusDisplayLabel?.set_label(this.t('AI_DEBUG_NO_TRACKING', 'Not tracking'));
        this.changePercentLabel?.set_label('0%');

        if (this.criticalChangeLabel) {
            this.criticalChangeLabel.set_label('-');
            this.criticalChangeLabel.get_style_context().remove_class('ai-critical-change');
            this.criticalChangeLabel.get_style_context().add_class('dim-label');
        }
        this.lastCriticalTimeLabel?.set_label('');

        this.disconnectKeyboardShortcut();

        if (this.focusPollId) {
            GLib.source_remove(this.focusPollId);
            this.focusPollId = null;
        }

        if (this._delayTimerId) {
            GLib.source_remove(this._delayTimerId);
            this._delayTimerId = null;
        }

        this.previewStack?.set_visible_child_name('placeholder');
        this.screenshotPreview?.clear?.();
        this.lastFullScreenshot = null;
    }

    updateChangePercent(changePercent) {
        if (!this.changePercentLabel) return;

        this._frameCounter = (this._frameCounter || 0) + 1;

        if (changePercent < 0) {
            this.changePercentLabel.set_label(this.t('AI_DEBUG_CAPTURE_ERROR', 'Capture error'));
            this.criticalChangeLabel?.set_label('-');
        } else {
            this.changePercentLabel.set_label(`${changePercent}% [#${this._frameCounter}]`);

            this.criticalChangeLabel?.set_label(`${changePercent}%`);

            const threshold = this.controller?.getSettings?.()?.changeThreshold ?? 20;
            const ignoreFocusChange = this.controller?.getSettings?.()?.ignoreFocusChange === true;

            if (changePercent >= threshold && changePercent > 0) {
                this.criticalChangeLabel?.get_style_context().remove_class('dim-label');
                this.criticalChangeLabel?.get_style_context().add_class('ai-critical-change');
                this.handleCriticalChange(changePercent);
            } else {
                this.criticalChangeLabel?.get_style_context().remove_class('ai-critical-change');
                this.criticalChangeLabel?.get_style_context().add_class('dim-label');
                if (ignoreFocusChange) {
                    const focusStabilityWindowMs = settings.focusStabilityWindowMs ?? 1000;
                    const isInCooldown = Date.now() < (this._stableFocusCooldownUntil || 0);
                    const focusChangedRecently = this.controller?.focusTracker?.hasFocusChangedRecently?.(focusStabilityWindowMs) ?? false;
                    if (!focusChangedRecently && !isInCooldown) {
                        this._lastStableFocus = this.controller?.getCurrentFocusInfo?.();
                    }
                }
            }
        }
    }

    handleCriticalChange(changePercent) {
        const settings = this.controller?.getSettings?.() || {};
        const mode = settings.changeDetectionMode || 'none';
        const delayMs = settings.captureDelay ?? 500;
        const ignoreFocusChange = settings.ignoreFocusChange === true;
        const focusCooldownMs = settings.focusCooldownMs ?? 10000;
        const areaSizeRatioThreshold = (settings.areaSizeRatio ?? 50) / 100;
        const focusCheckDelayMs = settings.focusCheckDelayMs ?? 2000;

        if (ignoreFocusChange) {
            const stableFocus = this._lastStableFocus;
            const currentFocus = this.controller?.getCurrentFocusInfo?.();

            const stableArea = (stableFocus?.size?.[0] || 0) * (stableFocus?.size?.[1] || 0);
            const currentArea = (currentFocus?.size?.[0] || 0) * (currentFocus?.size?.[1] || 0);
            const areaRatio = stableArea > 0 && currentArea > 0
                ? Math.min(stableArea, currentArea) / Math.max(stableArea, currentArea)
                : 1;
            const significantSizeChange = areaRatio < areaSizeRatioThreshold;

            print(`[AI_VIEW] Critical change ${changePercent}%`);
            print(`[AI_VIEW] Stable focus (before): ${stableFocus?.class || 'none'} (pid: ${stableFocus?.pid || 'none'}) size: ${stableFocus?.size?.join('x') || 'unknown'}`);
            print(`[AI_VIEW] Current focus (now):   ${currentFocus?.class || 'none'} (pid: ${currentFocus?.pid || 'none'}) size: ${currentFocus?.size?.join('x') || 'unknown'}`);
            print(`[AI_VIEW] Area ratio: ${(areaRatio * 100).toFixed(1)}% (threshold: ${(areaSizeRatioThreshold * 100)}%, significant: ${significantSizeChange})`);

            const focusChangedFromStable = !stableFocus || !currentFocus ||
                                           stableFocus.pid !== currentFocus.pid ||
                                           stableFocus.address !== currentFocus.address ||
                                           significantSizeChange;

            if (focusChangedFromStable) {
                print(`[AI_VIEW] ========================================`);
                print(`[AI_VIEW] *** IGNORE CHANGES - FOCUS WINDOW CHANGED ***`);
                print(`[AI_VIEW] Was: ${stableFocus?.class || 'none'}`);
                print(`[AI_VIEW] Now: ${currentFocus?.class || 'none'}`);
                print(`[AI_VIEW] ========================================`);
                this._lastStableFocus = currentFocus;
                this._stableFocusCooldownUntil = Date.now() + focusCooldownMs;
                return;
            }

            print(`[AI_VIEW] Focus same as stable - waiting ${focusCheckDelayMs}ms to check for delayed focus change...`);

            if (this._focusCheckTimerId) {
                GLib.source_remove(this._focusCheckTimerId);
            }

            const focusAtCritical = currentFocus;
            this._focusCheckTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, focusCheckDelayMs, () => {
                this._focusCheckTimerId = null;
                const focusAfterWait = this.controller?.getCurrentFocusInfo?.();

                print(`[AI_VIEW] After ${focusCheckDelayMs}ms wait:`);
                print(`[AI_VIEW] Focus at critical: ${focusAtCritical?.class || 'none'} (pid: ${focusAtCritical?.pid || 'none'})`);
                print(`[AI_VIEW] Focus now:         ${focusAfterWait?.class || 'none'} (pid: ${focusAfterWait?.pid || 'none'})`);

                const focusChangedDuringWait = !focusAtCritical || !focusAfterWait ||
                                               focusAtCritical.pid !== focusAfterWait.pid ||
                                               focusAtCritical.address !== focusAfterWait.address;

                if (focusChangedDuringWait) {
                    print(`[AI_VIEW] ========================================`);
                    print(`[AI_VIEW] *** IGNORE CHANGES - DELAYED FOCUS CHANGE ***`);
                    print(`[AI_VIEW] Was: ${focusAtCritical?.class || 'none'}`);
                    print(`[AI_VIEW] Now: ${focusAfterWait?.class || 'none'}`);
                    print(`[AI_VIEW] ========================================`);
                    this._lastStableFocus = focusAfterWait;
                    this._stableFocusCooldownUntil = Date.now() + focusCooldownMs;
                    return GLib.SOURCE_REMOVE;
                }

                print(`[AI_VIEW] Focus confirmed unchanged - proceeding with pipeline`);
                this.processCriticalChange(changePercent, mode, delayMs);
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this.processCriticalChange(changePercent, mode, delayMs);
    }

    processCriticalChange(changePercent, mode, delayMs) {
        this._criticalCounter = (this._criticalCounter || 0) + 1;
        const timestamp = new Date().toLocaleTimeString();
        const fullTimestamp = new Date().toISOString();

        this.lastCriticalTimeLabel?.set_label(`@ ${timestamp}`);

        if (!this._criticalEventsLog) this._criticalEventsLog = [];
        this._criticalEventsLog.push({
            index: this._criticalCounter,
            changePercent,
            timestamp,
            fullTimestamp
        });

        if (this._criticalEventsLog.length > 100) {
            this._criticalEventsLog.shift();
        }

        this.log('info', 'Critical change detected', {
            changePercent,
            criticalCount: this._criticalCounter,
            timestamp,
            mode
        });

        if (mode === 'delay') {
            if (this._delayTimerId) {
                GLib.source_remove(this._delayTimerId);
            }
            this.log('debug', `Starting capture delay of ${delayMs}ms`);
            this._delayTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
                this._delayTimerId = null;
                this.executePipelineCapture(changePercent);
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this.executePipelineCapture(changePercent);
    }

    executePipelineCapture(changePercent) {
        this.captureScreenshot();

        if (this._aiMockEnabled) {
            this.log('info', 'Using AI Mock mode for pipeline');
            this.executeMockPipeline(changePercent);
            return;
        }

        if (this.controller?.isReverseImmersivityEnabled?.()) {
            this.triggerReverseImmersivityPipeline(changePercent);
        }
    }

    async executeMockPipeline(changePercent) {
        this.log('info', 'Executing mock pipeline', { changePercent });

        const result = await this.controller?.executeMockPipeline?.();

        if (result) {
            this.log('info', 'Mock pipeline result', result);

            if (result.success && result.selectedTheme) {
                const entry = this._criticalEventsLog?.[this._criticalEventsLog.length - 1];
                if (entry) {
                    entry.themeApplied = result.selectedTheme;
                    entry.selectedTag = result.selectedTag;
                    entry.isMock = true;
                }
            }

            if (result.success) {
                this.onPipelineCompleted?.(result);
            } else {
                this.onPipelineError?.(result);
            }
        }
    }

    async triggerReverseImmersivityPipeline(changePercent) {
        this.log('info', 'Triggering reverse immersivity pipeline', { changePercent });

        const result = await this.controller?.triggerReverseImmersivity?.(
            changePercent,
            this.lastFullScreenshot
        );

        if (result) {
            this.log('info', 'Pipeline result', result);
        }
    }

    onPipelineStateChange(fromState, toState) {
        this.log('debug', 'Pipeline state changed', { from: fromState, to: toState });
    }

    onPipelineCompleted(result) {
        this.log('info', 'Pipeline completed', result);

        if (!result?.skipped && result.selectedTheme) {
            const entry = this._criticalEventsLog?.[this._criticalEventsLog.length - 1];
            if (entry) {
                entry.themeApplied = result.selectedTheme;
                entry.selectedTag = result.selectedTag;
            }
        }
    }

    onPipelineError(result) {
        this.log('error', 'Pipeline error', result);
    }

    applySpecificWindowSelection(windowCombo, windows, selectionState = {}) {
        const { currentSelected, foundSelected, retroarchIndex } = selectionState;

        switch (true) {
            case windows.length === 0:
                windowCombo.append('none', this.t('AI_NO_WINDOWS', 'No windows found'));
                windowCombo.set_active(0);
                return;
            case Boolean(currentSelected && foundSelected):
                windowCombo.set_active_id(currentSelected);
                return;
            case retroarchIndex >= 0: {
                windowCombo.set_active(retroarchIndex);
                const retroId = windows[retroarchIndex]?.class;
                retroId && this.controller?.onSettingChanged?.('selectedWindowClass', retroId);
                return;
            }
            default: {
                windowCombo.set_active(0);
                const firstId = windows[0]?.class;
                firstId && this.controller?.onSettingChanged?.('selectedWindowClass', firstId);
            }
        }
    }

    decodeBase64Pixbuf(base64Image) {
        return tryOrNull('AIDynamicEnvironmentView._decodeBase64Pixbuf', () => {
            const GdkPixbuf = imports.gi.GdkPixbuf;
            const bytes = GLib.base64_decode(base64Image);
            if (!bytes || bytes.length === 0)
                return null;

            const loader = new GdkPixbuf.PixbufLoader();
            loader.write(bytes);
            loader.close();
            return loader.get_pixbuf() || null;
        });
    }

    showMessageDialog(parentWindow, messageType, text, secondaryText) {
        const dialog = new Gtk.MessageDialog({
            transient_for: parentWindow,
            modal: true,
            message_type: messageType,
            buttons: Gtk.ButtonsType.OK,
            text,
            secondary_text: secondaryText
        });
        dialog.connect('response', () => dialog.destroy());
        dialog.show();
    }

    showPipelineFilterAddError(parentWindow, errorText) {
        this.showMessageDialog(
            parentWindow,
            Gtk.MessageType.ERROR,
            this.t('ERROR', 'Error'),
            errorText || this.t('PIPELINE_FILTER_ADD_FAILED', 'Failed to add reference')
        );
    }

    syncPipelineFilterBadge(filterService, pixbuf, addButton, addedLabel) {
        if (!filterService?.hasReferenceMatch?.(pixbuf)) {
            return;
        }

        addButton?.hide?.();
        addedLabel?.show?.();
    }

    addPreviewToPipelineFilter(filterService, pixbuf, parentWindow, addButton, addedLabel) {
        if (!filterService) {
            return false;
        }

        const name = `${this.t('PIPELINE_FILTER_REF_PREFIX', 'Log screenshot')} ${new Date().toLocaleTimeString()}`;
        const addResult = filterService.addReferenceFromPixbuf(pixbuf, name);
        if (!addResult?.success) {
            this.showPipelineFilterAddError(
                parentWindow,
                addResult?.error || this.t('PIPELINE_FILTER_ADD_FAILED', 'Failed to add reference')
            );
            return false;
        }

        addButton?.hide?.();
        addedLabel?.show?.();
        return true;
    }

    createProviderResponseWidget(log) {
        const responseContent = log.response?.content;
        const responseError = log.response?.error;

        switch (true) {
            case Boolean(responseContent): {
                const responseLabel = new Gtk.Label({
                    label: responseContent,
                    halign: Gtk.Align.START,
                    wrap: true,
                    wrap_mode: 2,
                    max_width_chars: 70,
                    selectable: true
                });
                responseLabel.get_style_context().add_class('ai-log-text');
                return responseLabel;
            }
            case Boolean(responseError): {
                const errorLabel = new Gtk.Label({
                    label: `Error: ${responseError}`,
                    halign: Gtk.Align.START
                });
                errorLabel.get_style_context().add_class('error');
                return errorLabel;
            }
            case Boolean(log.response?.success): {
                const successLabel = new Gtk.Label({
                    label: this.t('AI_PROVIDER_TEST_SUCCESS', 'Connection Successful'),
                    halign: Gtk.Align.START
                });
                successLabel.get_style_context().add_class('dim-label');
                return successLabel;
            }
            default:
                return null;
        }
    }

    appendPipelineDetails(detailsLines, entry) {
        const details = entry?.details || {};

        switch (entry?.type) {
            case 'trigger':
                Number.isFinite(details?.changePercent)
                    && detailsLines.push(`${this.t('AI_PIPELINE_TRIGGER_CHANGE', 'Detected change')}: ${Number(details.changePercent).toFixed(1)}%`);
                details?.captureMode
                    && detailsLines.push(`${this.t('AI_PIPELINE_TRIGGER_CAPTURE', 'Capture mode')}: ${details.captureMode}`);
                return;
            case 'filter': {
                const outcome = details?.filtered === true
                    ? 'filtered'
                    : details?.filtered === false
                        ? 'passed'
                        : null;
                outcome && detailsLines.push(`${this.t('AI_PIPELINE_FILTER_OUTCOME', 'Outcome')}: ${outcome}`);
                details?.reason && detailsLines.push(`${this.t('AI_PIPELINE_FILTER_REASON', 'Reason')}: ${details.reason}`);
                Number.isFinite(details?.confidence)
                    && detailsLines.push(`${this.t('AI_PIPELINE_FILTER_CONFIDENCE', 'Confidence')}: ${Math.round(details.confidence)}%`);
                return;
            }
            case 'ml': {
                details?.value && detailsLines.push(`${this.t('AI_PIPELINE_ML_VALUE', 'Value')}: ${details.value}`);
                Number.isFinite(details?.confidence)
                    && detailsLines.push(`${this.t('AI_PIPELINE_ML_CONFIDENCE', 'Confidence')}: ${Math.round(details.confidence)}%`);
                const durationForDisplay = Number.isFinite(details?.displayDurationMs)
                    ? details.displayDurationMs
                    : details?.durationMs;
                Number.isFinite(durationForDisplay)
                    && detailsLines.push(`${this.t('AI_PIPELINE_ML_DURATION', 'Duration')}: ${Math.round(durationForDisplay)}ms`);
                details?.error && detailsLines.push(`${this.t('AI_PIPELINE_ML_ERROR', 'Error')}: ${details.error}`);
                return;
            }
            case 'change':
                details?.selectedTag && detailsLines.push(`Tag: ${details.selectedTag}`);
                details?.selectedTheme && detailsLines.push(`Theme: ${details.selectedTheme}`);
                details?.variant && detailsLines.push(`${this.t('AI_PIPELINE_LOG_SUBTHEME', 'Subtheme')}: ${details.variant}`);
                details?.reason && detailsLines.push(`${this.t('AI_PIPELINE_RESULT_REASON', 'Reason')}: ${details.reason}`);
                return;
            default:
                return;
        }
    }

    showPipelineFilterDialog() {
        const pipelineFilterService = this.controller?.pipelineFilterService;
        const aiProviderService = this.controller?.aiProviderService;

        if (!pipelineFilterService) {
            print('[AI_VIEW] Pipeline filter service not available');
            return;
        }

        const dialog = new PipelineFilterDialog(
            this.controller,
            pipelineFilterService,
            aiProviderService,
            (key, fallback) => this.t(key, fallback)
        );

        const parentWindow = tryOrDefault('AIDynamicEnvironmentView._showPipelineFilterDialog', () => {
            const toplevel = this.rootWidget?.get_toplevel?.();
            return toplevel && toplevel instanceof Gtk.Window ? toplevel : null;
        }, null);

        dialog.show(parentWindow);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.updateFilterStatus();
            return GLib.SOURCE_REMOVE;
        });
    }

    updateFilterStatus() {
        if (!this._filterStatusLabel) return;

        const pipelineFilterService = this.controller?.pipelineFilterService;
        if (!pipelineFilterService) {
            this._filterStatusLabel.set_label('');
            return;
        }

        const config = pipelineFilterService.getConfig();
        if (config.enabled) {
            const mode = config.mode === 'ml' ? 'ML' : 'Prog';
            this._filterStatusLabel.set_label(`[${mode}]`);
            this._filterStatusLabel.get_style_context().remove_class('dim-label');
            this._filterStatusLabel.get_style_context().add_class('success-label');
        } else {
            this._filterStatusLabel.set_label(this.t('DISABLED', 'Disabled'));
            this._filterStatusLabel.get_style_context().remove_class('success-label');
            this._filterStatusLabel.get_style_context().add_class('dim-label');
        }
    }

    showCriticalLogDialog() {
        const dialog = new Gtk.Dialog({
            title: this.t('AI_DEBUG_LOG_TITLE', 'Critical Events Log'),
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(400, 300);
        const closeBtn1 = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn1);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(8);
        contentArea.set_margin_bottom(8);
        contentArea.set_margin_start(8);
        contentArea.set_margin_end(8);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const logBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        const events = this._criticalEventsLog || [];

        if (events.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: this.t('AI_DEBUG_LOG_EMPTY', 'No critical events recorded'),
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            emptyLabel.get_style_context().add_class('dim-label');
            logBox.pack_start(emptyLabel, true, true, 0);
        } else {
            for (let i = events.length - 1; i >= 0; i--) {
                const event = events[i];
                let label = `#${event.index}  ${event.changePercent}%  ${event.timestamp}`;

                if (event.themeApplied) {
                    label += `  в†’ ${event.themeApplied} (${event.selectedTag})`;
                }

                const row = new Gtk.Label({
                    label: label,
                    halign: Gtk.Align.START,
                    selectable: true
                });
                row.get_style_context().add_class('ai-log-entry');

                if (event.themeApplied) {
                    row.get_style_context().add_class('ai-log-theme-change');
                }

                logBox.pack_start(row, false, false, 0);
            }
        }

        scrolled.add(logBox);
        contentArea.pack_start(scrolled, true, true, 0);

        dialog.show_all();
        dialog.connect('response', () => dialog.destroy());
    }

    updateFocusDisplay(focusInfo) {
        if (!this.focusDisplayLabel) return;

        if (focusInfo) {
            const displayStr = `${focusInfo.class} | ${focusInfo.title?.substring(0, 40) || ''} (PID: ${focusInfo.pid})`;
            this.focusDisplayLabel.set_label(displayStr);
        } else {
            this.focusDisplayLabel.set_label('No window focused');
        }
    }

    setupKeyboardShortcut() {
        this._accelGroup = new Gtk.AccelGroup();

        const bind = (accel) => {
            const [key, mods] = Gtk.accelerator_parse(accel);
            if (!key) return;
            this._accelGroup.connect(key, mods, Gtk.AccelFlags.VISIBLE, () => {
                if (this.isTrackingFocus) {
                    this.captureScreenshot();
                }
                return true;
            });
        };

        bind('<Control>d');
        bind('<Control>D');
    }

    connectKeyboardShortcut() {
        if (!this._accelGroup) return;

        const tryConnect = () => {
            const window = this.rootWidget?.get_toplevel?.();
            if (!window || !window.is_toplevel?.()) return false;

            if (this._accelGroupConnected) return true;

            window.add_accel_group(this._accelGroup);
            this._accelGroupConnected = true;
            return true;
        };

        if (!tryConnect()) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                tryConnect();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    disconnectKeyboardShortcut() {
        const window = this.rootWidget?.get_toplevel?.();
        if (window?.is_toplevel?.() && this._accelGroup && this._accelGroupConnected) {
            window.remove_accel_group(this._accelGroup);
            this._accelGroupConnected = false;
        }
    }

    captureScreenshot() {
        const captureMode = this.controller?.getCaptureMode?.();
        const result = captureMode === 'full_screen'
            ? this.controller?.captureFullScreen?.()
            : this.controller?.captureActiveWindow?.();

        if (result?.success && result.pixbuf) {
            const scaled = this.controller?.scaleScreenshotForPreview?.(result.pixbuf, 200, 120);

            if (scaled) {
                this.screenshotPreview?.set_from_pixbuf(scaled);
                this.previewStack?.set_visible_child_name('preview');
            }

            this.lastFullScreenshot = result.pixbuf;
        } else {
            this.log('error', 'Screenshot capture failed', { error: result?.error });
        }
    }

    showFullScreenshotDialog() {
        if (!this.lastFullScreenshot) return;

        const dialog = new Gtk.Dialog({
            title: this.t('AI_DEBUG_SCREENSHOT_TITLE', 'Screenshot Preview'),
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(800, 600);
        const closeBtn2 = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn2);

        const contentArea = dialog.get_content_area();

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });

        const image = new Gtk.Image();
        image.set_from_pixbuf(this.lastFullScreenshot);

        scrolled.add(image);
        contentArea.pack_start(scrolled, true, true, 0);

        dialog.show_all();
        dialog.connect('response', () => dialog.destroy());
    }

    createAIConfigTab() {
        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_propagate_natural_height(false);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 8,
            margin_bottom: 32,
            margin_start: 16,
            margin_end: 16,
            hexpand: true,
            vexpand: false,
            valign: Gtk.Align.START
        });

        const placeholder = new Gtk.Label({
            label: this.t('AI_CONFIG_PLACEHOLDER', 'AI configuration options will appear here'),
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            vexpand: false
        });
        placeholder.get_style_context().add_class('dim-label');
        box.pack_start(placeholder, true, true, 0);

        scrolled.add(box);
        return scrolled;
    }

    createAIProvidersTab() {
        const tabScrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        tabScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        tabScrolled.set_propagate_natural_height(false);

        this.providersStack = new Gtk.Stack({
            hexpand: true,
            vexpand: true
        });

        const emptyBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            hexpand: true,
            vexpand: false,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });

        const emptyLabel = new Gtk.Label({
            label: this.t('AI_PROVIDER_NO_PROVIDERS', 'No providers configured'),
            halign: Gtk.Align.CENTER
        });
        emptyLabel.get_style_context().add_class('dim-label');
        emptyBox.pack_start(emptyLabel, false, false, 0);

        const addBtnEmpty = new Gtk.Button({
            label: this.t('AI_PROVIDER_ADD', 'Add Provider')
        });
        addBtnEmpty.get_style_context().add_class('suggested-action');
        addPointerCursor(addBtnEmpty);
        addBtnEmpty.connect('clicked', () => this.showAddProviderDialog());
        emptyBox.pack_start(addBtnEmpty, false, false, 0);

        this.providersStack.add_named(emptyBox, 'empty');

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 16,
            margin_start: 16,
            margin_end: 16,
            hexpand: true,
            vexpand: false
        });

        const headerRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const headerLabel = new Gtk.Label({
            label: this.t('AI_TAB_PROVIDERS', 'AI Providers'),
            halign: Gtk.Align.START,
            hexpand: true
        });
        headerLabel.get_style_context().add_class('ai-setting-label');
        headerRow.pack_start(headerLabel, true, true, 0);

        const addBtn = new Gtk.Button({
            label: this.t('AI_PROVIDER_ADD', 'Add Provider')
        });
        addBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(addBtn);
        addBtn.connect('clicked', () => this.showAddProviderDialog());
        headerRow.pack_end(addBtn, false, false, 0);

        listBox.pack_start(headerRow, false, false, 0);

        const sep = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        listBox.pack_start(sep, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true,
            min_content_height: 200
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        this.providersListBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            hexpand: true
        });
        this.providersListBox.get_style_context().add_class('ai-providers-list');

        scrolled.add(this.providersListBox);
        listBox.pack_start(scrolled, true, true, 0);

        this.providersStack.add_named(listBox, 'list');

        this.refreshProvidersList();

        tabScrolled.add(this.providersStack);
        return tabScrolled;
    }

    refreshProvidersList() {
        if (!this.providersListBox || !this.providersStack) return;

        this.providersListBox.foreach(child => this.providersListBox.remove(child));

        const providers = this.controller?.getProviders?.() || [];

        if (providers.length === 0) {
            this.providersStack.set_visible_child_name('empty');
        } else {
            this.providersStack.set_visible_child_name('list');
            providers.forEach(provider => {
                const row = this.createProviderRow(provider);
                this.providersListBox.add(row);
            });
            this.providersListBox.show_all();
        }

        this.updateAIProviderDropdown();
    }

    createProviderRow(provider) {
        const activeProviderId = this.controller?.getActiveProviderId?.();
        const isActive = provider.id === activeProviderId;

        const row = new Gtk.ListBoxRow({
            activatable: false,
            selectable: false
        });

        const rowBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        const activeCheck = new Gtk.CheckButton({
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });
        activeCheck.set_active(isActive);
        activeCheck.set_tooltip_text(isActive
            ? this.t('AI_PROVIDER_ACTIVE', 'Active provider')
            : this.t('AI_PROVIDER_SELECT', 'Click to select as active')
        );
        addPointerCursor(activeCheck);

        activeCheck.connect('toggled', () => {
            if (activeCheck.get_active()) {
                this.controller?.onSettingChanged?.('aiProvider', provider.id);
                this.refreshProvidersList();
            } else {
                activeCheck.set_active(true);
            }
        });
        rowBox.pack_start(activeCheck, false, false, 0);

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true
        });

        const nameLabel = new Gtk.Label({
            label: provider.name || 'Unnamed',
            halign: Gtk.Align.START
        });
        nameLabel.get_style_context().add_class('ai-setting-label');
        if (isActive) {
            nameLabel.get_style_context().add_class('accent');
        }
        infoBox.pack_start(nameLabel, false, false, 0);

        const protocolNames = {
            'openai_compat_chat_completions': this.t('AI_PROVIDER_PROTOCOL_OPENAI', 'OpenAI Compatible'),
            'anthropic_messages': this.t('AI_PROVIDER_PROTOCOL_ANTHROPIC', 'Anthropic'),
            'ollama_generate': this.t('AI_PROVIDER_PROTOCOL_OLLAMA', 'Ollama'),
            'custom_http': this.t('AI_PROVIDER_PROTOCOL_CUSTOM', 'Custom HTTP')
        };
        const protocolName = protocolNames[provider.protocol?.kind] || this.t('UNKNOWN', 'Unknown');
        const typeLabel = new Gtk.Label({
            label: protocolName,
            halign: Gtk.Align.START
        });
        typeLabel.get_style_context().add_class('dim-label');
        infoBox.pack_start(typeLabel, false, false, 0);

        rowBox.pack_start(infoBox, true, true, 0);

        const testBtn = new Gtk.Button({
            label: this.t('AI_PROVIDER_TEST', 'Test')
        });
        addPointerCursor(testBtn);
        testBtn.connect('clicked', () => this.testProvider(provider.id, testBtn));
        rowBox.pack_start(testBtn, false, false, 0);

        const logsBtn = new Gtk.Button();
        logsBtn.set_image(new Gtk.Image({
            icon_name: 'document-open-recent-symbolic',
            icon_size: Gtk.IconSize.BUTTON
        }));
        logsBtn.set_tooltip_text(this.t('AI_PROVIDER_LOGS', 'View Logs'));
        addPointerCursor(logsBtn);
        logsBtn.connect('clicked', () => this.showProviderLogsDialog(provider));
        rowBox.pack_start(logsBtn, false, false, 0);

        const editBtn = new Gtk.Button();
        editBtn.set_image(new Gtk.Image({
            icon_name: 'document-edit-symbolic',
            icon_size: Gtk.IconSize.BUTTON
        }));
        editBtn.set_tooltip_text(this.t('AI_PROVIDER_EDIT', 'Edit'));
        addPointerCursor(editBtn);
        editBtn.connect('clicked', () => this.showEditProviderDialog(provider));
        rowBox.pack_start(editBtn, false, false, 0);

        const deleteBtn = new Gtk.Button();
        deleteBtn.set_image(new Gtk.Image({
            icon_name: 'user-trash-symbolic',
            icon_size: Gtk.IconSize.BUTTON
        }));
        deleteBtn.set_tooltip_text(this.t('AI_PROVIDER_DELETE', 'Delete'));
        deleteBtn.get_style_context().add_class('destructive-action');
        addPointerCursor(deleteBtn);
        deleteBtn.connect('clicked', () => this.deleteProvider(provider.id));
        rowBox.pack_start(deleteBtn, false, false, 0);

        row.add(rowBox);
        return row;
    }

    showAddProviderDialog() {
        this.showProviderDialog(null);
    }

    showEditProviderDialog(provider) {
        this.showProviderDialog(provider);
    }

    showProviderDialog(existingProvider) {
        const isEdit = !!existingProvider;
        const parentWindow = this.rootWidget?.get_toplevel?.();

        const dialog = new Gtk.Dialog({
            title: isEdit
                ? this.t('AI_PROVIDER_EDIT_TITLE', 'Edit Provider')
                : this.t('AI_PROVIDER_ADD', 'Add Provider'),
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(450, -1);
        const cancelBtn1 = dialog.add_button(this.t('CANCEL', 'Cancel'), Gtk.ResponseType.CANCEL);
        const saveBtn1 = dialog.add_button(this.t('AI_PROVIDER_SAVE', 'Save'), Gtk.ResponseType.OK);
        addPointerCursor(cancelBtn1);
        addPointerCursor(saveBtn1);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(12);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        const nameRow = this.createDialogEntry(
            this.t('AI_PROVIDER_NAME', 'Provider Name'),
            existingProvider?.name || ''
        );
        contentArea.pack_start(nameRow.box, false, false, 0);

        const protocolRow = this.createDialogCombo(
            this.t('AI_PROVIDER_PROTOCOL', 'Protocol'),
            [
                ['openai_compat_chat_completions', this.t('AI_PROVIDER_PROTOCOL_OPENAI', 'OpenAI Compatible')],
                ['anthropic_messages', this.t('AI_PROVIDER_PROTOCOL_ANTHROPIC', 'Anthropic Messages API')],
                ['ollama_generate', this.t('AI_PROVIDER_PROTOCOL_OLLAMA', 'Ollama (Generate)')],
                ['custom_http', this.t('AI_PROVIDER_PROTOCOL_CUSTOM', 'Custom HTTP')]
            ],
            existingProvider?.protocol?.kind || 'openai_compat_chat_completions'
        );
        contentArea.pack_start(protocolRow.box, false, false, 0);

        const urlRow = this.createDialogEntry(
            this.t('AI_PROVIDER_API_URL', 'API URL'),
            existingProvider?.baseUrl || ''
        );
        contentArea.pack_start(urlRow.box, false, false, 0);

        const apiKeyRow = this.createDialogEntry(
            this.t('AI_PROVIDER_API_KEY', 'API Key'),
            existingProvider?.apiKey || '',
            true
        );
        contentArea.pack_start(apiKeyRow.box, false, false, 0);

        const modelRow = this.createDialogEntry(
            this.t('AI_PROVIDER_MODEL', 'Model'),
            existingProvider?.model || ''
        );
        contentArea.pack_start(modelRow.box, false, false, 0);

        const portRow = this.createDialogEntry(
            this.t('AI_PROVIDER_LOCAL_PORT', 'Local Port'),
            String(existingProvider?.localPort || 11434)
        );
        contentArea.pack_start(portRow.box, false, false, 0);

        const headersRow = this.createDialogTextArea(
            this.t('AI_PROVIDER_HEADERS', 'Headers (JSON)'),
            existingProvider?.customHeaders || '{"Content-Type": "application/json"}',
            3
        );
        contentArea.pack_start(headersRow.box, false, false, 0);

        const bodyTemplateRow = this.createDialogTextArea(
            this.t('AI_PROVIDER_BODY_TEMPLATE', 'Body Template'),
            existingProvider?.customBodyTemplate || '{\n  "prompt": "{{prompt}}",\n  "model": "{{model}}"\n}',
            5
        );
        const bodyHint = new Gtk.Label({
            label: this.t('AI_PROVIDER_BODY_TEMPLATE_HINT', 'Use {{prompt}}, {{model}}, {{maxTokens}}, {{imagePngBase64}}'),
            halign: Gtk.Align.START
        });
        bodyHint.get_style_context().add_class('dim-label');
        bodyTemplateRow.box.pack_start(bodyHint, false, false, 0);
        contentArea.pack_start(bodyTemplateRow.box, false, false, 0);

        const responsePathRow = this.createDialogEntry(
            this.t('AI_PROVIDER_RESPONSE_PATH', 'Response Path'),
            existingProvider?.customResponsePath || 'response'
        );
        const pathHint = new Gtk.Label({
            label: this.t('AI_PROVIDER_RESPONSE_PATH_HINT', 'e.g. choices.0.message.content'),
            halign: Gtk.Align.START
        });
        pathHint.get_style_context().add_class('dim-label');
        responsePathRow.box.pack_start(pathHint, false, false, 0);
        contentArea.pack_start(responsePathRow.box, false, false, 0);

        const protocolDefaults = {
            'openai_compat_chat_completions': {
                url: 'https://api.openai.com/v1',
                model: 'gpt-4o-mini',
                name: 'OpenAI'
            },
            'anthropic_messages': {
                url: 'https://api.anthropic.com/v1',
                model: 'claude-3-haiku-20240307',
                name: 'Anthropic'
            },
            'ollama_generate': {
                url: 'http://localhost:11434',
                model: 'llava',
                name: 'Ollama Local'
            },
            'custom_http': {
                url: '',
                model: '',
                name: 'Custom Provider'
            }
        };

        const updateFieldVisibility = (autoFill = false) => {
            const protocol = protocolRow.combo.get_active_id();
            const isOllama = protocol === 'ollama_generate';
            const isCustom = protocol === 'custom_http';
            const needsApiKey = protocol === 'openai_compat_chat_completions' || protocol === 'anthropic_messages';

            apiKeyRow.box.set_visible(needsApiKey || isCustom);
            portRow.box.set_visible(isOllama);
            headersRow.box.set_visible(isCustom);
            bodyTemplateRow.box.set_visible(isCustom);
            responsePathRow.box.set_visible(isCustom);

            if (autoFill && !isEdit && protocolDefaults[protocol]) {
                const defaults = protocolDefaults[protocol];
                const currentUrl = urlRow.entry.get_text();
                const currentModel = modelRow.entry.get_text();
                const currentName = nameRow.entry.get_text();

                const isUrlDefault = Object.values(protocolDefaults).some(d => d.url === currentUrl) || !currentUrl;
                const isModelDefault = Object.values(protocolDefaults).some(d => d.model === currentModel) || !currentModel;
                const isNameDefault = Object.values(protocolDefaults).some(d => d.name === currentName) || !currentName;

                if (isUrlDefault) urlRow.entry.set_text(defaults.url);
                if (isModelDefault) modelRow.entry.set_text(defaults.model);
                if (isNameDefault) nameRow.entry.set_text(defaults.name);
            }
        };

        protocolRow.combo.connect('changed', () => updateFieldVisibility(true));

        if (!isEdit) {
            updateFieldVisibility(true);
        } else {
            updateFieldVisibility(false);
        }

        dialog.show_all();
        updateFieldVisibility(false);

        dialog.connect('response', (dlg, responseId) => {
            if (responseId === Gtk.ResponseType.OK) {
                const protocol = protocolRow.combo.get_active_id();
                const config = {
                    name: nameRow.entry.get_text(),
                    type: protocol === 'ollama_generate' ? 'local' : 'api',
                    protocol: { kind: protocol },
                    baseUrl: urlRow.entry.get_text(),
                    apiKey: apiKeyRow.entry.get_text(),
                    model: modelRow.entry.get_text(),
                    localPort: parseInt(portRow.entry.get_text()) || 11434,
                    customHeaders: headersRow.textView.get_buffer().get_text(
                        headersRow.textView.get_buffer().get_start_iter(),
                        headersRow.textView.get_buffer().get_end_iter(),
                        false
                    ),
                    customBodyTemplate: bodyTemplateRow.textView.get_buffer().get_text(
                        bodyTemplateRow.textView.get_buffer().get_start_iter(),
                        bodyTemplateRow.textView.get_buffer().get_end_iter(),
                        false
                    ),
                    customResponsePath: responsePathRow.entry.get_text()
                };

                if (isEdit) {
                    this.controller?.updateProvider?.(existingProvider.id, config);
                } else {
                    this.controller?.addProvider?.(config);
                }

                this.refreshProvidersList();
            }

            dlg.destroy();
        });
    }

    showChangeDetectionSettingsDialog() {
        const parentWindow = this.rootWidget?.get_toplevel?.();
        const settings = this.controller?.getSettings?.() || {};

        const dialog = new Gtk.Dialog({
            title: this.t('AI_CHANGE_DETECTION_SETTINGS', 'Change Detection Settings'),
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(420, -1);
        const cancelBtn2 = dialog.add_button(this.t('CANCEL', 'Cancel'), Gtk.ResponseType.CANCEL);
        const saveBtn = dialog.add_button(this.t('AI_PROVIDER_SAVE', 'Save'), Gtk.ResponseType.OK);
        saveBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(cancelBtn2);
        addPointerCursor(saveBtn);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(16);
        contentArea.set_margin_top(16);
        contentArea.set_margin_bottom(16);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        const descLabel = new Gtk.Label({
            label: this.t('AI_CHANGE_DETECTION_DESC', 'Fine-tune how screen changes are detected and captured'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        descLabel.get_style_context().add_class('dim-label');
        contentArea.pack_start(descLabel, false, false, 0);

        const modeBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });

        const noneRadio = new Gtk.RadioButton({
            label: this.t('AI_CHANGE_MODE_NONE', 'None (capture immediately)')
        });

        const delayRadio = new Gtk.RadioButton({
            label: this.t('AI_CHANGE_MODE_DELAY', 'Capture delay'),
            group: noneRadio
        });
        const delayBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_start: 24
        });
        const delayDesc = new Gtk.Label({
            label: this.t('AI_CHANGE_DELAY_DESC', 'Wait after first change (ms):'),
            halign: Gtk.Align.START
        });
        delayDesc.get_style_context().add_class('dim-label');
        const delaySpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 5000,
                step_increment: 100
            }),
            digits: 0,
            width_chars: 6
        });
        delaySpin.set_value(settings.captureDelay ?? 500);
        delayBox.pack_start(delayDesc, false, false, 0);
        delayBox.pack_start(delaySpin, false, false, 0);

        const delayHint = new Gtk.Label({
            label: this.t('AI_CHANGE_DELAY_HINT', 'Useful if there are state transitions that should be skipped, such as program or game level loading.'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            margin_start: 24,
            max_width_chars: 38
        });
        delayHint.get_style_context().add_class('dim-label');

        modeBox.pack_start(noneRadio, false, false, 0);
        modeBox.pack_start(delayRadio, false, false, 0);
        modeBox.pack_start(delayBox, false, false, 0);
        modeBox.pack_start(delayHint, false, false, 0);

        contentArea.pack_start(modeBox, false, false, 0);

        const noiseBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8
        });
        const noiseLabel = new Gtk.Label({
            label: this.t('AI_NOISE_TOLERANCE', 'Noise tolerance (consecutive frames):'),
            halign: Gtk.Align.START
        });
        const noiseSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 10,
                step_increment: 1
            }),
            digits: 0,
            width_chars: 4
        });
        noiseSpin.set_value(settings.requiredConsecutiveFrames ?? 1);
        noiseBox.pack_start(noiseLabel, false, false, 0);
        noiseBox.pack_start(noiseSpin, false, false, 0);
        contentArea.pack_start(noiseBox, false, false, 0);

        const noiseHint = new Gtk.Label({
            label: this.t('AI_NOISE_TOLERANCE_HINT', 'Require N consecutive frames above threshold before triggering. Higher values filter out brief flickers but increase reaction time.'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            margin_start: 0,
            max_width_chars: 40
        });
        noiseHint.get_style_context().add_class('dim-label');
        contentArea.pack_start(noiseHint, false, false, 0);

        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        separator.set_margin_top(8);
        separator.set_margin_bottom(8);
        contentArea.pack_start(separator, false, false, 0);

        const ignoreFocusCheck = new Gtk.CheckButton({
            label: this.t('AI_IGNORE_FOCUS_CHANGE', 'Ignore window focus changes')
        });
        ignoreFocusCheck.set_active(settings.ignoreFocusChange === true);
        contentArea.pack_start(ignoreFocusCheck, false, false, 0);

        const focusHint = new Gtk.Label({
            label: this.t('AI_IGNORE_FOCUS_CHANGE_DESC', 'When enabled, critical changes that occur simultaneously with a window focus change will be ignored. Useful to prevent theme switching during window/app switches.'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            margin_start: 24,
            max_width_chars: 38
        });
        focusHint.get_style_context().add_class('dim-label');
        contentArea.pack_start(focusHint, false, false, 0);

        const advancedExpander = new Gtk.Expander({
            label: this.t('AI_ADVANCED_PARAMS', 'вљ™ Advanced Parameters'),
            expanded: false,
            margin_top: 12
        });

        const advancedBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_start: 8
        });

        const focusDelayRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        focusDelayRow.pack_start(new Gtk.Label({
            label: this.t('AI_FOCUS_CHECK_DELAY', 'Focus check delay (ms):'),
            halign: Gtk.Align.START
        }), false, false, 0);
        const focusDelaySpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({lower: 500, upper: 5000, step_increment: 100}),
            digits: 0, width_chars: 6
        });
        focusDelaySpin.set_value(settings.focusCheckDelayMs ?? 2000);
        focusDelayRow.pack_end(focusDelaySpin, false, false, 0);
        advancedBox.pack_start(focusDelayRow, false, false, 0);

        const cooldownRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        cooldownRow.pack_start(new Gtk.Label({
            label: this.t('AI_FOCUS_COOLDOWN', 'Focus cooldown (ms):'),
            halign: Gtk.Align.START
        }), false, false, 0);
        const cooldownSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({lower: 1000, upper: 30000, step_increment: 1000}),
            digits: 0, width_chars: 6
        });
        cooldownSpin.set_value(settings.focusCooldownMs ?? 10000);
        cooldownRow.pack_end(cooldownSpin, false, false, 0);
        advancedBox.pack_start(cooldownRow, false, false, 0);

        const areaRatioRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        areaRatioRow.pack_start(new Gtk.Label({
            label: this.t('AI_AREA_SIZE_RATIO', 'Window size ratio threshold (%):'),
            halign: Gtk.Align.START
        }), false, false, 0);
        const areaRatioSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({lower: 10, upper: 90, step_increment: 5}),
            digits: 0, width_chars: 4
        });
        areaRatioSpin.set_value(settings.areaSizeRatio ?? 50);
        areaRatioRow.pack_end(areaRatioSpin, false, false, 0);
        advancedBox.pack_start(areaRatioRow, false, false, 0);

        const stabilityRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        stabilityRow.pack_start(new Gtk.Label({
            label: this.t('AI_FOCUS_STABILITY_WINDOW', 'Focus stability window (ms):'),
            halign: Gtk.Align.START
        }), false, false, 0);
        const stabilitySpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({lower: 200, upper: 3000, step_increment: 100}),
            digits: 0, width_chars: 6
        });
        stabilitySpin.set_value(settings.focusStabilityWindowMs ?? 1000);
        stabilityRow.pack_end(stabilitySpin, false, false, 0);
        advancedBox.pack_start(stabilityRow, false, false, 0);

        const advancedHint = new Gtk.Label({
            label: this.t('AI_ADVANCED_PARAMS_HINT', 'These parameters fine-tune focus change detection. Adjust if default values don\'t work well for your use case.'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            max_width_chars: 38,
            margin_top: 4
        });
        advancedHint.get_style_context().add_class('dim-label');
        advancedBox.pack_start(advancedHint, false, false, 0);

        const ignoreSep = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        ignoreSep.set_margin_top(12);
        ignoreSep.set_margin_bottom(8);
        advancedBox.pack_start(ignoreSep, false, false, 0);

        const ignorePatternsLabel = new Gtk.Label({
            label: this.t('AI_IGNORE_PATTERNS', 'AI Ignore Patterns'),
            halign: Gtk.Align.START
        });
        ignorePatternsLabel.get_style_context().add_class('ai-setting-label');
        advancedBox.pack_start(ignorePatternsLabel, false, false, 0);

        const ignorePatternsHint = new Gtk.Label({
            label: this.t('AI_IGNORE_PATTERNS_HINT', 'Comma-separated patterns. If AI sees any of these, it will respond "ignore" and no theme change will occur.\nExample: loading screen, main menu, pause'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            max_width_chars: 38,
            margin_bottom: 4
        });
        ignorePatternsHint.get_style_context().add_class('dim-label');
        advancedBox.pack_start(ignorePatternsHint, false, false, 0);

        const ignorePatternsEntry = new Gtk.Entry({
            hexpand: true,
            placeholder_text: this.t('AI_IGNORE_PATTERNS_PLACEHOLDER', 'loading screen, main menu, pause...')
        });
        ignorePatternsEntry.set_text(settings.ignorePatterns || '');
        advancedBox.pack_start(ignorePatternsEntry, false, false, 0);

        const focusSep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
        focusSep.set_margin_top(12);
        focusSep.set_margin_bottom(8);
        advancedBox.pack_start(focusSep, false, false, 0);

        const focusPatternsLabel = new Gtk.Label({
            label: this.t('AI_FOCUS_PATTERNS', 'AI Focus Patterns'),
            halign: Gtk.Align.START
        });
        focusPatternsLabel.get_style_context().add_class('ai-setting-label');
        advancedBox.pack_start(focusPatternsLabel, false, false, 0);

        const focusPatternsHint = new Gtk.Label({
            label: this.t('AI_FOCUS_PATTERNS_HINT', 'Comma-separated patterns. AI will ONLY select a tag if it sees ANY of these. If none visible, it will skip.\nExample: gameplay, game scene'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            max_width_chars: 38,
            margin_bottom: 4
        });
        focusPatternsHint.get_style_context().add_class('dim-label');
        advancedBox.pack_start(focusPatternsHint, false, false, 0);

        const focusPatternsEntry = new Gtk.Entry({
            hexpand: true,
            placeholder_text: this.t('AI_FOCUS_PATTERNS_PLACEHOLDER', 'gameplay, game scene, in-game...')
        });
        focusPatternsEntry.set_text(settings.focusPatterns || '');
        advancedBox.pack_start(focusPatternsEntry, false, false, 0);

        const ignoreTagsSep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
        ignoreTagsSep.set_margin_top(12);
        ignoreTagsSep.set_margin_bottom(8);
        advancedBox.pack_start(ignoreTagsSep, false, false, 0);

        const ignoreIncomingTagsLabel = new Gtk.Label({
            label: this.t('AI_IGNORE_INCOMING_TAGS', 'Ignore Incoming Tags'),
            halign: Gtk.Align.START
        });
        ignoreIncomingTagsLabel.get_style_context().add_class('ai-setting-label');
        advancedBox.pack_start(ignoreIncomingTagsLabel, false, false, 0);

        const ignoreIncomingTagsHint = new Gtk.Label({
            label: this.t('AI_IGNORE_INCOMING_TAGS_HINT', 'Comma-separated tags. If AI selects any of these tags, we ignore it and no theme change occurs.\nExample: menu-gnome, childish, light'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            max_width_chars: 38,
            margin_bottom: 4
        });
        ignoreIncomingTagsHint.get_style_context().add_class('dim-label');
        advancedBox.pack_start(ignoreIncomingTagsHint, false, false, 0);

        const ignoreIncomingTagsEntry = new Gtk.Entry({
            hexpand: true,
            placeholder_text: this.t('AI_IGNORE_INCOMING_TAGS_PLACEHOLDER', 'menu-gnome, childish, light...')
        });
        ignoreIncomingTagsEntry.set_text(settings.ignoreIncomingTags || '');
        advancedBox.pack_start(ignoreIncomingTagsEntry, false, false, 0);

        advancedExpander.add(advancedBox);
        contentArea.pack_start(advancedExpander, false, false, 0);

        const updateSensitivity = () => {
            delaySpin.set_sensitive(delayRadio.get_active());
            delayDesc.set_sensitive(delayRadio.get_active());
            delayHint.set_sensitive(delayRadio.get_active());
        };

        noneRadio.connect('toggled', updateSensitivity);
        delayRadio.connect('toggled', updateSensitivity);

        const currentMode = settings.changeDetectionMode || 'none';
        if (currentMode === 'delay') {
            delayRadio.set_active(true);
        } else {
            noneRadio.set_active(true);
        }
        updateSensitivity();

        dialog.show_all();

        dialog.connect('response', (dlg, responseId) => {
            if (responseId === Gtk.ResponseType.OK) {
                let mode = 'none';
                if (delayRadio.get_active()) mode = 'delay';

                this.controller?.onSettingChanged?.('changeDetectionMode', mode);
                this.controller?.onSettingChanged?.('captureDelay', delaySpin.get_value_as_int());
                this.controller?.onSettingChanged?.('requiredConsecutiveFrames', noiseSpin.get_value_as_int());
                this.controller?.onSettingChanged?.('ignoreFocusChange', ignoreFocusCheck.get_active());
                this.controller?.onSettingChanged?.('focusCheckDelayMs', focusDelaySpin.get_value_as_int());
                this.controller?.onSettingChanged?.('focusCooldownMs', cooldownSpin.get_value_as_int());
                this.controller?.onSettingChanged?.('areaSizeRatio', areaRatioSpin.get_value_as_int());
                this.controller?.onSettingChanged?.('focusStabilityWindowMs', stabilitySpin.get_value_as_int());
                this.controller?.onSettingChanged?.('ignorePatterns', ignorePatternsEntry.get_text().trim());
                this.controller?.onSettingChanged?.('focusPatterns', focusPatternsEntry.get_text().trim());
                this.controller?.onSettingChanged?.('ignoreIncomingTags', ignoreIncomingTagsEntry.get_text().trim());
            }
            dlg.destroy();
        });
    }

    createDialogTextArea(label, defaultValue, rows = 3) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        const labelWidget = new Gtk.Label({
            label: label,
            halign: Gtk.Align.START
        });
        box.pack_start(labelWidget, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            min_content_height: rows * 20
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const textView = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            monospace: true
        });
        textView.get_buffer().set_text(defaultValue, -1);
        scrolled.add(textView);

        box.pack_start(scrolled, false, false, 0);

        return { box, textView };
    }

    createDialogEntry(label, defaultValue, isPassword = false) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        const labelWidget = new Gtk.Label({
            label: label,
            halign: Gtk.Align.START
        });
        box.pack_start(labelWidget, false, false, 0);

        const entry = new Gtk.Entry({
            text: defaultValue,
            hexpand: true,
            visibility: !isPassword
        });
        if (isPassword) {
            entry.set_input_purpose(Gtk.InputPurpose.PASSWORD);
        }
        box.pack_start(entry, false, false, 0);

        return { box, entry };
    }

    createDialogCombo(label, options, defaultId) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        const labelWidget = new Gtk.Label({
            label: label,
            halign: Gtk.Align.START
        });
        box.pack_start(labelWidget, false, false, 0);

        const combo = new Gtk.ComboBoxText({ hexpand: true });
        options.forEach(([id, text]) => combo.append(id, text));
        combo.set_active_id(defaultId);
        box.pack_start(combo, false, false, 0);

        return { box, combo };
    }

    testProvider(providerId, button) {
        const originalLabel = button.get_label();
        button.set_sensitive(false);
        button.set_label(this.t('AI_PROVIDER_TEST_RUNNING', 'Testing...'));

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            const syncResult = tryOrDefault(
                'AIDynamicEnvironmentView._testProvider.sync',
                () => this.controller?.testProviderSync?.(providerId),
                null
            );
            if (syncResult) {
                this.handleTestResult(button, originalLabel, syncResult, null);
                return GLib.SOURCE_REMOVE;
            }

            const promise = this.controller?.testProvider?.(providerId);
            if (promise && typeof promise.then === 'function') {
                promise.then(
                    (result) => this.handleTestResult(button, originalLabel, result, null),
                    (error) => this.handleTestResult(button, originalLabel, null, error?.message || 'Test failed')
                );
                return GLib.SOURCE_REMOVE;
            }

            this.handleTestResult(button, originalLabel, null, 'Test failed');
            return GLib.SOURCE_REMOVE;
        });
    }

    handleTestResult(button, originalLabel, result, errorMsg) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!button || button.is_destroyed?.()) {
                return GLib.SOURCE_REMOVE;
            }

            button.set_sensitive(true);
            if (result?.success) {
                button.set_label('вњ“');
                button.get_style_context().add_class('success');
            } else {
                button.set_label('вњ—');
                button.get_style_context().add_class('error');
                errorMsg = errorMsg || result?.message || 'Connection failed';
                button.set_tooltip_text(errorMsg);
            }

            const parentWindow = this.rootWidget?.get_toplevel?.();
            const isSuccess = result?.success === true;
            const title = isSuccess
                ? this.t('AI_PROVIDER_TEST_SUCCESS', 'Connection Successful')
                : this.t('AI_PROVIDER_TEST_FAILED', 'Connection Failed');
            const message = isSuccess
                ? `${result?.message || 'OK'}${result?.latency ? ` (${result.latency}ms)` : ''}`
                : errorMsg || 'Unknown error';

            const dialog = new Gtk.MessageDialog({
                transient_for: parentWindow,
                modal: true,
                message_type: isSuccess ? Gtk.MessageType.INFO : Gtk.MessageType.ERROR,
                buttons: Gtk.ButtonsType.OK,
                text: title,
                secondary_text: message
            });
            dialog.connect('response', () => dialog.destroy());
            dialog.show();

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                if (button && !button.is_destroyed?.()) {
                    button.set_label(originalLabel);
                    button.get_style_context().remove_class('success');
                    button.get_style_context().remove_class('error');
                    button.set_tooltip_text(this.t('AI_PROVIDER_TEST', 'Test'));
                }
                return GLib.SOURCE_REMOVE;
            });

            return GLib.SOURCE_REMOVE;
        });
    }

    showProviderLogsDialog(provider) {
        const parentWindow = this.rootWidget?.get_toplevel?.();
        const logs = this.controller?.getProviderLogs?.(provider.id) || [];
        const chatLogs = this.controller?.getChatLogs?.(provider.id) || [];

        const currentSettings = this.controller?.settingsService?.getAll?.() || {};
        const hidePrompts = currentSettings.ai_hide_prompts_in_dialogs !== false;

        const dialog = new Gtk.Dialog({
            title: `${provider.name} - ${this.t('AI_PROVIDER_LOGS_TITLE', 'Request Logs')}`,
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(700, 550);
        const clearLogsBtn = dialog.add_button(this.t('AI_PROVIDER_CLEAR_LOGS', 'Clear Logs'), Gtk.ResponseType.REJECT);
        const closeBtn3 = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(clearLogsBtn);
        addPointerCursor(closeBtn3);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(8);
        contentArea.set_margin_bottom(8);
        contentArea.set_margin_start(8);
        contentArea.set_margin_end(8);

        const notebook = new Gtk.Notebook({
            hexpand: true,
            vexpand: true
        });

        const logsScrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        logsScrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);

        const logsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        if (logs.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: this.t('AI_PROVIDER_NO_LOGS', 'No logs recorded yet'),
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            emptyLabel.get_style_context().add_class('dim-label');
            logsBox.pack_start(emptyLabel, true, true, 50);
        } else {
            [...logs].reverse().forEach((log, index) => {
                const logFrame = new Gtk.Frame({
                    label: `#${logs.length - index} - ${new Date(log.timestamp).toLocaleString()}`,
                    hexpand: true
                });
                logFrame.get_style_context().add_class('ai-log-frame');

                const logBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4,
                    margin_top: 6,
                    margin_bottom: 6,
                    margin_start: 8,
                    margin_end: 8
                });

                const isTestRequest = log.request?.type === 'test';
                const reqHeader = new Gtk.Label({
                    label: `<b>${this.t('AI_PROVIDER_LOG_REQUEST', 'Request')}:</b>`,
                    use_markup: true,
                    halign: Gtk.Align.START
                });
                logBox.pack_start(reqHeader, false, false, 0);

                if (isTestRequest) {
                    const testLabel = new Gtk.Label({
                        label: `[${this.t('AI_PROVIDER_TEST', 'Test Connection')}] ${log.request?.protocol || ''}`,
                        halign: Gtk.Align.START
                    });
                    testLabel.get_style_context().add_class('dim-label');
                    logBox.pack_start(testLabel, false, false, 0);
                } else {
                    if (!hidePrompts) {
                        const promptText = log.request?.prompt;
                        const promptLabel = new Gtk.Label({
                            label: promptText || this.t('AI_PROVIDER_NO_PROMPT', '(no prompt)'),
                            halign: Gtk.Align.START,
                            wrap: true,
                            wrap_mode: 2,
                            max_width_chars: 70,
                            selectable: true
                        });
                        promptLabel.get_style_context().add_class('ai-log-text');
                        logBox.pack_start(promptLabel, false, false, 0);
                    }

                    if (log.request?.model) {
                        const modelLabel = new Gtk.Label({
                            label: `Model: ${log.request.model}`,
                            halign: Gtk.Align.START
                        });
                        modelLabel.get_style_context().add_class('dim-label');
                        logBox.pack_start(modelLabel, false, false, 0);
                    }

                    if (log.request?.hasImage) {
                        const timestamp = log.timestamp;
                        const matchingChatLog = chatLogs.find(cl => cl.timestamp === timestamp);
                        const thumbnail = matchingChatLog?.imageThumbnail;

                        const imgButton = new Gtk.Button({
                            label: `рџ“· ${this.t('AI_PROVIDER_LOG_HAS_IMAGE', 'Image attached')}`,
                            halign: Gtk.Align.START
                        });
                        imgButton.get_style_context().add_class('flat');
                        imgButton.get_style_context().add_class('link');
                        imgButton.set_tooltip_text(this.t('AI_CHAT_VIEW_IMAGE', 'Click to view attached image'));
                        addPointerCursor(imgButton);
                        imgButton.connect('clicked', () => {
                            this.showImagePreviewDialog(thumbnail, dialog);
                        });
                        logBox.pack_start(imgButton, false, false, 0);
                    }
                }

                const respHeader = new Gtk.Label({
                    label: `<b>${this.t('AI_PROVIDER_LOG_RESPONSE', 'Response')}:</b> ${log.response?.success ? 'вњ“' : 'вњ—'} (${log.duration}ms)`,
                    use_markup: true,
                    halign: Gtk.Align.START
                });
                respHeader.set_margin_top(8);
                logBox.pack_start(respHeader, false, false, 0);

                const responseWidget = this.createProviderResponseWidget(log);
                responseWidget && logBox.pack_start(responseWidget, false, false, 0);

                logFrame.add(logBox);
                logsBox.pack_start(logFrame, false, false, 0);
            });
        }

        logsScrolled.add(logsBox);
        notebook.append_page(logsScrolled, wrapTabLabel(new Gtk.Label({ label: this.t('AI_PROVIDER_LOG_SUMMARY', 'Summary') })));

        const chatScrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        chatScrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);

        const chatBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8
        });

        if (chatLogs.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: this.t('AI_PROVIDER_NO_CHAT', 'No chat history yet'),
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            emptyLabel.get_style_context().add_class('dim-label');
            chatBox.pack_start(emptyLabel, true, true, 50);
        } else {
            [...chatLogs].reverse().forEach((entry, index) => {
                const timeLabel = new Gtk.Label({
                    label: `--- ${new Date(entry.timestamp).toLocaleString()} (${entry.duration}ms) ---`,
                    halign: Gtk.Align.CENTER
                });
                timeLabel.get_style_context().add_class('dim-label');
                chatBox.pack_start(timeLabel, false, false, 4);

                const userFrame = new Gtk.Frame({
                    hexpand: true
                });
                userFrame.get_style_context().add_class('ai-chat-user');

                const userBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4,
                    margin_top: 8,
                    margin_bottom: 8,
                    margin_start: 12,
                    margin_end: 12
                });

                const userHeader = new Gtk.Label({
                    label: `<b>рџ‘¤ ${this.t('AI_CHAT_USER', 'You')}:</b>`,
                    use_markup: true,
                    halign: Gtk.Align.START
                });
                userBox.pack_start(userHeader, false, false, 0);

                if (!hidePrompts) {
                    const promptLabel = new Gtk.Label({
                        label: entry.prompt || '(empty)',
                        halign: Gtk.Align.START,
                        wrap: true,
                        wrap_mode: 2,
                        max_width_chars: 80,
                        selectable: true
                    });
                    userBox.pack_start(promptLabel, false, false, 0);
                }

                if (entry.hasImage) {
                    const imgButton = new Gtk.Button({
                        label: `рџ“· ${this.t('AI_PROVIDER_LOG_HAS_IMAGE', 'Image attached')}`,
                        halign: Gtk.Align.START
                    });
                    imgButton.get_style_context().add_class('flat');
                    imgButton.get_style_context().add_class('link');
                    imgButton.set_tooltip_text(this.t('AI_CHAT_VIEW_IMAGE', 'Click to view attached image'));
                    addPointerCursor(imgButton);

                    const thumbnail = entry.imageThumbnail;
                    imgButton.connect('clicked', () => {
                        this.showImagePreviewDialog(thumbnail, dialog);
                    });

                    userBox.pack_start(imgButton, false, false, 4);
                }

                userFrame.add(userBox);
                chatBox.pack_start(userFrame, false, false, 0);

                const aiFrame = new Gtk.Frame({
                    hexpand: true
                });
                aiFrame.get_style_context().add_class(entry.success ? 'ai-chat-assistant' : 'ai-chat-error');

                const aiBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4,
                    margin_top: 8,
                    margin_bottom: 8,
                    margin_start: 12,
                    margin_end: 12
                });

                const aiHeader = new Gtk.Label({
                    label: `<b>рџ¤– ${this.t('AI_CHAT_ASSISTANT', 'AI')}:</b> ${entry.success ? 'вњ“' : 'вњ—'}`,
                    use_markup: true,
                    halign: Gtk.Align.START
                });
                aiBox.pack_start(aiHeader, false, false, 0);

                const responseLabel = new Gtk.Label({
                    label: entry.response || '(no response)',
                    halign: Gtk.Align.START,
                    wrap: true,
                    wrap_mode: 2,
                    max_width_chars: 80,
                    selectable: true
                });
                if (!entry.success) {
                    responseLabel.get_style_context().add_class('error');
                }
                aiBox.pack_start(responseLabel, false, false, 0);

                aiFrame.add(aiBox);
                chatBox.pack_start(aiFrame, false, false, 0);
            });
        }

        chatScrolled.add(chatBox);
        notebook.append_page(chatScrolled, wrapTabLabel(new Gtk.Label({ label: this.t('AI_PROVIDER_LOG_CHAT', 'Chat History') })));

        contentArea.pack_start(notebook, true, true, 0);
        dialog.show_all();

        dialog.connect('response', (dlg, responseId) => {
            if (responseId === Gtk.ResponseType.REJECT) {
                this.controller?.clearProviderLogs?.(provider.id);
                this.controller?.clearChatLogs?.(provider.id);
                dlg.destroy();
                this.showProviderLogsDialog(provider);
            } else {
                dlg.destroy();
            }
        });
    }

    showImagePreviewDialog(base64Image, parentWindow) {
        if (!base64Image) {
            this.showMessageDialog(
                parentWindow,
                Gtk.MessageType.INFO,
                this.t('AI_CHAT_NO_PREVIEW_TITLE', 'No Preview Available'),
                this.t('AI_CHAT_NO_PREVIEW_MSG', 'Image preview is not available for this entry. This may be an older log entry before thumbnails were saved.')
            );
            return;
        }

        const pixbuf = this.decodeBase64Pixbuf(base64Image);
        if (!pixbuf) {
            this.showMessageDialog(
                parentWindow,
                Gtk.MessageType.ERROR,
                this.t('AI_CHAT_PREVIEW_ERROR', 'Preview Error'),
                this.t('AI_CHAT_PREVIEW_ERROR_MSG', 'Failed to load image preview')
            );
            return;
        }

        const image = Gtk.Image.new_from_pixbuf(pixbuf);

        const dialog = new Gtk.Dialog({
            title: this.t('AI_CHAT_IMAGE_PREVIEW', 'Attached Screenshot'),
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(pixbuf.get_width() + 40, pixbuf.get_height() + 80);
        const filterService = this.controller?.pipelineFilterService || null;
        const addFilterBtn = filterService
            ? dialog.add_button(this.t('PIPELINE_FILTER_ADD_FROM_PREVIEW', 'Create filter pattern'), Gtk.ResponseType.APPLY)
            : null;
        const closeButton = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addFilterBtn && addPointerCursor(addFilterBtn);
        addPointerCursor(closeButton);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(12);
        contentArea.set_margin_bottom(12);
        contentArea.set_margin_start(12);
        contentArea.set_margin_end(12);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        scrolled.add(image);
        contentArea.pack_start(scrolled, true, true, 0);

        const sizeLabel = new Gtk.Label({
                label: `${pixbuf.get_width()} Г— ${pixbuf.get_height()} px`,
            halign: Gtk.Align.CENTER
        });
        sizeLabel.get_style_context().add_class('dim-label');
        contentArea.pack_start(sizeLabel, false, false, 0);

        const actionArea = dialog.get_action_area?.();
        const addedLabel = new Gtk.Label({
                label: `вњ“ ${this.t('PIPELINE_FILTER_ADDED', 'Added to Filter')}`,
            halign: Gtk.Align.START
        });
        addedLabel.get_style_context().add_class('success-label');
        addedLabel.set_no_show_all(true);
        actionArea?.pack_start?.(addedLabel, false, false, 0);

        this.syncPipelineFilterBadge(filterService, pixbuf, addFilterBtn, addedLabel);

        dialog.show_all();

        dialog.connect('response', (_dlg, responseId) => {
            if (responseId !== Gtk.ResponseType.APPLY) {
                dialog.destroy();
                return;
            }

            this.addPreviewToPipelineFilter(filterService, pixbuf, dialog, addFilterBtn, addedLabel);
        });
    }

    showPipelineLogImageDialog(base64Image, parentWindow) {
        if (!base64Image) return;

        const pixbuf = this.decodeBase64Pixbuf(base64Image);
        if (!pixbuf) return;

        const dialog = new Gtk.Dialog({
            title: this.t('AI_PIPELINE_LOG_IMAGE', 'Pipeline Screenshot'),
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true
        });
        dialog.set_default_size(pixbuf.get_width() + 40, pixbuf.get_height() + 80);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(8);
        contentArea.set_margin_bottom(8);
        contentArea.set_margin_start(8);
        contentArea.set_margin_end(8);

        const closeRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true
        });

        const filterService = this.controller?.pipelineFilterService || null;
        const addFilterBtn = filterService ? new Gtk.Button({
            label: this.t('PIPELINE_FILTER_ADD_FROM_PREVIEW', 'Create filter pattern')
        }) : null;
        addFilterBtn?.get_style_context?.().add_class('suggested-action');
        addFilterBtn && addPointerCursor(addFilterBtn);

        const addedLabel = new Gtk.Label({
                label: `вњ“ ${this.t('PIPELINE_FILTER_ADDED', 'Added to Filter')}`,
            halign: Gtk.Align.START
        });
        addedLabel.get_style_context().add_class('success-label');
        addedLabel.set_no_show_all(true);

        const closeBtn = new Gtk.Button({
            image: new Gtk.Image({ icon_name: 'window-close-symbolic', pixel_size: 16 }),
            relief: Gtk.ReliefStyle.NONE
        });
        closeBtn.get_style_context().add_class('flat');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => dialog.destroy());
        const closeSpacer = new Gtk.Box({ hexpand: true });
        addFilterBtn && closeRow.pack_start(addFilterBtn, false, false, 0);
        closeRow.pack_start(addedLabel, false, false, 10);
        closeRow.pack_start(closeSpacer, true, true, 0);
        closeRow.pack_end(closeBtn, false, false, 0);
        contentArea.pack_start(closeRow, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        scrolled.add(Gtk.Image.new_from_pixbuf(pixbuf));
        contentArea.pack_start(scrolled, true, true, 0);

        this.syncPipelineFilterBadge(filterService, pixbuf, addFilterBtn, addedLabel);
        addFilterBtn?.connect?.('clicked', () => {
            this.addPreviewToPipelineFilter(filterService, pixbuf, dialog, addFilterBtn, addedLabel);
        });
        dialog.show_all();
    }

    refreshPipelineLogDialogIfVisible() {
        if (!this._pipelineLogListBox) return;
        this.refreshPipelineLogDialogContent();
    }

    onPipelineLogAdded() {
        this.refreshPipelineLogDialogIfVisible();
    }

    onPipelineLogUpdated() {
        this.refreshPipelineLogDialogIfVisible();
    }

    pipelineLogImageKey(base64) {
        if (!base64 || typeof base64 !== 'string') return null;
        const head = base64.slice(0, 96);
        return `${base64.length}:${head}`;
    }

    groupPipelineLogsByImage(logs) {
        const groups = [];
        const map = new Map();
        const ordered = [...(logs || [])];

        for (const entry of ordered) {
            const imageKey = entry?.imageBase64 ? this.pipelineLogImageKey(entry.imageBase64) : null;
            const key = imageKey || `id:${entry?.id || entry?.timestamp || Math.random().toString(36).slice(2)}`;

            let group = map.get(key);
            if (!group) {
                group = {
                    key,
                    imageBase64: entry?.imageBase64 || null,
                    previewBase64: entry?.previewBase64 || null,
                    previewLabel: entry?.previewLabel || null,
                    entries: [],
                    lastTimestamp: entry?.timestamp || null
                };
                map.set(key, group);
                groups.push(group);
            }

            group.entries.push(entry);
            group.lastTimestamp = entry?.timestamp || group.lastTimestamp;
            if (entry?.imageBase64) group.imageBase64 = entry.imageBase64;
            if (entry?.previewBase64) group.previewBase64 = entry.previewBase64;
            if (entry?.previewLabel) group.previewLabel = entry.previewLabel;
        }

        groups.sort((a, b) => String(a.lastTimestamp || '').localeCompare(String(b.lastTimestamp || '')));
        return groups;
    }

    refreshPipelineLogDialogContent(logs = null) {
        if (!this._pipelineLogListBox) return;
        const listBox = this._pipelineLogListBox;
        const dialog = this._pipelineLogDialog;
        const nextLogs = logs || this.controller?.getPipelineLogs?.() || [];

        for (const child of listBox.get_children?.() || []) {
            if (child?._progressTimerId) {
                GLib.source_remove(child._progressTimerId);
                child._progressTimerId = null;
            }
        }

        (listBox.get_children?.() || []).forEach(child => listBox.remove(child));
        this._pipelineLogEmptyLabel = null;

        if (nextLogs.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: this.t('AI_PIPELINE_LOG_EMPTY', 'No pipeline events yet'),
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER
            });
            emptyLabel.get_style_context().add_class('dim-label');
            listBox.pack_start(emptyLabel, true, true, 50);
            this._pipelineLogEmptyLabel = emptyLabel;
            listBox.show_all();
            return;
        }

        const groups = this.groupPipelineLogsByImage(nextLogs);
        for (const group of groups) {
            const row = this.buildPipelineLogGroupRow(group, dialog);
            listBox.pack_start(row, false, false, 0);
        }
        listBox.show_all();
        this.scrollPipelineLogToBottom();
    }

    applyPipelineLogStyle(label, entry) {
        if (!label) return;
        const ctx = label.get_style_context();
        ctx.remove_class('success-label');
        ctx.remove_class('warning-label');
        ctx.remove_class('error');
        ctx.remove_class('dim-label');

        if (entry.type === 'change') {
            if (entry.status === 'already_applied') {
                ctx.add_class('info-label');
            } else {
                ctx.add_class('success-label');
            }
            return;
        }

        if (entry.type === 'filter' && entry.status === 'filtered') {
            ctx.add_class('warning-label');
            return;
        }

        if (entry.type === 'ml' && entry.status === 'error') {
            ctx.add_class('error');
        }
    }

    buildPipelineLogRow(entry, dialog) {
        const frame = new Gtk.Frame({
            label: `${new Date(entry.timestamp).toLocaleString()}`
        });
        frame.get_style_context().add_class('ai-log-frame');

        const row = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 8,
            margin_end: 8
        });

        const title = new Gtk.Label({
            label: entry.message || '',
            halign: Gtk.Align.START,
            wrap: true,
            wrap_mode: 2,
            max_width_chars: 46
        });

        this.applyPipelineLogStyle(title, entry);

        row.pack_start(title, false, false, 0);

        frame._titleLabel = title;
        frame._progressBar = null;
        frame._progressTimerId = null;
        frame._previewLabel = null;

        if (entry.type === 'ml' && entry.status === 'pending') {
            const progress = new Gtk.ProgressBar({ hexpand: true });
            progress.set_pulse_step(0.08);
            frame._progressBar = progress;
            row.pack_start(progress, false, false, 0);
            frame._progressTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
                if (!this._pipelineLogDialog || !frame._progressBar) return GLib.SOURCE_REMOVE;
                frame._progressBar.pulse();
                return GLib.SOURCE_CONTINUE;
            });
        }

        if (entry.previewBase64) {
            const pixbuf = this.decodeBase64Pixbuf(entry.previewBase64);
            if (pixbuf) {
                const imgBtn = new Gtk.Button({
                    relief: Gtk.ReliefStyle.NONE
                });
                imgBtn.get_style_context().add_class('flat');
                imgBtn.set_image(Gtk.Image.new_from_pixbuf(pixbuf));
                addPointerCursor(imgBtn);
                imgBtn.connect('clicked', () => {
                    this.showPipelineLogImageDialog(entry.imageBase64, dialog);
                });
                const previewRow = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8
                });
                previewRow.pack_start(imgBtn, false, false, 0);
                const previewLabel = new Gtk.Label({
                    label: entry.previewLabel || this.t('AI_PIPELINE_LOG_PREVIEW', 'Preview'),
                    halign: Gtk.Align.START,
                    wrap: true,
                    wrap_mode: 2,
                    max_width_chars: 34
                });
                previewLabel.get_style_context().add_class('dim-label');
                frame._previewLabel = previewLabel;
                previewRow.pack_start(previewLabel, true, true, 0);
                row.pack_start(previewRow, false, false, 0);
            }
        }

        frame.add(row);
        return frame;
    }

    buildPipelineLogGroupRow(group, dialog) {
        const entries = group?.entries || [];
        const sortedEntries = [...entries].sort((a, b) => String(a?.timestamp || '').localeCompare(String(b?.timestamp || '')));
        const last = sortedEntries[sortedEntries.length - 1] || null;
        const labelTime = last?.timestamp ? new Date(last.timestamp).toLocaleString() : '';
        const countSuffix = group?.entries?.length > 1 ? ` (${group.entries.length})` : '';
        const frame = new Gtk.Frame({ label: `${labelTime}${countSuffix}` });
        frame.get_style_context().add_class('ai-log-frame');

        const container = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 10,
            margin_end: 10
        });

        const overlay = new Gtk.Overlay();
        overlay.add(container);

        const moreBtn = new Gtk.Button({
            relief: Gtk.ReliefStyle.NONE
        });
        moreBtn.get_style_context().add_class('flat');
        moreBtn.set_image(new Gtk.Image({
            icon_name: 'open-menu-symbolic',
            icon_size: Gtk.IconSize.MENU
        }));
        moreBtn.set_tooltip_text(this.t('AI_PIPELINE_LOG_DETAILS', 'Details'));
        addPointerCursor(moreBtn);
        moreBtn.set_halign(Gtk.Align.END);
        moreBtn.set_valign(Gtk.Align.START);
        moreBtn.set_margin_top(0);
        moreBtn.set_margin_end(0);
        moreBtn.connect('clicked', () => this.showPipelineLogGroupDetailsDialog(group, dialog));
        overlay.add_overlay(moreBtn);

        if (group?.previewBase64) {
            const pixbuf = this.decodeBase64Pixbuf(group.previewBase64);
            if (pixbuf) {
                const imgBtn = new Gtk.Button({ relief: Gtk.ReliefStyle.NONE });
                imgBtn.get_style_context().add_class('flat');
                imgBtn.set_image(Gtk.Image.new_from_pixbuf(pixbuf));
                addPointerCursor(imgBtn);
                if (group.imageBase64) {
                    imgBtn.connect('clicked', () => this.showPipelineLogImageDialog(group.imageBase64, dialog));
                }
                container.pack_start(imgBtn, false, false, 0);
            }
        }

        const eventsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            hexpand: true
        });

        for (const entry of sortedEntries) {
            const time = entry?.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
            const prefix = time ? `[${time}] ` : '';
            const label = new Gtk.Label({
                label: `${prefix}${entry?.message || ''}`,
                halign: Gtk.Align.START,
                wrap: true,
                wrap_mode: 2,
                xalign: 0,
                max_width_chars: 44
            });
            this.applyPipelineLogStyle(label, entry);
            eventsBox.pack_start(label, false, false, 0);
        }

        const hasPending = sortedEntries.some(e => e?.type === 'ml' && e?.status === 'pending');
        if (hasPending) {
            const progress = new Gtk.ProgressBar({ hexpand: true });
            progress.set_pulse_step(0.08);
            frame._progressBar = progress;
            eventsBox.pack_start(progress, false, false, 0);
            frame._progressTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
                if (!this._pipelineLogDialog || !frame._progressBar) return GLib.SOURCE_REMOVE;
                frame._progressBar.pulse();
                return GLib.SOURCE_CONTINUE;
            });
        } else {
            frame._progressBar = null;
            frame._progressTimerId = null;
        }

        container.pack_start(eventsBox, true, true, 0);
        frame.add(overlay);
        return frame;
    }

    showPipelineLogGroupDetailsDialog(group, parentWindow) {
        const dialog = new Gtk.Dialog({
            title: this.t('AI_PIPELINE_LOG_DETAILS_TITLE', 'Pipeline Details'),
            transient_for: parentWindow,
            modal: true,
            destroy_with_parent: true
        });

        dialog.set_default_size(520, 520);
        const closeBtn = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(10);
        contentArea.set_margin_top(12);
        contentArea.set_margin_bottom(12);
        contentArea.set_margin_start(12);
        contentArea.set_margin_end(12);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });

        const settings = this.controller?.getSettings?.() || {};
        const triggerThreshold = settings.changeThreshold ?? 60;
        const requiredFrames = settings.requiredConsecutiveFrames ?? 1;
        const changePattern = settings.changePattern || 'more1';
        const captureMode = this.controller?.getCaptureMode?.() || (settings.allowedWindows === 'full_screen' ? 'full_screen' : 'active_window');
        const mode = settings.changeDetectionMode || 'none';
        const skipCount = settings.skipTransitions ?? 1;
        const delayMs = settings.captureDelay ?? 500;

        const principles = [
            `${this.t('AI_PIPELINE_TRIGGER_RULE', 'Trigger rule')}: change в‰Ґ ${triggerThreshold}%`,
            `${this.t('AI_PIPELINE_TRIGGER_FRAMES', 'Noise tolerance')}: ${requiredFrames} frame(s)`,
            `${this.t('AI_PIPELINE_TRIGGER_PATTERN', 'Algorithm')}: ${changePattern}`,
            `${this.t('AI_PIPELINE_TRIGGER_CAPTURE', 'Capture mode')}: ${captureMode}`,
            `${this.t('AI_PIPELINE_TRIGGER_MODE', 'Mode')}: ${mode}${mode === 'skip' ? ` (${skipCount})` : ''}${mode === 'delay' ? ` (${delayMs}ms)` : ''}`
        ].join('\n');

        const principlesLabel = new Gtk.Label({
            label: principles,
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        principlesLabel.get_style_context().add_class('dim-label');
        box.pack_start(principlesLabel, false, false, 0);

        const sep = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        sep.get_style_context().add_class('ai-section-divider');
        box.pack_start(sep, false, false, 0);

        const entries = group?.entries || [];
        const sortedEntries = [...entries].sort((a, b) => String(a?.timestamp || '').localeCompare(String(b?.timestamp || '')));
        for (const entry of sortedEntries) {
            const time = entry?.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
            const title = new Gtk.Label({
                label: `${time ? `[${time}] ` : ''}${entry?.message || ''}`,
                halign: Gtk.Align.START,
                wrap: true,
                wrap_mode: 2,
                xalign: 0
            });
            this.applyPipelineLogStyle(title, entry);
            box.pack_start(title, false, false, 0);

            const detailsLines = [];
            this.appendPipelineDetails(detailsLines, entry);

            if (detailsLines.length) {
                const detailsLabel = new Gtk.Label({
                    label: detailsLines.join('\n'),
                    halign: Gtk.Align.START,
                    wrap: true,
                    xalign: 0
                });
                detailsLabel.get_style_context().add_class('dim-label');
                detailsLabel.set_margin_start(14);
                box.pack_start(detailsLabel, false, false, 0);
            }
        }

        scrolled.add(box);
        contentArea.pack_start(scrolled, true, true, 0);

        dialog.show_all();
        dialog.connect('response', () => dialog.destroy());
    }

    showPipelineLogsDialog() {
        const logs = this.controller?.getPipelineLogs?.() || [];
        const parentWindow = this.window || this.rootWidget?.get_toplevel?.() || null;
        const dialog = new Gtk.Dialog({
            title: this.t('AI_PIPELINE_LOG_TITLE', 'Pipeline Logs'),
            modal: true,
            destroy_with_parent: true
        });
        if (parentWindow) {
            dialog.set_transient_for(parentWindow);
        }
        dialog.set_default_size(420, 520);

        const closeBtn = dialog.add_button(this.t('CLOSE', 'Close'), Gtk.ResponseType.CLOSE);
        addPointerCursor(closeBtn);

        const contentArea = dialog.get_content_area();
        contentArea.set_margin_top(8);
        contentArea.set_margin_bottom(8);
        contentArea.set_margin_start(8);
        contentArea.set_margin_end(8);

        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this._pipelineLogScrolled = scrolled;

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        this._pipelineLogDialog = dialog;
        this._pipelineLogListBox = listBox;
        this._pipelineLogEmptyLabel = null;
        this._pipelineLogRowMap = null;
        this.refreshPipelineLogDialogContent(logs);

        scrolled.add(listBox);
        contentArea.pack_start(scrolled, true, true, 0);

        dialog.show_all();
        this.scrollPipelineLogToBottom();
        dialog.connect('response', () => {
            for (const row of this._pipelineLogListBox?.get_children?.() || []) {
                if (row?._progressTimerId) {
                    GLib.source_remove(row._progressTimerId);
                }
            }
            this._pipelineLogDialog = null;
            this._pipelineLogListBox = null;
            this._pipelineLogEmptyLabel = null;
            this._pipelineLogRowMap = null;
            this._pipelineLogScrolled = null;
            dialog.destroy();
        });
    }

    scrollPipelineLogToBottom() {
        if (!this._pipelineLogScrolled) return;
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (!this._pipelineLogScrolled) return GLib.SOURCE_REMOVE;
            const adj = this._pipelineLogScrolled.get_vadjustment?.();
            if (!adj) return GLib.SOURCE_REMOVE;
            const max = Math.max(0, adj.get_upper() - adj.get_page_size());
            adj.set_value(max);
            return GLib.SOURCE_REMOVE;
        });
    }

    deleteProvider(providerId) {
        this.controller?.deleteProvider?.(providerId);
        this.refreshProvidersList();
    }

    updateAIProviderDropdown() {
        const combo = this.widgets['aiProvider'];
        if (!combo || !this.isWidgetValid(combo)) return;

        combo._isInitializing = true;

        combo.remove_all();

        const providers = this.controller?.getProviders?.() || [];
        const activeProviderId = this.controller?.getActiveProviderId?.();

        if (providers.length === 0) {
            combo.append('none', this.t('AI_PROVIDER_NO_ACTIVE', 'No active provider'));
            combo.set_active_id('none');
            combo.set_sensitive(false);
        } else {
            providers.forEach(p => combo.append(p.id, p.name));

            if (activeProviderId && providers.some(p => p.id === activeProviderId)) {
                combo.set_active_id(activeProviderId);
            } else {
                combo.prepend('none', this.t('AI_PROVIDER_SELECT_ACTIVE', 'Select an active AI provider'));
                combo.set_active_id('none');
            }
            combo.set_sensitive(true);
        }

        combo._isInitializing = false;
    }

    createAdvancedTab() {
        const scrolled = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_propagate_natural_height(false);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 24,
            margin_start: 8,
            margin_end: 8,
            hexpand: false,
            vexpand: false,
            valign: Gtk.Align.START
        });

        const screenshotsFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_SCREENSHOTS', 'Screenshots')
        });

        const screenshotsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const disableScreenshotsCheck = new Gtk.CheckButton({
            label: this.t('AI_DISABLE_SAVE_SCREENSHOTS', 'Disable saving screenshots')
        });

        const currentSettings = this.controller?.settingsService?.getAll?.() || {};
        disableScreenshotsCheck.set_active(currentSettings.ai_disable_save_screenshots === true);

        disableScreenshotsCheck.connect('toggled', () => {
            const isActive = disableScreenshotsCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_disable_save_screenshots', isActive);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        screenshotsBox.pack_start(disableScreenshotsCheck, false, false, 0);

        const screenshotsNote = new Gtk.Label({
            label: this.t('AI_DISABLE_SAVE_SCREENSHOTS_DESC', 'Screenshots are saved to display in AI provider chat logs. When disabled, log messages will still be available, but without image attachments.'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        screenshotsNote.get_style_context().add_class('dim-label');
        screenshotsBox.pack_start(screenshotsNote, false, false, 0);

        screenshotsFrame.add(screenshotsBox);
        box.pack_start(screenshotsFrame, false, false, 0);

        const pipelineFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_PIPELINE', 'Pipeline')
        });

        const pipelineBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const frameBufferingCheck = new Gtk.CheckButton({
            label: this.t('AI_ENABLE_FRAME_BUFFERING', 'Enable frame buffering')
        });

        frameBufferingCheck.set_active(currentSettings.ai_enable_frame_buffering === true);

        frameBufferingCheck.connect('toggled', () => {
            const isActive = frameBufferingCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_enable_frame_buffering', isActive);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        pipelineBox.pack_start(frameBufferingCheck, false, false, 0);

        const frameBufferingNote = new Gtk.Label({
            label: this.t('AI_ENABLE_FRAME_BUFFERING_DESC', 'When enabled, if a new critical change occurs while the AI is processing, the latest frame is buffered and processed after. Otherwise, frames arriving during AI processing are discarded.'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        frameBufferingNote.get_style_context().add_class('dim-label');
        pipelineBox.pack_start(frameBufferingNote, false, false, 0);

        pipelineFrame.add(pipelineBox);
        box.pack_start(pipelineFrame, false, false, 0);

        const samplingFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_SAMPLING', 'Sampling')
        });

        const samplingBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const sendTemperatureCheck = new Gtk.CheckButton({
            label: this.t('AI_SEND_TEMPERATURE', 'Send temperature')
        });
        sendTemperatureCheck.set_active(currentSettings.ai_send_temperature === true);

        const sendTemperatureNote = new Gtk.Label({
            label: this.t('AI_SEND_TEMPERATURE_DESC', 'When disabled, the temperature parameter is not sent and the provider default is used.'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        sendTemperatureNote.get_style_context().add_class('dim-label');

        samplingBox.pack_start(sendTemperatureCheck, false, false, 0);
        samplingBox.pack_start(sendTemperatureNote, false, false, 0);

        const temperatureRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const temperatureTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const temperatureLabel = new Gtk.Label({
            label: this.t('AI_TEMPERATURE', 'Temperature'),
            halign: Gtk.Align.START
        });
        temperatureLabel.get_style_context().add_class('ai-setting-label');
        temperatureTextBox.pack_start(temperatureLabel, false, false, 0);

        const temperatureDesc = new Gtk.Label({
            label: this.t('AI_TEMPERATURE_DESC', 'Lower values are more deterministic. Higher values are more creative.'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 35,
            xalign: 0
        });
        temperatureDesc.get_style_context().add_class('dim-label');
        temperatureTextBox.pack_start(temperatureDesc, false, false, 0);

        temperatureRow.pack_start(temperatureTextBox, true, true, 0);

        const initialTempRaw = currentSettings.ai_temperature;
        const initialTempNum = typeof initialTempRaw === 'number' ? initialTempRaw : Number(initialTempRaw);
        const initialTemp = Number.isFinite(initialTempNum) ? Math.max(0, Math.min(1, initialTempNum)) : 0.2;

        const temperatureValueLabel = new Gtk.Label({
            label: initialTemp.toFixed(2),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER
        });
        temperatureValueLabel.set_size_request(50, -1);

        const temperatureAdj = new Gtk.Adjustment({
            value: initialTemp,
            lower: 0,
            upper: 1,
            step_increment: 0.05,
            page_increment: 0.1
        });

        const temperatureScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: temperatureAdj,
            draw_value: false,
            hexpand: true,
            has_origin: true
        });
        temperatureScale.set_size_request(150, -1);
        temperatureScale.get_style_context().add_class('ai-threshold-scale');

        const syncTemperatureSensitivity = () => {
            const enabled = sendTemperatureCheck.get_active();
            temperatureScale.set_sensitive(enabled);
            temperatureValueLabel.set_sensitive(enabled);
            temperatureTextBox.set_sensitive(enabled);
        };

        temperatureScale.connect('value-changed', () => {
            const value = Math.max(0, Math.min(1, temperatureScale.get_value()));
            const rounded = Math.round(value * 100) / 100;
            temperatureValueLabel.set_label(rounded.toFixed(2));
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_temperature', rounded);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        sendTemperatureCheck.connect('toggled', () => {
            const enabled = sendTemperatureCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_send_temperature', enabled);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
            syncTemperatureSensitivity();
        });

        temperatureRow.pack_start(temperatureScale, true, true, 0);
        temperatureRow.pack_end(temperatureValueLabel, false, false, 0);
        samplingBox.pack_start(temperatureRow, false, false, 0);

        syncTemperatureSensitivity();

        const overrideMaxTokensCheck = new Gtk.CheckButton({
            label: this.t('AI_OVERRIDE_MAX_TOKENS', 'Override max tokens')
        });
        overrideMaxTokensCheck.set_active(currentSettings.ai_override_max_tokens === true);

        const overrideMaxTokensNote = new Gtk.Label({
            label: this.t('AI_OVERRIDE_MAX_TOKENS_DESC', 'When enabled, this value is sent to providers as max_tokens/num_predict (provider-specific).'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        overrideMaxTokensNote.get_style_context().add_class('dim-label');

        samplingBox.pack_start(overrideMaxTokensCheck, false, false, 0);
        samplingBox.pack_start(overrideMaxTokensNote, false, false, 0);

        const maxTokensRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const maxTokensTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const maxTokensLabel = new Gtk.Label({
            label: this.t('AI_MAX_TOKENS', 'Max tokens'),
            halign: Gtk.Align.START
        });
        maxTokensLabel.get_style_context().add_class('ai-setting-label');
        maxTokensTextBox.pack_start(maxTokensLabel, false, false, 0);

        const maxTokensDesc = new Gtk.Label({
            label: this.t('AI_MAX_TOKENS_DESC', 'Limits output length. Lower is faster, higher reduces truncation (some models need more).'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 35,
            xalign: 0
        });
        maxTokensDesc.get_style_context().add_class('dim-label');
        maxTokensTextBox.pack_start(maxTokensDesc, false, false, 0);

        maxTokensRow.pack_start(maxTokensTextBox, true, true, 0);

        const initialMaxTokensRaw = currentSettings.ai_max_tokens;
        const initialMaxTokensNum = typeof initialMaxTokensRaw === 'number' ? initialMaxTokensRaw : Number(initialMaxTokensRaw);
        const initialMaxTokens = Number.isFinite(initialMaxTokensNum) ? Math.max(16, Math.min(2048, Math.round(initialMaxTokensNum))) : 256;

        const maxTokensValueLabel = new Gtk.Label({
            label: String(initialMaxTokens),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER
        });
        maxTokensValueLabel.set_size_request(60, -1);

        const maxTokensAdj = new Gtk.Adjustment({
            value: initialMaxTokens,
            lower: 16,
            upper: 2048,
            step_increment: 16,
            page_increment: 128
        });

        const maxTokensScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: maxTokensAdj,
            draw_value: false,
            hexpand: true,
            has_origin: true
        });
        maxTokensScale.set_size_request(150, -1);
        maxTokensScale.get_style_context().add_class('ai-threshold-scale');

        const syncMaxTokensSensitivity = () => {
            const enabled = overrideMaxTokensCheck.get_active();
            maxTokensScale.set_sensitive(enabled);
            maxTokensValueLabel.set_sensitive(enabled);
            maxTokensTextBox.set_sensitive(enabled);
        };

        maxTokensScale.connect('value-changed', () => {
            const value = Math.max(16, Math.min(2048, Math.round(maxTokensScale.get_value())));
            maxTokensValueLabel.set_label(String(value));
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_max_tokens', value);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        overrideMaxTokensCheck.connect('toggled', () => {
            const enabled = overrideMaxTokensCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_override_max_tokens', enabled);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
            syncMaxTokensSensitivity();
        });

        maxTokensRow.pack_start(maxTokensScale, true, true, 0);
        maxTokensRow.pack_end(maxTokensValueLabel, false, false, 0);
        samplingBox.pack_start(maxTokensRow, false, false, 0);

        syncMaxTokensSensitivity();

        samplingFrame.add(samplingBox);
        box.pack_start(samplingFrame, false, false, 0);

        const imageOptFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_IMAGE_OPTIMIZATION', 'Image Optimization')
        });

        const imageOptBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const maxSideRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const maxSideTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const maxSideLabel = new Gtk.Label({
            label: this.t('AI_IMAGE_MAX_SIDE', 'Max side (px)'),
            halign: Gtk.Align.START
        });
        maxSideLabel.get_style_context().add_class('ai-setting-label');
        maxSideTextBox.pack_start(maxSideLabel, false, false, 0);

        const maxSideDesc = new Gtk.Label({
            label: this.t('AI_IMAGE_MAX_SIDE_DESC', 'Maximum width/height before resizing'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 30,
            xalign: 0
        });
        maxSideDesc.get_style_context().add_class('dim-label');
        maxSideTextBox.pack_start(maxSideDesc, false, false, 0);

        maxSideRow.pack_start(maxSideTextBox, true, true, 0);

        const maxSideAdj = new Gtk.Adjustment({
            value: currentSettings.ai_image_max_side ?? 1024,
            lower: 256,
            upper: 4096,
            step_increment: 64,
            page_increment: 256
        });

        const maxSideSpin = new Gtk.SpinButton({
            adjustment: maxSideAdj,
            climb_rate: 1,
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        maxSideSpin.set_size_request(100, -1);

        maxSideSpin.connect('value-changed', () => {
            const value = maxSideSpin.get_value_as_int();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_image_max_side', value);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        maxSideRow.pack_end(maxSideSpin, false, false, 0);
        imageOptBox.pack_start(maxSideRow, false, false, 0);

        const qualityRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const qualityTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            valign: Gtk.Align.CENTER
        });

        const qualityLabel = new Gtk.Label({
            label: this.t('AI_IMAGE_QUALITY', 'Quality'),
            halign: Gtk.Align.START
        });
        qualityLabel.get_style_context().add_class('ai-setting-label');
        qualityTextBox.pack_start(qualityLabel, false, false, 0);

        const qualityDesc = new Gtk.Label({
            label: this.t('AI_IMAGE_QUALITY_DESC', 'JPEG/WebP compression quality (1-100)'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 30,
            xalign: 0
        });
        qualityDesc.get_style_context().add_class('dim-label');
        qualityTextBox.pack_start(qualityDesc, false, false, 0);

        qualityRow.pack_start(qualityTextBox, false, false, 0);

        const qualityValueLabel = new Gtk.Label({
            label: `${currentSettings.ai_image_quality ?? 80}%`,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER
        });
        qualityValueLabel.set_size_request(50, -1);

        const qualityAdj = new Gtk.Adjustment({
            value: currentSettings.ai_image_quality ?? 80,
            lower: 10,
            upper: 100,
            step_increment: 5,
            page_increment: 10
        });

        const qualityScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: qualityAdj,
            draw_value: false,
            hexpand: true,
            has_origin: true
        });
        qualityScale.set_size_request(150, -1);
        qualityScale.get_style_context().add_class('ai-threshold-scale');

        qualityScale.connect('value-changed', () => {
            const value = Math.round(qualityScale.get_value());
            qualityValueLabel.set_label(`${value}%`);
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_image_quality', value);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        qualityRow.pack_start(qualityScale, true, true, 0);
        qualityRow.pack_end(qualityValueLabel, false, false, 0);
        imageOptBox.pack_start(qualityRow, false, false, 0);

        const formatRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const formatTextBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const formatLabel = new Gtk.Label({
            label: this.t('AI_IMAGE_FORMAT', 'Format'),
            halign: Gtk.Align.START
        });
        formatLabel.get_style_context().add_class('ai-setting-label');
        formatTextBox.pack_start(formatLabel, false, false, 0);

        const formatDesc = new Gtk.Label({
            label: this.t('AI_IMAGE_FORMAT_DESC', 'Preferred encoding format'),
            halign: Gtk.Align.START,
            wrap: true,
            max_width_chars: 25,
            xalign: 0
        });
        formatDesc.get_style_context().add_class('dim-label');
        formatTextBox.pack_start(formatDesc, false, false, 0);

        formatRow.pack_start(formatTextBox, true, true, 0);

        const formatCombo = new Gtk.ComboBoxText({
            valign: Gtk.Align.CENTER
        });
        formatCombo.append('jpeg', 'JPEG');
        formatCombo.append('png', 'PNG');
        formatCombo.append('webp', 'WebP');

        const currentFormat = currentSettings.ai_image_format || 'jpeg';
        formatCombo.set_active_id(currentFormat);

        formatCombo.connect('changed', () => {
            const format = formatCombo.get_active_id();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_image_format', format);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        formatRow.pack_end(formatCombo, false, false, 0);
        imageOptBox.pack_start(formatRow, false, false, 0);

        const imageOptNote = new Gtk.Label({
            label: this.t('AI_IMAGE_OPTIMIZATION_DESC', 'Images are resized and compressed before sending to AI providers to reduce latency and costs.'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_top: 4
        });
        imageOptNote.get_style_context().add_class('dim-label');
        imageOptBox.pack_start(imageOptNote, false, false, 0);

        imageOptFrame.add(imageOptBox);
        box.pack_start(imageOptFrame, false, false, 0);

        const loggingFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_LOGGING', 'Logging')
        });

        const loggingBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const filterLogsOnlyCheck = new Gtk.CheckButton({
            label: this.t('AI_FILTER_LOGS_ONLY', 'Show only pipeline filter logs')
        });

        filterLogsOnlyCheck.set_active(currentSettings.ai_filter_logs_only === true);

        filterLogsOnlyCheck.connect('toggled', () => {
            const isActive = filterLogsOnlyCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_filter_logs_only', isActive);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        loggingBox.pack_start(filterLogsOnlyCheck, false, false, 0);

        const filterLogsNote = new Gtk.Label({
            label: this.t('AI_FILTER_LOGS_ONLY_DESC', 'When enabled, only [PipelineFilter] logs are shown in the terminal. Other AI logs are hidden.'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        filterLogsNote.get_style_context().add_class('dim-label');
        loggingBox.pack_start(filterLogsNote, false, false, 0);

        loggingFrame.add(loggingBox);
        box.pack_start(loggingFrame, false, false, 0);

        const displayFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_DISPLAY', 'Display')
        });

        const displayBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const hidePromptsCheck = new Gtk.CheckButton({
            label: this.t('AI_HIDE_PROMPTS', 'Hide prompts in dialogs')
        });

        const hidePromptsValue = currentSettings.ai_hide_prompts_in_dialogs !== false;
        hidePromptsCheck.set_active(hidePromptsValue);

        hidePromptsCheck.connect('toggled', () => {
            const isActive = hidePromptsCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_hide_prompts_in_dialogs', isActive);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        displayBox.pack_start(hidePromptsCheck, false, false, 0);

        const hidePromptsNote = new Gtk.Label({
            label: this.t('AI_HIDE_PROMPTS_DESC', 'When enabled, only sent images and AI responses are shown in Summary and History dialogs. System prompts are hidden.'),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        hidePromptsNote.get_style_context().add_class('dim-label');
        displayBox.pack_start(hidePromptsNote, false, false, 0);

        displayFrame.add(displayBox);
        box.pack_start(displayFrame, false, false, 0);

        const providerFrame = new Gtk.Frame({
            label: this.t('AI_ADVANCED_PROVIDER', 'Provider')
        });

        const providerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const reliableProviderCheck = new Gtk.CheckButton({
            label: this.t('AI_FORCE_RELIABLE_PROVIDER', 'Always reliable provider')
        });

        const reliableProviderValue = currentSettings.ai_force_reliable_provider !== false;
        reliableProviderCheck.set_active(reliableProviderValue);

        reliableProviderCheck.connect('toggled', () => {
            const isActive = reliableProviderCheck.get_active();
            if (this.controller?.settingsService?.settingsManager) {
                this.controller.settingsService.settingsManager.set('ai_force_reliable_provider', isActive);
                this.controller.settingsService.settingsManager.write(null, {silent: true});
            }
        });

        providerBox.pack_start(reliableProviderCheck, false, false, 0);

        const reliableProviderNote = new Gtk.Label({
            label: this.t(
                'AI_FORCE_RELIABLE_PROVIDER_DESC',
                'When enabled, llayer-plus routes AI requests through the OpenAI provider if available, regardless of the dropdown selection.'
            ),
            wrap: true,
            max_width_chars: 38,
            xalign: 0,
            margin_start: 24
        });
        reliableProviderNote.get_style_context().add_class('dim-label');
        providerBox.pack_start(reliableProviderNote, false, false, 0);

        providerFrame.add(providerBox);
        box.pack_start(providerFrame, false, false, 0);

        scrolled.add(box);
        return scrolled;
    }

    createThresholdSlider() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 8
        });

        const labelRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });

        const label = new Gtk.Label({
            label: this.t('AI_CHANGE_THRESHOLD', 'Change Threshold'),
            halign: Gtk.Align.START
        });
        label.get_style_context().add_class('ai-setting-label');
        labelRow.pack_start(label, false, false, 0);

        const settingsBtn = new Gtk.Button({
            relief: Gtk.ReliefStyle.NONE,
            valign: Gtk.Align.CENTER
        });
        const settingsIcon = new Gtk.Image({
            icon_name: 'preferences-system-symbolic',
            icon_size: Gtk.IconSize.MENU
        });
        settingsBtn.set_image(settingsIcon);
        settingsBtn.set_tooltip_text(this.t('AI_CHANGE_DETECTION_SETTINGS', 'Change detection settings'));
        settingsBtn.get_style_context().add_class('flat');
        settingsBtn.set_margin_start(2);
        settingsBtn.set_margin_end(0);
        addPointerCursor(settingsBtn);
        settingsBtn.connect('clicked', () => this.showChangeDetectionSettingsDialog());
        labelRow.pack_start(settingsBtn, false, false, 0);

        box.pack_start(labelRow, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('AI_CHANGE_THRESHOLD_DESC', 'Minimum change to trigger critical event'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            max_width_chars: 45
        });
        desc.get_style_context().add_class('dim-label');
        desc.get_style_context().add_class('ai-setting-desc');
        box.pack_start(desc, false, false, 0);

        const scaleRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const adjustment = new Gtk.Adjustment({
            value: 60,
            lower: 0,
            upper: 100,
            step_increment: 1,
            page_increment: 10
        });

        this.thresholdScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: adjustment,
            draw_value: false,
            hexpand: true,
            has_origin: true
        });
        this.thresholdScale.set_size_request(200, -1);
        this.thresholdScale.get_style_context().add_class('ai-threshold-scale');

        this.thresholdScale.add_mark(0, Gtk.PositionType.BOTTOM, '0');
        this.thresholdScale.add_mark(25, Gtk.PositionType.BOTTOM, null);
        this.thresholdScale.add_mark(50, Gtk.PositionType.BOTTOM, '50');
        this.thresholdScale.add_mark(75, Gtk.PositionType.BOTTOM, null);
        this.thresholdScale.add_mark(100, Gtk.PositionType.BOTTOM, '100');

        this.thresholdScale.connect('value-changed', (scale) => {
            const value = Math.round(scale.get_value());
            this.thresholdValueLabel?.set_label(`${value}%`);
            this.controller?.onSettingChanged?.('changeThreshold', value);
        });

        scaleRow.pack_start(this.thresholdScale, true, true, 0);

        this.thresholdValueLabel = new Gtk.Label({
            label: '60%',
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER
        });
        this.thresholdValueLabel.get_style_context().add_class('ai-threshold-value');
        scaleRow.pack_end(this.thresholdValueLabel, false, false, 0);

        box.pack_start(scaleRow, false, false, 0);

        this.widgets['changeThreshold'] = this.thresholdScale;
        return box;
    }

    createSwitchRow(label, description, widgetKey, actionWidgets = []) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER
        });

        const labelWidget = new Gtk.Label({
            label: label,
            halign: Gtk.Align.START,
            hexpand: true
        });
        labelWidget.get_style_context().add_class('ai-setting-label');
        textBox.pack_start(labelWidget, false, false, 0);

        if (description) {
            const descWidget = new Gtk.Label({
                label: description,
                halign: Gtk.Align.START,
                hexpand: true,
                wrap: true,
                wrap_mode: 2,
                max_width_chars: 35,
                xalign: 0
            });
            descWidget.get_style_context().add_class('dim-label');
            descWidget.get_style_context().add_class('ai-setting-desc');
            textBox.pack_start(descWidget, false, false, 0);
        }

        row.pack_start(textBox, true, true, 0);

        if (Array.isArray(actionWidgets)) {
            for (const widget of actionWidgets) {
                if (!widget) continue;
                row.pack_end(widget, false, false, 0);
            }
        }

        const switchEventBox = new Gtk.EventBox();
        switchEventBox.set_visible_window(false);

        const switchWidget = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        switchWidget.connect('state-set', (widget, state) => {
            if (widgetKey === 'reverseImmersivity' && state === true) {
                const validation = this.controller?.validateReverseImmersivity?.();
                if (validation && !validation.success) {
                    this.showValidationAlert(validation.error, validation.details);
                    return true;
                }
            }
            this.controller?.onSettingChanged?.(widgetKey, state);
            return false;
        });

        switchEventBox.add(switchWidget);
        addPointerCursor(switchEventBox);
        addPointerCursor(switchWidget);

        this.widgets[widgetKey] = switchWidget;
        row.pack_end(switchEventBox, false, false, 0);

        return row;
    }

    createDropdownRow(label, description, widgetKey, items = []) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });

        const labelWidget = new Gtk.Label({
            label: label,
            halign: Gtk.Align.START
        });
        labelWidget.get_style_context().add_class('ai-setting-label');
        box.pack_start(labelWidget, false, false, 0);

        if (description) {
            const descWidget = new Gtk.Label({
                label: description,
                halign: Gtk.Align.START,
                wrap: true,
                wrap_mode: 2,
                max_width_chars: 40,
                xalign: 0
            });
            descWidget.get_style_context().add_class('dim-label');
            descWidget.get_style_context().add_class('ai-setting-desc');
            box.pack_start(descWidget, false, false, 0);
        }

        const combo = new Gtk.ComboBoxText({
            hexpand: true
        });

        combo._isInitializing = true;

        if (items.length === 0) {
            combo.append('none', this.t('AI_NO_OPTIONS', 'No options available'));
            combo.set_active_id('none');
            combo.set_sensitive(false);
        } else {
            items.forEach(([id, text]) => combo.append(id, text));
            if (items.length > 0) combo.set_active(0);
        }

        combo.connect('changed', () => {
            if (combo._isInitializing) return;
            const activeId = combo.get_active_id();
            this.controller?.onSettingChanged?.(widgetKey, activeId);
        });

        combo._isInitializing = false;

        this.widgets[widgetKey] = combo;
        box.pack_start(combo, false, false, 0);

        return box;
    }

    show() {
        this.rootWidget?.show_all?.();
        this.connectKeyboardShortcut();
        this.syncWidgetsWithSettings();

        if (!this.isTrackingFocus) {
            this.previewStack?.set_visible_child_name('placeholder');
            this.screenshotPreview?.clear?.();
            this.lastFullScreenshot = null;
        }

        const windowsModeCombo = this.widgets['allowedWindows'];
        if (windowsModeCombo && !windowsModeCombo._specificWindowConnected) {
            windowsModeCombo.connect('changed', () => {
                this.updateSpecificWindowVisibility?.();
            });
            windowsModeCombo._specificWindowConnected = true;
        }
        this.updateSpecificWindowVisibility?.();
    }

    syncWidgetsWithSettings() {
        const settings = this.controller?.getSettings?.();
        if (!(settings && this.rootWidget && this.isWidgetValid(this.rootWidget))) return;

        this.controller?.beginWidgetSync?.();

        try {
            this.applyWidgetSetting(
                this.widgets['reverseImmersivity'],
                typeof settings.reverseImmersivity === 'boolean',
                widget => widget.set_active(settings.reverseImmersivity)
            );
            this.applyWidgetSetting(
                this.widgets['changePattern'],
                Boolean(settings.changePattern),
                widget => widget.set_active_id(settings.changePattern)
            );
            this.applyWidgetSetting(
                this.widgets['allowedWindows'],
                Boolean(settings.allowedWindows),
                widget => widget.set_active_id(settings.allowedWindows)
            );
            this.applyWidgetSetting(
                this.thresholdScale,
                typeof settings.changeThreshold === 'number',
                widget => widget.set_value(settings.changeThreshold)
            );
            this.applyWidgetSetting(
                this.thresholdValueLabel,
                typeof settings.changeThreshold === 'number',
                widget => widget.set_label(`${settings.changeThreshold}%`)
            );

            this.updateAIProviderDropdown();
        } finally {
            this.controller?.endWidgetSync?.();
        }
    }

    hide() {
        this.rootWidget?.hide?.();
        this.stopTracking();
        this.disconnectKeyboardShortcut();
    }

    showValidationAlert(errorCode, details) {
        const title = this.t('AI_PREFLIGHT_FAILED_TITLE', 'Cannot Enable Reverse Immersivity');
        const message = details || this.t('AI_PREFLIGHT_FAILED_GENERIC', 'Pre-flight checks failed.');

        const dialog = new Gtk.MessageDialog({
            transient_for: this.rootWidget?.get_toplevel?.() || null,
            modal: true,
            message_type: Gtk.MessageType.WARNING,
            buttons: Gtk.ButtonsType.OK,
            text: title,
            secondary_text: message
        });

        dialog.connect('response', () => dialog.destroy());
        dialog.show();
    }

    destroy() {
        this.stopTracking();
        this.disconnectKeyboardShortcut();

        this._accelGroup = null;
        this.rootWidget?.destroy?.();
        this.rootWidget = null;
        this.notebook = null;
        this.widgets = {};
        this.controller = null;
        this.logger = null;
        this.lastFullScreenshot = null;
        this.focusDisplayLabel = null;
        this.changePercentLabel = null;
        this.criticalChangeLabel = null;
        this.lastCriticalTimeLabel = null;
        this.thresholdScale = null;
        this.thresholdValueLabel = null;
        this.trackingButton = null;
        this.screenshotButton = null;
        this.screenshotPreview = null;
        this.previewStack = null;
        this.providersStack = null;
        this.providersListBox = null;
        this._frameCounter = 0;
        this._criticalCounter = 0;
        this._criticalEventsLog = [];
    }

    log(level, message, data = null) {
        this.logger?.[level]?.('AIDynamicEnvironmentView', message, data);
    }
}
