import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GLib from 'gi://GLib';
import { addPointerCursor, applyOptionalSetters } from '../../../common/ViewUtils.js';

export function applyAdvancedTabExecutionPropertiesTiming(targetPrototype) {
    targetPrototype.showTimingSettingsPopup = function() {
        const popup = new Gtk.Window({
            type: Gtk.WindowType.TOPLEVEL,
            decorated: true,
            resizable: false,
            modal: true,
            title: this.t('TIMING_SETTINGS'),
            default_width: 450,
            default_height: 420
        });

        applyOptionalSetters([[this.view?.window, (window) => popup.set_transient_for(window), Boolean]]);

        popup.connect('delete-event', () => {
            popup.hide();
            return true;
        });

        popup.connect('key-press-event', (_widget, event) => {
            return event.get_keyval()[1] === Gdk.KEY_Escape
                ? (popup.hide(), true)
                : false;
        });

        this._timingStylesApplied ||= true;

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        mainBox.get_style_context().add_class('timing-popup-main');

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        headerBox.get_style_context().add_class('timing-header');

        headerBox.pack_start(this.createClassedLabel(this.t('TIMING_SETTINGS'), 'timing-header-title'), false, false, 0);
        headerBox.pack_start(
            this.createClassedLabel(this.t('TIMING_SETTINGS_DESC'), 'timing-header-subtitle', {wrap: true}),
            false,
            false,
            0
        );

        mainBox.pack_start(headerBox, false, false, 0);

        const notebook = new Gtk.Notebook();
        notebook.set_tab_pos(Gtk.PositionType.TOP);

        const mainTimingConfigs = [
            {
                key: 'alt_timeout',
                labelKey: 'TIMEOUT_ALT_BAR',
                descKey: 'TIMEOUT_ALT_BAR_DESC',
                min: 0.1,
                max: 10.0,
                step: 0.1,
                digits: 1,
                defaultVal: 2.0
            },
            {
                key: 'daemon_start_timeout',
                labelKey: 'TIMEOUT_DAEMON_START',
                descKey: 'TIMEOUT_DAEMON_START_DESC',
                min: 0.05,
                max: 5.0,
                step: 0.05,
                digits: 2,
                defaultVal: 0.1
            },
            {
                key: 'post_install_delay',
                labelKey: 'TIMEOUT_POST_INSTALL',
                descKey: 'TIMEOUT_POST_INSTALL_DESC',
                min: 0.0,
                max: 3.0,
                step: 0.1,
                digits: 1,
                defaultVal: 0.1
            },
            {
                key: 'post_reload_delay',
                labelKey: 'TIMEOUT_POST_RELOAD',
                descKey: 'TIMEOUT_POST_RELOAD_DESC',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                digits: 1,
                defaultVal: 0.1
            }
        ];

        const pollingConfigs = [
            {
                key: 'bar_check_interval',
                labelKey: 'TIMEOUT_BAR_CHECK',
                descKey: 'TIMEOUT_BAR_CHECK_DESC',
                min: 0.05,
                max: 1.0,
                step: 0.05,
                digits: 2,
                defaultVal: 0.1
            },
            {
                key: 'terminal_poll_interval',
                labelKey: 'TIMEOUT_TERMINAL_POLL',
                descKey: 'TIMEOUT_TERMINAL_POLL_DESC',
                min: 0.05,
                max: 0.5,
                step: 0.05,
                digits: 2,
                defaultVal: 0.1
            },
            {
                key: 'wallpaper_retry_delay',
                labelKey: 'TIMEOUT_WALLPAPER_RETRY',
                descKey: 'TIMEOUT_WALLPAPER_RETRY_DESC',
                min: 0.1,
                max: 2.0,
                step: 0.1,
                digits: 1,
                defaultVal: 0.5
            },
            {
                key: 'daemon_poll_interval',
                labelKey: 'TIMEOUT_DAEMON_POLL',
                descKey: 'TIMEOUT_DAEMON_POLL_DESC',
                min: 0.05,
                max: 0.5,
                step: 0.05,
                digits: 2,
                defaultVal: 0.1
            }
        ];

        const systemConfigs = [
            {
                key: 'window_operation_delay',
                labelKey: 'TIMEOUT_WINDOW_OPERATION',
                descKey: 'TIMEOUT_WINDOW_OPERATION_DESC',
                min: 0.01,
                max: 0.5,
                step: 0.01,
                digits: 2,
                defaultVal: 0.05
            },
            {
                key: 'process_cleanup_delay',
                labelKey: 'TIMEOUT_PROCESS_CLEANUP',
                descKey: 'TIMEOUT_PROCESS_CLEANUP_DESC',
                min: 0.01,
                max: 0.5,
                step: 0.01,
                digits: 2,
                defaultVal: 0.05
            },
            {
                key: 'script_file_wait_interval',
                labelKey: 'TIMEOUT_SCRIPT_FILE_WAIT',
                descKey: 'TIMEOUT_SCRIPT_FILE_WAIT_DESC',
                min: 0.1,
                max: 1.0,
                step: 0.1,
                digits: 1,
                defaultVal: 0.2
            }
        ];

        const spinButtonsToRefresh = [];

        const buildTimingRows = (configs, container) => {
            for (const config of configs) {
                const rowBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4
                });
                rowBox.get_style_context().add_class('timing-row');

                const labelBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8
                });

                const label = this.createClassedLabel(this.t(config.labelKey), 'timing-label');
                labelBox.pack_start(label, true, true, 0);

                const currentValue = typeof this.settings[config.key] === 'number'
                    ? this.settings[config.key]
                    : config.defaultVal;

                const spinButton = new Gtk.SpinButton({
                    adjustment: new Gtk.Adjustment({
                        value: currentValue,
                        lower: config.min,
                        upper: config.max,
                        step_increment: config.step,
                        page_increment: config.step * 10,
                        page_size: 0
                    }),
                    climb_rate: config.step,
                    digits: config.digits,
                    numeric: true,
                    width_chars: 6
                });

                spinButtonsToRefresh.push({spinButton, value: currentValue});

                spinButton.connect('value-changed', () => {
                    this.settings[config.key] = spinButton.get_value();
                });

                labelBox.pack_end(spinButton, false, false, 0);
                rowBox.pack_start(labelBox, false, false, 0);

                const descLabel = this.createClassedLabel(
                    this.t(config.descKey),
                    'timing-desc',
                    {wrap: true, xalign: 0}
                );
                rowBox.pack_start(descLabel, false, false, 0);

                container.pack_start(rowBox, false, false, 0);
            }
        };

        const tab1Content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        tab1Content.get_style_context().add_class('timing-content');
        buildTimingRows(mainTimingConfigs, tab1Content);

        notebook.append_page(tab1Content, this.createTabLabel(this.t('TIMING_TAB_MAIN') || 'Main'));

        const tab2Content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        tab2Content.get_style_context().add_class('timing-content');
        buildTimingRows(pollingConfigs, tab2Content);

        notebook.append_page(tab2Content, this.createTabLabel(this.t('TIMING_TAB_POLLING') || 'Polling'));

        const tab3Content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });
        tab3Content.get_style_context().add_class('timing-content');
        buildTimingRows(systemConfigs, tab3Content);

        notebook.append_page(tab3Content, this.createTabLabel(this.t('TIMING_TAB_SYSTEM') || 'System'));

        mainBox.pack_start(notebook, true, true, 0);

        const noteBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_start: 16,
            margin_end: 16,
            margin_bottom: 8
        });
        noteBox.pack_start(
            this.createClassedLabel(this.t('TIMING_NOTE'), 'timing-note', {wrap: true, xalign: 0}),
            false,
            false,
            0
        );
        mainBox.pack_start(noteBox, false, false, 0);

        const footerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL
        });
        footerBox.get_style_context().add_class('timing-footer');

        footerBox.pack_start(new Gtk.Box({hexpand: true}), true, true, 0);

        const closeBtn = new Gtk.Button({label: this.t('CLOSE') || 'Close'});
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => popup.hide());
        footerBox.pack_end(closeBtn, false, false, 0);

        mainBox.pack_start(footerBox, false, false, 0);

        popup.add(mainBox);
        popup.show_all();

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            for (const {spinButton, value} of spinButtonsToRefresh) {
                spinButton.set_value(value);
            }
            return GLib.SOURCE_REMOVE;
        });
    };
}
