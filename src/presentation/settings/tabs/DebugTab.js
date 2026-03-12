import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';
import { tryOrDefault, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import {addPointerCursor} from '../../common/ViewUtils.js';
import {ProcessManagerPopup} from '../dialogs/ProcessManagerPopup.js';

const DEBUG_LOG_DIR = `${GLib.get_user_cache_dir()}/llayer-debug`;
const DEBUG_SETTINGS_KEYS = [
    'debugBrowserExtension',
    'debugServiceIPC',
    'debugImportUnification',
    'debugApplyInstall',
    'debugHyprlandErrors',
    'debugEventBus'
];

const LOG_COLORS = {
    SESSION: { fg: '#f59e0b', bg: null, bold: true },
    BROWSER: { fg: '#3b82f6', bg: null, bold: false },
    IPC: { fg: '#8b5cf6', bg: null, bold: false },
    IMPORT: { fg: '#10b981', bg: null, bold: false },
    UNIFY: { fg: '#14b8a6', bg: null, bold: false },
    APPLY: { fg: '#f97316', bg: null, bold: false },
    INSTALL: { fg: '#ec4899', bg: null, bold: false },
    HYPRLAND: { fg: '#ef4444', bg: null, bold: false },
    EVENT: { fg: '#6366f1', bg: null, bold: false },
    EVENTBUS: { fg: '#6366f1', bg: null, bold: false },
    BAR: { fg: '#f97316', bg: null, bold: false },
    BAR_DIAG: { fg: '#f97316', bg: null, bold: false },
    GOWALL: { fg: '#84cc16', bg: null, bold: false },
    WALLPAPER: { fg: '#84cc16', bg: null, bold: false },
    VARIANT: { fg: '#a855f7', bg: null, bold: false },
    HOTKEYS: { fg: '#06b6d4', bg: null, bold: false },
    ERROR: { fg: '#ffffff', bg: '#dc2626', bold: true },
    SUCCESS: { fg: '#22c55e', bg: null, bold: true },
    WARNING: { fg: '#eab308', bg: null, bold: false },
    TIMESTAMP: { fg: '#6b7280', bg: null, bold: false },
};

export class DebugTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings || {};
        this.widgets = deps.widgets || {};
        this.settingsManager = deps.settingsManager || null;
        this.eventBus = deps.eventBus || null;
        this.container = deps.container || null;
        this.dialog = deps.dialog || null;
        this.sessions = [];
        this.sessionFiles = [];
        this.textTags = {};
    }

    build() {
        this.ensureDebugDir();

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        const headerLabel = new Gtk.Label({
            label: '<b>Debug Logging</b>',
            use_markup: true,
            halign: Gtk.Align.START
        });
        headerLabel.set_margin_bottom(8);
        box.pack_start(headerLabel, false, false, 0);

        const headerRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        const noteLabel = new Gtk.Label({
            label: 'Enable detailed logging for troubleshooting. Logs are saved to:\n' + DEBUG_LOG_DIR,
            wrap: true,
            xalign: 0,
            halign: Gtk.Align.START
        });
        noteLabel.get_style_context().add_class('dim-label');
        noteLabel.set_hexpand(true);
        headerRow.pack_start(noteLabel, true, true, 0);

        const procManagerBtn = new Gtk.Button({label: this.t('PROC_MANAGER_OPEN')});
        procManagerBtn.set_valign(Gtk.Align.CENTER);
        addPointerCursor(procManagerBtn);
        procManagerBtn.connect('clicked', () => this.openProcessManager());
        headerRow.pack_end(procManagerBtn, false, false, 0);

        headerRow.set_margin_bottom(8);
        box.pack_start(headerRow, false, false, 0);

        const tipLabel = new Gtk.Label({
            label: '💡 Tip: Use "Copy Session" to share logs for a specific rice import with AI',
            wrap: true,
            xalign: 0,
            halign: Gtk.Align.START
        });
        tipLabel.get_style_context().add_class('dim-label');
        tipLabel.set_margin_bottom(12);
        box.pack_start(tipLabel, false, false, 0);

        const masterRow = this.createSwitchRow(
            'Enable All Debug Logging',
            'Master switch to enable/disable all debug logging',
            this.isAnyDebugEnabled()
        );
        this.widgets.debugMasterSwitch = masterRow.switch;
        box.pack_start(masterRow.box, false, false, 0);

        const separator1 = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
        separator1.set_margin_top(8);
        separator1.set_margin_bottom(8);
        box.pack_start(separator1, false, false, 0);

        const switches = [
            {
                key: 'debugBrowserExtension',
                label: '1. Browser Extension Logs',
                desc: 'Detailed flow: rice URL, wallpaper detection, download events with timestamps'
            },
            {
                key: 'debugServiceIPC',
                label: '2. Service / IPC Logs',
                desc: 'Cross-platform communication: browser to app file transfers'
            },
            {
                key: 'debugImportUnification',
                label: '3. Import & Unification Logs',
                desc: 'Every stage of theme processing: structure detection, conversion, file operations'
            },
            {
                key: 'debugApplyInstall',
                label: '4. Apply & Install Logs',
                desc: 'Theme application, script execution, Hyprland config errors (red top bar)'
            },
            {
                key: 'debugHyprlandErrors',
                label: '5. Hyprland Error Capture',
                desc: 'Capture hyprctl errors and config parsing failures'
            },
            {
                key: 'debugEventBus',
                label: '6. Event Bus Logs',
                desc: 'All internal events: UI updates, theme changes, conversion progress'
            }
        ];

        for (const sw of switches) {
            const row = this.createSwitchRow(
                sw.label,
                sw.desc,
                this.settings[sw.key] !== false
            );
            this.widgets[sw.key + 'Switch'] = row.switch;
            box.pack_start(row.box, false, false, 0);
        }

        masterRow.switch.connect('state-set', (widget, state) => {
            for (const sw of switches) {
                const swWidget = this.widgets[sw.key + 'Switch'];
                if (swWidget) {
                    swWidget.set_active(state);
                }
            }
            return false;
        });

        const separator2 = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
        separator2.set_margin_top(12);
        separator2.set_margin_bottom(12);
        box.pack_start(separator2, false, false, 0);

        const sessionRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const sessionLabel = new Gtk.Label({
            label: 'Session:',
            halign: Gtk.Align.START
        });
        sessionRow.pack_start(sessionLabel, false, false, 0);

        const sessionCombo = new Gtk.ComboBoxText();
        sessionCombo.append('all', 'All Sessions');
        sessionCombo.set_active_id('all');
        sessionCombo.set_hexpand(true);
        this.widgets.sessionCombo = sessionCombo;
        sessionRow.pack_start(sessionCombo, true, true, 0);

        sessionCombo.connect('changed', () => {
            const activeId = sessionCombo.get_active_id();
            if (this.widgets.copySessionBtn) {
                this.widgets.copySessionBtn.set_sensitive(activeId !== 'all');
            }
            if (this.widgets.deleteSessionBtn) {
                this.widgets.deleteSessionBtn.set_sensitive(activeId !== 'all');
            }
            this.loadSessionContent(activeId);
        });

        box.pack_start(sessionRow, false, false, 0);

        const actionsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        actionsBox.set_margin_top(8);

        const viewLogBtn = new Gtk.Button({ label: 'Open Folder' });
        addPointerCursor(viewLogBtn);
        viewLogBtn.connect('clicked', () => this.openLogFolder());
        actionsBox.pack_start(viewLogBtn, false, false, 0);

        const copyLogBtn = new Gtk.Button({ label: 'Copy All' });
        addPointerCursor(copyLogBtn);
        copyLogBtn.connect('clicked', () => this.copyLog());
        actionsBox.pack_start(copyLogBtn, false, false, 0);

        const clearLogBtn = new Gtk.Button({ label: 'Clear All' });
        addPointerCursor(clearLogBtn);
        clearLogBtn.connect('clicked', () => this.clearAllLogs());
        actionsBox.pack_start(clearLogBtn, false, false, 0);

        const exportLogBtn = new Gtk.Button({ label: 'Export...' });
        addPointerCursor(exportLogBtn);
        exportLogBtn.connect('clicked', () => this.exportLog());
        actionsBox.pack_start(exportLogBtn, false, false, 0);

        box.pack_start(actionsBox, false, false, 0);

        const logFrame = new Gtk.Frame({ label: 'Log Entries' });
        logFrame.set_margin_top(12);

        const logScroll = new Gtk.ScrolledWindow();
        logScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        logScroll.set_min_content_height(200);
        logScroll.set_hexpand(true);
        logScroll.set_vexpand(true);

        const logBuffer = new Gtk.TextBuffer();
        const logView = new Gtk.TextView({ buffer: logBuffer, editable: false, monospace: true });
        logView.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
        logScroll.add(logView);
        logFrame.add(logScroll);

        this.widgets.logBuffer = logBuffer;
        this.widgets.logView = logView;

        this.createTextTags(logBuffer);

        box.pack_start(logFrame, true, true, 0);

        const bottomActionsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        bottomActionsBox.set_margin_top(8);

        const refreshBtn = new Gtk.Button({ label: 'Refresh' });
        addPointerCursor(refreshBtn);
        refreshBtn.connect('clicked', () => this.refreshSessionList());
        bottomActionsBox.pack_start(refreshBtn, false, false, 0);

        const copySessionBtn = new Gtk.Button({ label: 'Copy Session' });
        copySessionBtn.set_sensitive(false);
        addPointerCursor(copySessionBtn);
        copySessionBtn.connect('clicked', () => this.copyCurrentSession());
        this.widgets.copySessionBtn = copySessionBtn;
        bottomActionsBox.pack_start(copySessionBtn, false, false, 0);

        const deleteSessionBtn = new Gtk.Button({ label: 'Delete Session' });
        deleteSessionBtn.set_sensitive(false);
        addPointerCursor(deleteSessionBtn);
        deleteSessionBtn.connect('clicked', () => this.deleteCurrentSession());
        this.widgets.deleteSessionBtn = deleteSessionBtn;
        bottomActionsBox.pack_start(deleteSessionBtn, false, false, 0);

        box.pack_start(bottomActionsBox, false, false, 0);

        this.refreshSessionList(true);

        const tabLabel = new Gtk.Label({ label: 'Debug' });
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return { box, tabLabel };
    }

    ensureDebugDir() {
        const created = tryRun('DebugTab.ensureDebugDir', () => {
            const dir = Gio.File.new_for_path(DEBUG_LOG_DIR);
            if (!dir.query_exists(null)) {
                dir.make_directory_with_parents(null);
            }
        });
        if (!created) {
            console.error('[DebugTab] Failed to create debug directory');
        }
    }

    openProcessManager() {
        const popup = new ProcessManagerPopup({
            t: this.t,
            parentWindow: this.dialog,
            settingsManager: this.settingsManager
        });
        popup.open();
    }

    createTextTags(buffer) {
        const tagTable = buffer.get_tag_table();

        for (const [name, colors] of Object.entries(LOG_COLORS)) {
            const tag = new Gtk.TextTag({ name: name.toLowerCase() });
            if (colors.fg) {
                tag.set_property('foreground', colors.fg);
            }
            if (colors.bg) {
                tag.set_property('background', colors.bg);
            }
            if (colors.bold) {
                tag.set_property('weight', Pango.Weight.BOLD);
            }
            tagTable.add(tag);
            this.textTags[name.toLowerCase()] = tag;
        }
    }

    createSwitchRow(label, description, active) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });
        box.set_margin_top(4);
        box.set_margin_bottom(4);

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });

        const titleLabel = new Gtk.Label({
            label: label,
            halign: Gtk.Align.START,
            hexpand: true
        });
        labelBox.pack_start(titleLabel, false, false, 0);

        if (description) {
            const descLabel = new Gtk.Label({
                label: description,
                halign: Gtk.Align.START,
                wrap: true,
                xalign: 0
            });
            descLabel.get_style_context().add_class('dim-label');
            labelBox.pack_start(descLabel, false, false, 0);
        }

        box.pack_start(labelBox, true, true, 0);

        const sw = new Gtk.Switch();
        sw.set_active(active);
        sw.set_valign(Gtk.Align.CENTER);
        addPointerCursor(sw);
        box.pack_end(sw, false, false, 0);

        return { box, switch: sw };
    }

    isAnyDebugEnabled() {
        for (const key of DEBUG_SETTINGS_KEYS) {
            if (this.settings[key] !== false) {
                return true;
            }
        }
        return false;
    }

    refreshSessionList(autoSelectLast = false) {
        this.sessionFiles = this.listSessionFiles();
        this.updateSessionCombo(autoSelectLast);
    }

    parseSessionDisplayName(filename) {
        const match = filename.match(/^session_(\d{4}-\d{2}-\d{2}T[\d-]+)_(.+)\.log$/);
        if (match) {
            const time = match[1].replace(/-/g, ':').substring(11, 19);
            const riceName = match[2].replace(/-/g, ' ');
            return `${time} - ${riceName}`;
        }
        return filename.replace('.log', '');
    }

    updateSessionCombo(autoSelectLast = false) {
        const combo = this.widgets.sessionCombo;
        if (!combo) return;

        const currentId = combo.get_active_id();

        combo.remove_all();
        combo.append('all', 'All Sessions');

        for (const session of this.sessionFiles) {
            combo.append(session.path, session.displayName);
        }

        const hasCurrentSelection = currentId && (
            currentId === 'all' || this.sessionFiles.some(session => session.path === currentId)
        );

        if (autoSelectLast && this.sessionFiles.length > 0) {
            combo.set_active_id(this.sessionFiles[0].path);
            return;
        }

        combo.set_active_id(hasCurrentSelection ? currentId : 'all');
    }

    loadSessionContent(sessionId) {
        const buffer = this.widgets.logBuffer;
        if (!buffer) return;

        let content = '';

        if (sessionId === 'all') {
            const maxFiles = 5;
            const filesToLoad = this.sessionFiles.slice(0, maxFiles);

            for (const session of filesToLoad.reverse()) {
                const sessionContent = this.readSessionText(session.path);
                if (sessionContent) {
                    content += sessionContent + '\n';
                }
            }

            if (this.sessionFiles.length > maxFiles) {
                content = `[Showing last ${maxFiles} sessions. Select a specific session for full logs.]\n\n` + content;
            }
        } else {
            const sessionContent = this.readSessionText(sessionId);
            if (sessionContent !== null) {
                content = sessionContent;
            } else {
                content = 'Error loading session';
            }
        }

        this.applyColoredText(buffer, content);

        const endIter = buffer.get_end_iter();
        this.widgets.logView?.scroll_to_iter(endIter, 0, false, 0, 0);
    }

    applyColoredText(buffer, text) {
        buffer.set_text('', 0);

        const lines = text.split('\n');
        let iter = buffer.get_start_iter();

        for (const line of lines) {
            if (line.length === 0) {
                buffer.insert(iter, '\n', -1);
                continue;
            }

            const categoryMatch = line.match(/\]\s*\[([A-Z_]+)\s*\]/);
            let tag = null;

            if (categoryMatch && categoryMatch[1]) {
                const category = categoryMatch[1].toLowerCase();
                tag = this.textTags[category];
            }

            if (line.includes('[SESSION') && (line.includes('═') || line.includes('NEW IMPORT'))) {
                tag = this.textTags['session'];
            }

            if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
                tag = this.textTags['error'];
            }

            if (line.includes('SUCCESS') || line.includes('✓')) {
                tag = this.textTags['success'];
            }

            if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) {
                tag = this.textTags['warning'];
            }

            if (tag) {
                const startOffset = iter.get_offset();
                buffer.insert(iter, line + '\n', -1);
                const startIter = buffer.get_iter_at_offset(startOffset);
                const endIter = buffer.get_iter_at_offset(startOffset + line.length);
                buffer.apply_tag(tag, startIter, endIter);
            } else {
                buffer.insert(iter, line + '\n', -1);
            }

            iter = buffer.get_end_iter();
        }
    }

    copyCurrentSession() {
        const combo = this.widgets.sessionCombo;
        if (!combo) return;

        const sessionId = combo.get_active_id();
        if (sessionId === 'all') return;

        const content = this.readSessionText(sessionId);
        if (content) {
            this.copyTextToClipboard(content);
        }
    }

    deleteCurrentSession() {
        const combo = this.widgets.sessionCombo;
        if (!combo) return;

        const sessionId = combo.get_active_id();
        if (sessionId === 'all') return;

        const deleted = this.deleteFileIfExists(sessionId);
        if (!deleted) {
            console.error('[DebugTab] Failed to delete session');
        }
        this.refreshSessionList(true);
    }

    openLogFolder() {
        tryRun('DebugTab.openLogFolder', () => {
            GLib.spawn_command_line_async(`xdg-open "${DEBUG_LOG_DIR}"`);
        });
    }

    copyLog() {
        const combo = this.widgets.sessionCombo;
        const sessionId = combo?.get_active_id() || 'all';

        if (sessionId !== 'all') {
            this.copyCurrentSession();
            return;
        }

        const content = this.collectSessionText(this.sessionFiles);
        this.copyTextToClipboard(content);
    }

    clearAllLogs() {
        for (const session of this.sessionFiles) {
            if (!this.deleteFileIfExists(session.path)) {
                console.error('[DebugTab] Failed to clear log', session.path);
            }
        }
        this.refreshSessionList();
    }

    exportLog() {
        const dialog = new Gtk.FileChooserDialog({
            title: 'Export Debug Log',
            action: Gtk.FileChooserAction.SAVE
        });
        const cancelBtn = dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        const saveBtn = dialog.add_button('Save', Gtk.ResponseType.ACCEPT);
        addPointerCursor(cancelBtn);
        addPointerCursor(saveBtn);
        dialog.set_current_name(`llayer-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const dest = dlg.get_filename();
                const combo = this.widgets.sessionCombo;
                const sessionId = combo?.get_active_id() || 'all';

                const exported = sessionId !== 'all'
                    ? this.copyFile(sessionId, dest)
                    : tryRun('DebugTab.exportAllLogs', () => {
                        GLib.file_set_contents(dest, this.collectSessionText(this.sessionFiles));
                    });
                if (!exported) {
                    console.error('[DebugTab] Export failed');
                }
            }
            dlg.destroy();
        });

        dialog.show();
    }

    listSessionFiles() {
        return tryOrDefault('DebugTab.listSessionFiles', () => {
            const dir = Gio.File.new_for_path(DEBUG_LOG_DIR);
            if (!dir.query_exists(null)) {
                return [];
            }

            const sessionFiles = [];
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type,time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const name = fileInfo.get_name();
                if (!name.endsWith('.log')) {
                    continue;
                }

                const modTime = fileInfo.get_modification_date_time();
                sessionFiles.push({
                    name,
                    path: `${DEBUG_LOG_DIR}/${name}`,
                    modified: modTime ? modTime.to_unix() : 0,
                    displayName: this.parseSessionDisplayName(name)
                });
            }

            enumerator.close(null);
            sessionFiles.sort((a, b) => b.modified - a.modified);
            return sessionFiles;
        }, []);
    }

    readSessionText(path) {
        return tryOrDefault('DebugTab.readSessionText', () => {
            const [ok, data] = GLib.file_get_contents(path);
            return ok ? new TextDecoder().decode(data) : '';
        }, null);
    }

    collectSessionText(sessions) {
        let content = '';
        for (const session of sessions) {
            const sessionContent = this.readSessionText(session.path);
            if (sessionContent) {
                content += sessionContent + '\n';
            }
        }
        return content;
    }

    copyTextToClipboard(text) {
        tryRun('DebugTab.copyTextToClipboard', () => {
            const clipboard = Gtk.Clipboard.get_default(this.widgets.logView?.get_display());
            clipboard?.set_text(text, -1);
        });
    }

    deleteFileIfExists(path) {
        return tryRun('DebugTab.deleteFileIfExists', () => {
            const file = Gio.File.new_for_path(path);
            if (file.query_exists(null)) {
                file.delete(null);
            }
        });
    }

    copyFile(sourcePath, destinationPath) {
        return tryRun('DebugTab.copyFile', () => {
            const sourceFile = Gio.File.new_for_path(sourcePath);
            const destinationFile = Gio.File.new_for_path(destinationPath);
            sourceFile.copy(destinationFile, Gio.FileCopyFlags.OVERWRITE, null, null);
        });
    }

    getValues() {
        const values = {};
        for (const key of DEBUG_SETTINGS_KEYS) {
            const sw = this.widgets[key + 'Switch'];
            if (sw) {
                values[key] = sw.get_active();
            }
        }
        return values;
    }
}

export class DebugLogger {
    static instance = null;

    static getInstance() {
        if (!DebugLogger.instance) {
            DebugLogger.instance = new DebugLogger();
        }
        return DebugLogger.instance;
    }

    constructor() {
        this.settings = {};
        this.logDir = DEBUG_LOG_DIR;
        this.currentSessionPath = null;
        this.buffer = [];
        this.flushTimer = 0;
        this.ensureLogDir();
    }

    ensureLogDir() {
        const ready = tryRun('DebugLogger.ensureLogDir', () => {
            const dir = Gio.File.new_for_path(this.logDir);
            if (!dir.query_exists(null)) {
                dir.make_directory_with_parents(null);
            }

            if (!this.currentSessionPath) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.currentSessionPath = `${this.logDir}/session_${timestamp}_general.log`;
                this.updateCurrentSessionLink();
            }
        });
        if (!ready) {
            console.error('[DebugLogger] Failed to create log directory');
        }
    }

    configure(settings) {
        this.settings = settings || {};
    }

    isEnabled(category) {
        const keyMap = {
            'browser': 'debugBrowserExtension',
            'ipc': 'debugServiceIPC',
            'import': 'debugImportUnification',
            'unify': 'debugImportUnification',
            'apply': 'debugApplyInstall',
            'install': 'debugApplyInstall',
            'bar_diag': 'debugApplyInstall',
            'bar': 'debugApplyInstall',
            'gowall_apply': 'debugApplyInstall',
            'gowall': 'debugApplyInstall',
            'wallpaper': 'debugApplyInstall',
            'variant': 'debugApplyInstall',
            'hotkeys': 'debugApplyInstall',
            'hyprland': 'debugHyprlandErrors',
            'event': 'debugEventBus',
            'eventbus': 'debugEventBus'
        };
        const key = keyMap[category.toLowerCase()] || category;
        return this.settings[key] !== false;
    }

    log(category, message, data = null) {
        if (!this.isEnabled(category)) return;

        const timestamp = new Date().toISOString();
        const cat = category.toUpperCase().padEnd(10);
        let line = `[${timestamp}] [${cat}] ${message}`;
        if (data !== null) {
            const serializedData = tryOrDefault('DebugLogger.serializeData', () => JSON.stringify(data), '[unserializable data]');
            line += ` | ${serializedData}`;
        }
        line += '\n';

        this.buffer.push(line);
        this.scheduleFlush();
    }

    scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this.flush();
            this.flushTimer = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    flush() {
        if (this.buffer.length === 0) return;

        const content = this.buffer.join('');
        this.buffer = [];

        const flushed = tryRun('DebugLogger.flush', () => {
            const logPath = this.currentSessionPath || this.getDefaultLogPath();
            const file = Gio.File.new_for_path(logPath);
            const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
            stream.write_all(new TextEncoder().encode(content), null);
            stream.close(null);
        });
        if (!flushed) {
            console.error('[DebugLogger] Failed to write log');
            this.buffer.forEach(line => console.log(line.trim()));
        }
    }

    getDefaultLogPath() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${this.logDir}/session_${timestamp}_general.log`;
    }

    startSession(riceName, url = null) {
        this.flush();

        const timestamp = new Date().toISOString();
        const safeRiceName = (riceName || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
        const fileTimestamp = timestamp.replace(/[:.]/g, '-');

        this.currentSessionPath = `${this.logDir}/session_${fileTimestamp}_${safeRiceName}.log`;

        const separator = '═'.repeat(20);
        let lines = [
            `[${timestamp}] [SESSION   ] ${separator} NEW IMPORT ${separator}`,
            `[${timestamp}] [SESSION   ] Rice: ${riceName}${url ? ` | URL: ${url}` : ''}`,
            `[${timestamp}] [SESSION   ] ${'─'.repeat(50)}`,
            ''
        ];

        const created = tryRun('DebugLogger.startSession', () => {
            const content = lines.join('\n');
            GLib.file_set_contents(this.currentSessionPath, content);

            this.updateCurrentSessionLink();
        });
        if (!created) {
            console.error('[DebugLogger] Failed to create session file');
        }
    }

    updateCurrentSessionLink() {
        if (!this.currentSessionPath) return;

        const linkPath = `${GLib.get_user_cache_dir()}/llayer-debug.log`;
        const linked = tryRun('DebugLogger.updateCurrentSessionLink', () => {
            const linkFile = Gio.File.new_for_path(linkPath);
            if (linkFile.query_exists(null)) {
                linkFile.delete(null);
            }
            linkFile.make_symbolic_link(this.currentSessionPath, null);
        });
        if (!linked) {
            console.error('[DebugLogger] Failed to create session symlink');
        }
    }

    endSession(riceName, success = true, errorMsg = null) {
        const timestamp = new Date().toISOString();
        const status = success ? '✓ SUCCESS' : `✗ FAILED: ${errorMsg || 'Unknown error'}`;

        let lines = [
            `[${timestamp}] [SESSION   ] ${'─'.repeat(50)}`,
            `[${timestamp}] [SESSION   ] ${status} - ${riceName}`,
            `[${timestamp}] [SESSION   ] ${'═'.repeat(50)}`,
            ''
        ];

        if (this.currentSessionPath) {
            const appended = tryRun('DebugLogger.endSession', () => {
                const content = lines.join('\n');
                const file = Gio.File.new_for_path(this.currentSessionPath);
                const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
                stream.write_all(new TextEncoder().encode(content), null);
                stream.close(null);
            });
            if (!appended) {
                console.error('[DebugLogger] Failed to write session end');
            }
        }

        this.currentSessionPath = null;
    }

    browser(message, data) { this.log('browser', message, data); }
    ipc(message, data) { this.log('ipc', message, data); }
    import(message, data) { this.log('import', message, data); }
    unify(message, data) { this.log('unify', message, data); }
    apply(message, data) { this.log('apply', message, data); }
    install(message, data) { this.log('install', message, data); }
    hyprland(message, data) { this.log('hyprland', message, data); }
    event(message, data) { this.log('event', message, data); }
}
