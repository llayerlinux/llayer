import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor } from '../../common/ViewUtils.js';

export const TweaksPluginsTabTerminal = {
    initPluginsTerminal() {
        const terminalText = new Gtk.TextView();
        terminalText.set_editable(false);
        terminalText.set_cursor_visible(false);
        terminalText.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
        terminalText.set_left_margin(10);
        terminalText.set_right_margin(10);
        terminalText.set_top_margin(10);
        terminalText.set_bottom_margin(10);
        terminalText.get_style_context().add_class('terminal-text');

        const terminalScroll = new Gtk.ScrolledWindow();
        terminalScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        terminalScroll.set_size_request(-1, 180);
        terminalScroll.get_style_context().add_class('terminal-output');
        terminalScroll.add(terminalText);

        const collapseBtn = new Gtk.Button({label: `\u25B2 ${this.translate('HIDE')}`});
        collapseBtn.get_style_context().add_class('terminal-collapse-btn');
        addPointerCursor(collapseBtn);

        const terminalContainer = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 0, margin_top: 4});
        terminalContainer.pack_start(terminalScroll, true, true, 0);
        terminalContainer.pack_start(collapseBtn, false, false, 0);
        terminalContainer.set_no_show_all(true);
        terminalContainer.set_visible(false);

        const terminalBuffer = terminalText.get_buffer();
        const state = {
            isRunning: false,
            terminalOpen: false,
            currentTerminalParent: null
        };

        const showTerminalAt = (parent, afterWidget) => {
            if (state.currentTerminalParent && terminalContainer.get_parent()) {
                state.currentTerminalParent.remove(terminalContainer);
            }

            if (afterWidget) {
                let children = parent.get_children(),
                    idx = children.indexOf(afterWidget);
                parent.pack_start(terminalContainer, false, false, 0);
                idx >= 0 && parent.reorder_child(terminalContainer, idx + 1);
            } else {
                parent.pack_start(terminalContainer, false, false, 0);
            }

            state.currentTerminalParent = parent;
            terminalContainer.set_visible(true);
            terminalContainer.show();
            terminalScroll.show_all();
            collapseBtn.show();
            state.terminalOpen = true;
        };

        const setTerminalRunning = (val) => {
            state.isRunning = val;
        };

        const isTerminalRunning = () => state.isRunning;

        const hideTerminal = () => {
            terminalContainer.set_visible(false);
            state.terminalOpen = false;
        };

        this.terminalBuffer = terminalBuffer;
        this.terminalContainer = terminalContainer;
        this.terminalScroll = terminalScroll;
        this.collapseBtn = collapseBtn;
        this.showTerminalAt = showTerminalAt;
        this.isTerminalRunning = isTerminalRunning;
        this.setTerminalRunning = setTerminalRunning;
        this.hideTerminal = hideTerminal;
        this._pluginsTerminalState = state;

        collapseBtn.connect('clicked', () => {
            hideTerminal();
        });

        return {
            terminalText,
            terminalBuffer,
            terminalContainer,
            terminalScroll,
            collapseBtn,
            state
        };
    }
};
