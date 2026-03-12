import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor} from '../../common/ViewUtils.js';
import { tryOrFalse } from '../../../infrastructure/utils/ErrorUtils.js';

export class LogPanel {
    constructor(deps = {}) {
        this.t = deps.t || ((k) => k);
        this.createIcon = deps.createIcon || (() => null);
        this.eventBus = deps.eventBus || null;
        this.Box = deps.Box || Gtk.Box;
        this.getSettings = deps.getSettings || (() => ({}));
        this.onAdaptWindowSize = deps.onAdaptWindowSize || (() => {});

        this.parentContainer = null;
        this.positionInParent = -1;

        this.container = null;
        this.contentBox = null;
        this.textView = null;
        this.textBuffer = null;
        this.scrollWindow = null;
        this.headerBox = null;
        this.toggleButton = null;
        this.clearButton = null;
        this.closeButton = null;
        this.countLabel = null;
        this.titleLabel = null;

        this.isExpanded = false;
        this.isVisible = false;
        this.logCount = 0;
        this.maxLogs = 500;
        this.subscriptionIds = [];
        this.isDestroyed = false;
        this.activeImports = 0;
        this.autoHideTimerId = null;
    }

    isWidgetValid(widget) {
        if (!widget || widget.is_destroyed?.())
            return false;
        return tryOrFalse('LogPanel.isWidgetValid', () => {
            widget.get_visible?.();
            return true;
        });
    }

    ensureAlive() {
        if (this.isDestroyed) return false;
        if (this.container && !this.isWidgetValid(this.container)) {
            this.isDestroyed = true;
            return false;
        }
        return true;
    }

    isBufferValid(buffer) {
        if (!buffer)
            return false;
        return tryOrFalse('LogPanel.isBufferValid', () => {
            buffer.get_char_count();
            return true;
        });
    }

    hasWidgets(...widgets) {
        return widgets.every(widget => this.isWidgetValid(widget));
    }

    canUseTextOutput() {
        return this.ensureAlive()
            && this.hasWidgets(this.textView)
            && this.isBufferValid(this.textBuffer);
    }

    canUseWidgets(...widgets) {
        return this.ensureAlive() && this.hasWidgets(...widgets);
    }

    build() {
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        this.container.get_style_context().add_class('log-panel');
        this.container.connect('destroy', () => {
            this.isDestroyed = true;
            this.container = null;
            this.contentBox = null;
            this.textView = null;
            this.textBuffer = null;
            this.scrollWindow = null;
            this.headerBox = null;
            this.toggleButton = null;
            this.clearButton = null;
            this.closeButton = null;
            this.countLabel = null;
            this.titleLabel = null;
        });

        this.headerBox = this.createHeader();
        this.container.pack_start(this.headerBox, false, false, 0);

        this.contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        this.contentBox.get_style_context().add_class('log-panel-content');

        this.scrollWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });
        this.scrollWindow.set_min_content_height(120);
        this.scrollWindow.set_max_content_height(200);

        this.textBuffer = new Gtk.TextBuffer();
        this.textView = new Gtk.TextView({
            buffer: this.textBuffer,
            editable: false,
            cursor_visible: false,
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            monospace: true
        });
        this.textView.get_style_context().add_class('log-panel-text');
        this.textView.set_left_margin(8);
        this.textView.set_right_margin(8);
        this.textView.set_top_margin(4);
        this.textView.set_bottom_margin(4);

        this.scrollWindow.add(this.textView);
        this.contentBox.pack_start(this.scrollWindow, true, true, 0);

        this.container.pack_start(this.contentBox, false, false, 0);

        this.container.set_visible(false);
        this.container.set_no_show_all(true);
        this.contentBox.set_visible(false);
        this.contentBox.set_no_show_all(true);
        this.isVisible = false;

        this.subscribeToEvents();

        return this.container;
    }

    createHeader() {
        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        header.get_style_context().add_class('log-panel-header');
        header.set_margin_start(8);
        header.set_margin_end(8);
        header.set_margin_top(4);
        header.set_margin_bottom(4);

        this.toggleButton = new Gtk.Button();
        this.toggleButton.get_style_context().add_class('log-panel-toggle');
        this.toggleButton.get_style_context().add_class('flat');
        addPointerCursor(this.toggleButton);
        this.updateToggleButton();
        this.toggleButton.connect('clicked', () => this.toggle());
        header.pack_start(this.toggleButton, false, false, 0);

        const titleKey = 'IMPORT_LOG_SECTION_LABEL';
        const translated = this.t(titleKey);
        this.titleLabel = new Gtk.Label({
            label: translated && translated !== titleKey ? translated : 'Import Log',
            halign: Gtk.Align.START
        });
        this.titleLabel.get_style_context().add_class('log-panel-title');
        header.pack_start(this.titleLabel, false, false, 0);

        this.countLabel = new Gtk.Label({
            label: '',
            halign: Gtk.Align.START
        });
        this.countLabel.get_style_context().add_class('log-panel-count');
        this.countLabel.set_visible(false);
        header.pack_start(this.countLabel, false, false, 0);

        const spacer = new Gtk.Box({hexpand: true});
        header.pack_start(spacer, true, true, 0);

        this.closeButton = new Gtk.Button();
        const closeIcon = this.createIcon?.('window-close-symbolic', 14) || new Gtk.Label({label: 'x'});
        this.closeButton.set_image(closeIcon);
        this.closeButton.get_style_context().add_class('log-panel-close');
        this.closeButton.get_style_context().add_class('flat');
        this.closeButton.set_tooltip_text('Close');
        addPointerCursor(this.closeButton);
        this.closeButton.connect('clicked', () => this.hidePanel());
        header.pack_end(this.closeButton, false, false, 0);

        this.clearButton = new Gtk.Button();
        const clearIcon = this.createIcon?.('edit-clear-symbolic', 14) || new Gtk.Label({label: 'c'});
        this.clearButton.set_image(clearIcon);
        this.clearButton.get_style_context().add_class('log-panel-clear');
        this.clearButton.get_style_context().add_class('flat');
        this.clearButton.set_tooltip_text('Clear');
        addPointerCursor(this.clearButton);
        this.clearButton.connect('clicked', () => this.clear());
        header.pack_end(this.clearButton, false, false, 0);

        return header;
    }

    subscribeToEvents() {
        if (!this.eventBus) return;

        const subscribe = (eventName, handler) => {
            const listenerId = this.eventBus.on(eventName, handler);
            if (listenerId) this.subscriptionIds.push({eventName, listenerId});
        };

        const subscribeMany = (eventNames, handler) => {
            (eventNames || []).forEach((eventName) => subscribe(eventName, handler));
        };

        subscribeMany(['unifier.log', 'UNIFIER_LOG'], (data = {}) => {
            this.appendLog(data.message || '', data.level || 'info', data.source || 'Unifier');
        });

        subscribeMany(['inbox.import.started', 'INBOX_IMPORT_STARTED'], (data = {}) => {
            const settings = this.getSettings();
            if (settings.importLogDisabled) return;

            this.activeImports += 1;
            if (this.autoHideTimerId) {
                GLib.source_remove(this.autoHideTimerId);
                this.autoHideTimerId = null;
            }

            this.showPanel();
            this.appendLog(`Starting import: ${data.filename || 'theme'}`, 'phase', 'Import');
        });

        subscribeMany(['inbox.theme.imported', 'INBOX_THEME_IMPORTED'], (data = {}) => {
            const settings = this.getSettings();
            if (!settings.importLogDisabled) {
                this.appendLog(`Theme imported: ${data.themeName || 'unknown'}`, 'success', 'Import');
            }

            this.activeImports = Math.max(0, this.activeImports - 1);

            if (settings.importLogAutoHide && this.isVisible) {
                if (this.autoHideTimerId) {
                    GLib.source_remove(this.autoHideTimerId);
                    this.autoHideTimerId = null;
                }

                this.autoHideTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => {
                    if (!this.ensureAlive()) return GLib.SOURCE_REMOVE;
                    if (this.activeImports === 0) {
                        this.hidePanel();
                    }
                    this.autoHideTimerId = null;
                    return GLib.SOURCE_REMOVE;
                });
            }
        });
    }

    appendLog(message, level = 'info', source = null) {
        if (!(this.canUseTextOutput() && typeof message === 'string' && message)) return;

        if (this.logCount >= this.maxLogs) {
            const startIter = this.textBuffer.get_start_iter();
            const endIter = this.textBuffer.get_iter_at_line(1);
            this.textBuffer.delete(startIter, endIter);
            this.logCount -= 1;
        }

        if (this.textBuffer.get_char_count() > 0) {
            this.textBuffer.insert(this.textBuffer.get_end_iter(), '\n', -1);
        }

        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const levelPrefix = level === 'phase' ? '>'
            : level === 'success' ? 'OK'
                : level === 'warning' ? '!'
                    : level === 'error' ? 'ERR'
                        : '-';

        const sourceStr = source ? `[${source}] ` : '';
        const line = `[${timestamp}] ${sourceStr}${levelPrefix} ${message}`;

        this.textBuffer.insert(this.textBuffer.get_end_iter(), line, -1);
        this.logCount += 1;
        this.updateCountBadge();

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this.ensureAlive()) return GLib.SOURCE_REMOVE;
            if (this.isWidgetValid(this.scrollWindow) && this.isWidgetValid(this.textView)) {
                const adj = this.scrollWindow.get_vadjustment();
                adj.set_value(adj.get_upper() - adj.get_page_size());
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    updateCountBadge() {
        if (!this.canUseWidgets(this.countLabel)) return;
        if (this.logCount > 0) {
            this.countLabel.set_label(`(${this.logCount})`);
            this.countLabel.set_visible(true);
            return;
        }
        this.countLabel.set_visible(false);
    }

    updateToggleButton() {
        if (!this.canUseWidgets(this.toggleButton)) return;
        const arrow = this.isExpanded ? 'v' : '>';
        this.toggleButton.set_image(new Gtk.Label({label: arrow}));
    }

    toggle() {
        if (this.isExpanded) {
            this.collapse();
            return;
        }
        this.expand();
    }

    expand() {
        if (!this.ensureAlive()) return;
        if (!this.isVisible) {
            this.showPanel();
            return;
        }
        this.isExpanded = true;
        if (!this.hasWidgets(this.contentBox, this.container)) return;
        this.contentBox.set_no_show_all(false);
        this.contentBox.set_visible(true);
        this.contentBox.show_all();
        this.updateToggleButton();
        this.container.get_style_context().add_class('expanded');
    }

    collapse() {
        if (!this.ensureAlive()) return;
        this.isExpanded = false;
        if (!this.hasWidgets(this.contentBox, this.container)) return;
        this.contentBox.set_visible(false);
        this.contentBox.set_no_show_all(true);
        this.updateToggleButton();
        this.container.get_style_context().remove_class('expanded');
    }

    clear() {
        if (!this.canUseTextOutput()) return;
        this.textBuffer.set_text('', 0);
        this.logCount = 0;
        this.updateCountBadge();
    }

    showPanel() {
        if (!this.canUseWidgets(this.container)) return;

        if (this.isVisible) {
            if (!this.isExpanded) this.expand();
            return;
        }

        if (this.parentContainer && !this.container.get_parent?.() && this.isWidgetValid(this.parentContainer)) {
            this.parentContainer.pack_start(this.container, false, false, 0);
            if (this.positionInParent >= 0) {
                this.parentContainer.reorder_child(this.container, this.positionInParent);
            }
        }

        this.container.set_no_show_all(false);
        this.container.set_visible(true);
        this.container.show_all();
        this.isVisible = true;
        this.expand();
    }

    hidePanel() {
        if (!this.canUseWidgets(this.container)) return;

        this.isVisible = false;
        this.isExpanded = false;

        const parent = this.container.get_parent?.();
        if (parent && this.isWidgetValid(parent)) {
            const children = parent.get_children?.() || [];
            this.positionInParent = children.indexOf(this.container);
            this.parentContainer = parent;
            parent.remove(this.container);
        }

        if (this.isWidgetValid(this.contentBox)) {
            this.contentBox.visible = false;
            this.contentBox.set_no_show_all(true);
        }
        if (this.isWidgetValid(this.container)) {
            this.container.get_style_context().remove_class('expanded');
        }

        this.updateToggleButton();
        this.onAdaptWindowSize();
    }

    show() {
        this.showPanel();
    }

    hide() {
        this.hidePanel();
    }

    destroy() {
        this.isDestroyed = true;

        if (this.autoHideTimerId) {
            GLib.source_remove(this.autoHideTimerId);
            this.autoHideTimerId = null;
        }

        if (this.eventBus && this.subscriptionIds.length > 0) {
            this.subscriptionIds.forEach(({eventName, listenerId}) => {
                if (eventName && listenerId) {
                    this.eventBus.off?.(eventName, listenerId);
                }
            });
        }
        this.subscriptionIds = [];

        this.container = null;
        this.contentBox = null;
        this.textView = null;
        this.textBuffer = null;
        this.scrollWindow = null;
        this.headerBox = null;
        this.toggleButton = null;
        this.clearButton = null;
        this.closeButton = null;
        this.countLabel = null;
        this.titleLabel = null;
        this.activeImports = 0;
    }

    getWidget() {
        return this.container;
    }
}
