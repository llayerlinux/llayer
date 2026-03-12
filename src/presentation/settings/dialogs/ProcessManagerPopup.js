import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import Pango from 'gi://Pango';
import { tryOrDefault, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';
import {addPointerCursor} from '../../common/ViewUtils.js';

const PROCESS_CATEGORIES = {
    bars: {
        priority: 1,
        label: 'PROC_CAT_BARS',
        color: '#f59e0b',
        processes: ['waybar', 'eww', 'ags', 'polybar', 'ironbar', 'sfwbar', 'yambar', 'nwg-panel'],
        startCommands: {
            waybar: 'waybar &',
            eww: 'eww daemon && eww open bar',
            ags: 'ags &',
            polybar: 'polybar &'
        },
        conflictGroup: 'bar'
    },
    wallpaper: {
        priority: 2,
        label: 'PROC_CAT_WALLPAPER',
        color: '#3b82f6',
        processes: ['swww', 'swww-daemon', 'hyprpaper', 'swaybg', 'mpvpaper', 'wpaperd'],
        startCommands: {
            'swww-daemon': 'swww-daemon &',
            swww: 'swww-daemon &',
            hyprpaper: 'hyprpaper &',
            swaybg: 'swaybg -i ~/wallpaper.png &'
        },
        conflictGroup: 'wallpaper'
    },
    notifications: {
        priority: 3,
        label: 'PROC_CAT_NOTIFICATIONS',
        color: '#8b5cf6',
        processes: ['dunst', 'mako', 'swaync', 'fnott', 'linux_notification_center'],
        startCommands: {
            dunst: 'dunst &',
            mako: 'mako &',
            swaync: 'swaync &'
        },
        conflictGroup: 'notification'
    },
    launchers: {
        priority: 4,
        label: 'PROC_CAT_LAUNCHERS',
        color: '#10b981',
        processes: ['rofi', 'wofi', 'fuzzel', 'tofi', 'bemenu', 'dmenu', 'nwg-drawer'],
        startCommands: {}
    },
    widgets: {
        priority: 5,
        label: 'PROC_CAT_WIDGETS',
        color: '#ec4899',
        processes: ['conky', 'eww-daemon', 'nwg-dock', 'nwg-dock-hyprland'],
        startCommands: {
            conky: 'conky &',
            'nwg-dock-hyprland': 'nwg-dock-hyprland &'
        }
    },
    clipboard: {
        priority: 6,
        label: 'PROC_CAT_CLIPBOARD',
        color: '#06b6d4',
        processes: ['wl-paste', 'wl-copy', 'cliphist', 'clipman', 'copyq'],
        startCommands: {
            cliphist: 'wl-paste --watch cliphist store &'
        }
    },
    display: {
        priority: 7,
        label: 'PROC_CAT_DISPLAY',
        color: '#84cc16',
        processes: ['wlsunset', 'gammastep', 'kanshi', 'way-displays', 'wlr-randr'],
        startCommands: {
            wlsunset: 'wlsunset &',
            gammastep: 'gammastep &',
            kanshi: 'kanshi &'
        }
    },
    idle: {
        priority: 8,
        label: 'PROC_CAT_IDLE',
        color: '#f97316',
        processes: ['swayidle', 'hypridle', 'swaylock', 'hyprlock', 'gtklock'],
        startCommands: {
            hypridle: 'hypridle &',
            swayidle: 'swayidle &'
        },
        conflictGroup: 'idle'
    },
    hyprland: {
        priority: 0,
        label: 'PROC_CAT_HYPRLAND',
        color: '#ef4444',
        processes: ['Hyprland', 'hyprctl', 'hyprpm', 'xdg-desktop-portal-hyprland'],
        startCommands: {}
    },
    other: {
        priority: 9,
        label: 'PROC_CAT_OTHER',
        color: '#6b7280',
        processes: [],
        startCommands: {}
    }
};

const PROTECTED_PROCESSES = [
    'Hyprland', 'systemd', 'dbus-daemon', 'pipewire', 'pipewire-pulse',
    'wireplumber', 'polkit', 'gnome-keyring', 'xdg-desktop-portal',
    'xdg-desktop-portal-gtk', 'xdg-desktop-portal-hyprland'
];

const QUICK_START_DAEMONS = [
    {name: 'waybar', label: 'Waybar', command: 'waybar &', category: 'bars'},
    {name: 'swww-daemon', label: 'SWWW', command: 'swww-daemon &', category: 'wallpaper'},
    {name: 'dunst', label: 'Dunst', command: 'dunst &', category: 'notifications'},
    {name: 'mako', label: 'Mako', command: 'mako &', category: 'notifications'},
    {name: 'hypridle', label: 'Hypridle', command: 'hypridle &', category: 'idle'},
    {name: 'cliphist', label: 'Cliphist', command: 'wl-paste --watch cliphist store &', category: 'clipboard'}
];

const STUCK_INDICATORS = {
    zombie: 'Z',
    stopped: 'T',
    highCpu: 90,
    highMem: 500,
    multipleInstances: 2
};

const ALLOWED_MULTIPLE = ['wl-paste', 'wl-copy', 'hyprctl'];

function getPriorityIcon(priority, isStuck) {
    if (isStuck) return 'СЂСџвЂќТ‘';

    switch (true) {
        case priority === 0:
            return 'СЂСџвЂќТ‘';
        case priority <= 2:
            return 'СЂСџСџРЋ';
        case priority >= 8:
            return 'РІС™Р„';
        default:
            return 'СЂСџСџСћ';
    }
}

export class ProcessManagerPopup {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.parentWindow = deps.parentWindow || null;
        this.settingsManager = deps.settingsManager || null;
        this.dialog = null;
        this.processRows = new Map();
        this.refreshTimerId = null;
        this.isDestroyed = false;
        this.conflictsLabel = null;
        this.quickStartButtons = new Map();
        this.riceDaemonDots = {};
        this.home = GLib.get_home_dir();
    }

    open() {
        this.dialog = new Gtk.Dialog({
            title: this.t('PROC_MANAGER_TITLE'),
            transient_for: this.parentWindow,
            modal: true,
            resizable: true,
            default_width: 750,
            default_height: 780
        });

        this.dialog.get_style_context().add_class('lastlayer-settings-dialog');

        this.ensureCssLoaded();

        const contentArea = this.dialog.get_content_area();
        contentArea.set_spacing(8);
        contentArea.set_margin_top(12);
        contentArea.set_margin_bottom(12);
        contentArea.set_margin_start(12);
        contentArea.set_margin_end(12);

        const notebook = new Gtk.Notebook();
        notebook.set_show_border(true);

        const processesTab = this.buildProcessesTab();
        notebook.append_page(processesTab, new Gtk.Label({label: this.t('PROC_TAB_RUNNING')}));

        const actionsTab = this.buildActionsTab();
        notebook.append_page(actionsTab, new Gtk.Label({label: this.t('PROC_TAB_ACTIONS')}));

        const conflictsTab = this.buildConflictsTab();
        notebook.append_page(conflictsTab, new Gtk.Label({label: this.t('PROC_TAB_CONFLICTS')}));

        contentArea.pack_start(notebook, true, true, 0);

        const closeBtn = this.dialog.add_button(this.t('CLOSE'), Gtk.ResponseType.CLOSE);
        closeBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(closeBtn);

        this.dialog.connect('response', () => {
            this.stopAutoRefresh();
            this.isDestroyed = true;
            this.dialog.destroy();
        });

        this.dialog.connect('destroy', () => {
            this.stopAutoRefresh();
            this.isDestroyed = true;
        });

        this.dialog.show_all();

        this.refreshAll();
        this.startAutoRefresh();
    }

    ensureCssLoaded() {
        if (ProcessManagerPopup.cssLoaded) {
            return;
        }

        const css = new Gtk.CssProvider();
        css.load_from_data(`
            .success-label { color: #33d17a; font-weight: 600; }

            .qa-section-header {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.5px;
                color: #888;
                margin-top: 4px;
                margin-bottom: 6px;
            }

            .qa-action-btn {
                padding: 6px 14px;
                min-height: 28px;
                border-radius: 6px;
                font-size: 12px;
            }

            .qa-daemon-active {
                border: 1px solid #33d17a;
                color: #33d17a;
            }
            .qa-daemon-active:hover {
                background-color: rgba(51, 209, 122, 0.1);
            }

            .qa-danger-btn {
                background-color: rgba(100, 100, 100, 0.3);
                color: #ef4444;
            }
            .qa-danger-btn:hover {
                background-color: rgba(239, 68, 68, 0.15);
            }

            .qa-dot-active { color: #33d17a; font-size: 10px; }
            .qa-dot-inactive { color: #555; font-size: 10px; }

            .qa-info-card {
                background-color: rgba(45, 55, 72, 0.6);
                border-radius: 8px;
                padding: 10px 14px;
            }

            .qa-separator {
                background-color: rgba(255, 255, 255, 0.08);
                min-height: 1px;
                margin-top: 8px;
                margin-bottom: 8px;
            }

            .proc-legend {
                padding: 8px 12px;
                background-color: rgba(40, 40, 40, 0.5);
                border-radius: 6px;
                margin-bottom: 8px;
            }
            .proc-legend-item {
                margin-right: 12px;
            }
            .proc-legend-dot {
                font-size: 10px;
                margin-right: 4px;
            }
            .proc-legend-label {
                font-size: 11px;
                color: #888;
            }

            .proc-row {
                background-color: rgba(42, 42, 42, 0.6);
                border-radius: 8px;
                padding: 10px 12px;
                margin-bottom: 6px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .proc-row:hover {
                background-color: rgba(50, 50, 50, 0.8);
            }
            .proc-row-stuck {
                border-color: rgba(239, 68, 68, 0.4);
                background-color: rgba(239, 68, 68, 0.08);
            }
            .proc-priority-dot {
                font-size: 12px;
                min-width: 16px;
            }
            .proc-name {
                font-size: 13px;
                font-weight: 500;
            }
            .proc-pid {
                font-size: 11px;
                color: #666;
            }
            .proc-category {
                font-size: 11px;
                padding: 1px 6px;
                border-radius: 3px;
                background-color: rgba(0, 0, 0, 0.2);
            }
            .proc-stats {
                font-size: 11px;
                color: #777;
            }
            .proc-action-btn {
                min-width: 28px;
                min-height: 24px;
                padding: 2px 8px;
                font-size: 11px;
                border-radius: 4px;
            }
            .proc-kill-btn {
                background-color: rgba(239, 68, 68, 0.15);
                color: #ef4444;
            }
            .proc-kill-btn:hover {
                background-color: rgba(239, 68, 68, 0.25);
            }
            .proc-footer {
                padding-top: 12px;
                margin-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }
        `);
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        ProcessManagerPopup.cssLoaded = true;
    }


    buildProcessesTab() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12
        });

        const legendBox = this.buildLegend();
        box.pack_start(legendBox, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_hexpand(true);
        scrolled.set_vexpand(true);
        scrolled.set_min_content_height(250);

        this.processListBox = new Gtk.ListBox();
        this.processListBox.set_selection_mode(Gtk.SelectionMode.NONE);
        scrolled.add(this.processListBox);
        box.pack_start(scrolled, true, true, 0);

        const actionBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        actionBox.get_style_context().add_class('proc-footer');

        const refreshBtn = new Gtk.Button({label: this.t('PROC_REFRESH') || 'Refresh'});
        refreshBtn.get_style_context().add_class('proc-action-btn');
        addPointerCursor(refreshBtn);
        refreshBtn.connect('clicked', () => this.refreshAll());
        actionBox.pack_start(refreshBtn, false, false, 0);

        const killAllStuckBtn = new Gtk.Button({label: this.t('PROC_KILL_ALL_STUCK') || 'Kill All Stuck'});
        killAllStuckBtn.get_style_context().add_class('proc-action-btn');
        killAllStuckBtn.get_style_context().add_class('proc-kill-btn');
        addPointerCursor(killAllStuckBtn);
        killAllStuckBtn.connect('clicked', () => this.killAllStuck());
        actionBox.pack_start(killAllStuckBtn, false, false, 0);

        box.pack_start(actionBox, false, false, 0);

        return box;
    }

    buildLegend() {
        const legendBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
        legendBox.get_style_context().add_class('proc-legend');

        const priorities = [
            {color: '#ef4444', label: this.t('PROC_PRIORITY_CRITICAL') || 'Critical'},
            {color: '#f59e0b', label: this.t('PROC_PRIORITY_WARNING') || 'Warning'},
            {color: '#33d17a', label: this.t('PROC_PRIORITY_NORMAL') || 'Normal'},
            {color: '#6b7280', label: this.t('PROC_PRIORITY_LOW') || 'Low'}
        ];

        for (const p of priorities) {
            const itemBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4});
            itemBox.get_style_context().add_class('proc-legend-item');

            const dot = new Gtk.Label({label: 'в—Џ'});
            dot.get_style_context().add_class('proc-legend-dot');
            dot.set_markup(`<span color="${p.color}">в—Џ</span>`);
            itemBox.pack_start(dot, false, false, 0);

            const label = new Gtk.Label({label: p.label});
            label.get_style_context().add_class('proc-legend-label');
            itemBox.pack_start(label, false, false, 0);

            legendBox.pack_start(itemBox, false, false, 0);
        }

        return legendBox;
    }


    buildActionsTab() {
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 16,
            margin_end: 16
        });

        const riceStatusCard = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        riceStatusCard.get_style_context().add_class('qa-info-card');

        const headerRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10});
        const riceLabel = new Gtk.Label({label: 'Active Rice', halign: Gtk.Align.START});
        riceLabel.get_style_context().add_class('dim-label');
        headerRow.pack_start(riceLabel, false, false, 0);
        this.riceThemeNameLabel = new Gtk.Label({label: '...', halign: Gtk.Align.START});
        this.riceThemeNameLabel.set_markup('<b>...</b>');
        headerRow.pack_start(this.riceThemeNameLabel, false, false, 0);
        riceStatusCard.pack_start(headerRow, false, false, 0);

        const daemonsRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 16});
        this.riceDaemonLabels = {};
        this.riceDaemonDots = {};

        const categories = [
            {key: 'bar', label: 'Bar'},
            {key: 'wallpaper', label: 'Wallpaper'},
            {key: 'notifications', label: 'Notif'}
        ];

        for (const cat of categories) {
            const catBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});

            const dot = new Gtk.Label({label: 'в—Џ'});
            dot.get_style_context().add_class('qa-dot-inactive');
            catBox.pack_start(dot, false, false, 0);
            this.riceDaemonDots[cat.key] = dot;

            const catNameLabel = new Gtk.Label({label: cat.label + ':'});
            catNameLabel.get_style_context().add_class('dim-label');
            catBox.pack_start(catNameLabel, false, false, 0);

            const catLabel = new Gtk.Label({label: 'вЂ”'});
            catBox.pack_start(catLabel, false, false, 0);
            this.riceDaemonLabels[cat.key] = catLabel;

            daemonsRow.pack_start(catBox, false, false, 0);
        }
        riceStatusCard.pack_start(daemonsRow, false, false, 0);

        this.ricePathLabel = new Gtk.Label({label: '', halign: Gtk.Align.START, ellipsize: Pango.EllipsizeMode.MIDDLE});
        this.ricePathLabel.get_style_context().add_class('dim-label');
        riceStatusCard.pack_start(this.ricePathLabel, false, false, 0);

        box.pack_start(riceStatusCard, false, false, 0);

        const riceActionsHeader = new Gtk.Label({label: 'RICE ACTIONS', halign: Gtk.Align.START});
        riceActionsHeader.get_style_context().add_class('qa-section-header');
        box.pack_start(riceActionsHeader, false, false, 0);

        const riceActionsGrid = new Gtk.Grid();
        riceActionsGrid.set_row_spacing(8);
        riceActionsGrid.set_column_spacing(8);
        riceActionsGrid.set_column_homogeneous(true);

        const restartBarBtn = this.createActionButton('Restart Bar', 'Restart detected bar daemon');
        restartBarBtn.connect('clicked', () => this.restartThemeDaemon('bars'));
        riceActionsGrid.attach(restartBarBtn, 0, 0, 1, 1);

        const restartWallBtn = this.createActionButton('Restart Wallpaper', 'Restart detected wallpaper daemon');
        restartWallBtn.connect('clicked', () => this.restartThemeDaemon('wallpaper'));
        riceActionsGrid.attach(restartWallBtn, 1, 0, 1, 1);

        const restartNotifBtn = this.createActionButton('Restart Notif', 'Restart detected notification daemon');
        restartNotifBtn.connect('clicked', () => this.restartThemeDaemon('notifications'));
        riceActionsGrid.attach(restartNotifBtn, 2, 0, 1, 1);

        const reapplyWallBtn = this.createActionButton('Reapply Wallpaper', 'Re-apply wallpaper from rice directory');
        reapplyWallBtn.connect('clicked', () => this.reapplyThemeWallpaper());
        riceActionsGrid.attach(reapplyWallBtn, 0, 1, 1, 1);

        const reloadCfgBtn = this.createActionButton('Reload Configs', 'hyprctl reload + re-source Hyprland configs');
        reloadCfgBtn.connect('clicked', () => this.reloadThemeConfigs());
        riceActionsGrid.attach(reloadCfgBtn, 1, 1, 1, 1);

        const openDirBtn = this.createActionButton('Open Directory', 'Open rice directory in file manager');
        openDirBtn.connect('clicked', () => this.openThemeDirectory());
        riceActionsGrid.attach(openDirBtn, 2, 1, 1, 1);

        box.pack_start(riceActionsGrid, false, false, 0);

        const sep1 = new Gtk.Box();
        sep1.get_style_context().add_class('qa-separator');
        box.pack_start(sep1, false, false, 0);

        const quickStartHeader = new Gtk.Label({label: 'QUICK START DAEMONS', halign: Gtk.Align.START});
        quickStartHeader.get_style_context().add_class('qa-section-header');
        box.pack_start(quickStartHeader, false, false, 0);

        const quickStartDesc = new Gtk.Label({
            label: 'Start common UI daemons. Green border indicates running.',
            halign: Gtk.Align.START,
            wrap: true
        });
        quickStartDesc.get_style_context().add_class('dim-label');
        box.pack_start(quickStartDesc, false, false, 0);

        const daemonGrid = new Gtk.Grid();
        daemonGrid.set_row_spacing(8);
        daemonGrid.set_column_spacing(8);
        daemonGrid.set_column_homogeneous(true);
        daemonGrid.set_margin_top(8);

        let col = 0, row = 0;
        for (const daemon of QUICK_START_DAEMONS) {
            const btn = this.createActionButton(daemon.label, daemon.command);
            btn.connect('clicked', () => this.startDaemon(daemon.name, daemon.command));
            this.quickStartButtons.set(daemon.name, btn);
            daemonGrid.attach(btn, col, row, 1, 1);
            col++;
            if (col >= 3) {
                col = 0;
                row++;
            }
        }
        box.pack_start(daemonGrid, false, false, 0);

        const sep2 = new Gtk.Box();
        sep2.get_style_context().add_class('qa-separator');
        box.pack_start(sep2, false, false, 0);

        const catActionsHeader = new Gtk.Label({label: 'CATEGORY ACTIONS', halign: Gtk.Align.START});
        catActionsHeader.get_style_context().add_class('qa-section-header');
        box.pack_start(catActionsHeader, false, false, 0);

        const categoryGrid = new Gtk.Grid();
        categoryGrid.set_row_spacing(8);
        categoryGrid.set_column_spacing(8);
        categoryGrid.set_column_homogeneous(true);

        const restartBarsBtn = this.createActionButton('Restart All Bars', 'Restart all bar processes');
        restartBarsBtn.connect('clicked', () => this.restartCategory('bars'));
        categoryGrid.attach(restartBarsBtn, 0, 0, 1, 1);

        const restartWallpaperBtn = this.createActionButton('Restart All Wallpaper', 'Restart all wallpaper processes');
        restartWallpaperBtn.connect('clicked', () => this.restartCategory('wallpaper'));
        categoryGrid.attach(restartWallpaperBtn, 1, 0, 1, 1);

        const restartNotificationsBtn = this.createActionButton('Restart All Notif', 'Restart all notification processes');
        restartNotificationsBtn.connect('clicked', () => this.restartCategory('notifications'));
        categoryGrid.attach(restartNotificationsBtn, 2, 0, 1, 1);

        box.pack_start(categoryGrid, false, false, 0);

        const sep3 = new Gtk.Box();
        sep3.get_style_context().add_class('qa-separator');
        box.pack_start(sep3, false, false, 0);

        const prepHeader = new Gtk.Label({label: 'RICE PREPARATION', halign: Gtk.Align.START});
        prepHeader.get_style_context().add_class('qa-section-header');
        box.pack_start(prepHeader, false, false, 0);

        const prepDesc = new Gtk.Label({
            label: 'Prepare environment before applying a different rice.',
            halign: Gtk.Align.START,
            wrap: true
        });
        prepDesc.get_style_context().add_class('dim-label');
        box.pack_start(prepDesc, false, false, 0);

        const prepGrid = new Gtk.Grid();
        prepGrid.set_row_spacing(8);
        prepGrid.set_column_spacing(8);
        prepGrid.set_column_homogeneous(true);
        prepGrid.set_margin_top(8);

        const cleanSlateBtn = this.createActionButton('Clean Slate', 'Kill all UI daemons for a fresh start');
        cleanSlateBtn.get_style_context().add_class('qa-danger-btn');
        cleanSlateBtn.connect('clicked', () => this.cleanSlate());
        prepGrid.attach(cleanSlateBtn, 0, 0, 1, 1);

        const killUIBtn = this.createActionButton('Kill All UI', 'Kill all non-Hyprland UI processes');
        killUIBtn.connect('clicked', () => this.killAllUI());
        prepGrid.attach(killUIBtn, 1, 0, 1, 1);

        const reloadHyprBtn = this.createActionButton('Reload Hyprland', 'hyprctl reload');
        reloadHyprBtn.connect('clicked', () => this.reloadHyprland());
        prepGrid.attach(reloadHyprBtn, 2, 0, 1, 1);

        box.pack_start(prepGrid, false, false, 0);

        scrolled.add(box);

        this.updateRiceStatus();

        return scrolled;
    }

    createActionButton(label, tooltip) {
        const btn = new Gtk.Button({label});
        btn.get_style_context().add_class('qa-action-btn');
        btn.set_tooltip_text(tooltip);
        addPointerCursor(btn);
        return btn;
    }

    runSyncCommand(command, context) {
        return tryOrDefault(context, () => GLib.spawn_command_line_sync(command), null);
    }

    runAsyncCommand(command, context) {
        return tryRun(context, () => {
            GLib.spawn_command_line_async(command);
        });
    }

    scheduleRefresh(delayMs = 500, updateRiceStatus = false) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            updateRiceStatus && this.updateRiceStatus();
            this.refreshAll();
            return GLib.SOURCE_REMOVE;
        });
    }

    trimBackgroundCommand(command) {
        return command.replace(/\s*&\s*$/, '');
    }

    enumerateDirectory(dirPath, attributes, visitor, context) {
        return tryRun(context, () => {
            const dir = Gio.File.new_for_path(dirPath);
            if (!dir.query_exists(null)) {
                return;
            }

            const enumerator = dir.enumerate_children(attributes, Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null))) {
                if (visitor(info) === false) {
                    break;
                }
            }
            enumerator.close(null);
        });
    }


    buildConflictsTab() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12
        });

        const desc = new Gtk.Label({
            label: this.t('PROC_CONFLICTS_DESC'),
            halign: Gtk.Align.START,
            wrap: true
        });
        desc.get_style_context().add_class('dim-label');
        box.pack_start(desc, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_hexpand(true);
        scrolled.set_vexpand(true);
        scrolled.set_min_content_height(200);

        this.conflictsListBox = new Gtk.ListBox();
        this.conflictsListBox.set_selection_mode(Gtk.SelectionMode.NONE);
        scrolled.add(this.conflictsListBox);
        box.pack_start(scrolled, true, true, 0);

        const actionBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        actionBox.set_margin_top(8);

        const fixAllBtn = new Gtk.Button({label: this.t('PROC_FIX_ALL_CONFLICTS')});
        fixAllBtn.get_style_context().add_class('suggested-action');
        addPointerCursor(fixAllBtn);
        fixAllBtn.connect('clicked', () => this.fixAllConflicts());
        actionBox.pack_start(fixAllBtn, false, false, 0);

        const killDuplicatesBtn = new Gtk.Button({label: this.t('PROC_KILL_DUPLICATES')});
        addPointerCursor(killDuplicatesBtn);
        killDuplicatesBtn.connect('clicked', () => this.killDuplicates());
        actionBox.pack_start(killDuplicatesBtn, false, false, 0);

        box.pack_start(actionBox, false, false, 0);

        return box;
    }


    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            if (this.isDestroyed) return GLib.SOURCE_REMOVE;
            this.refreshAll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopAutoRefresh() {
        if (this.refreshTimerId) {
            GLib.source_remove(this.refreshTimerId);
            this.refreshTimerId = null;
        }
    }

    refreshAll() {
        if (this.isDestroyed) return;
        this.refreshProcessList();
        this.refreshConflicts();
        this.updateQuickStartButtons();
        this.updateRiceStatus();
    }

    refreshProcessList() {
        if (this.isDestroyed || !this.processListBox) return;

        const processes = this.scanProcesses();

        this.processListBox.foreach(child => this.processListBox.remove(child));
        this.processRows.clear();

        processes.sort((a, b) => {
            if (a.isStuck !== b.isStuck) return a.isStuck ? -1 : 1;
            return a.priority - b.priority;
        });

        if (processes.length === 0) {
            const emptyLabel = new Gtk.Label({
                label: this.t('PROC_NO_PROCESSES'),
                halign: Gtk.Align.CENTER
            });
            emptyLabel.get_style_context().add_class('dim-label');
            this.processListBox.add(emptyLabel);
        } else {
            for (const proc of processes) {
                const row = this.buildProcessRow(proc);
                this.processListBox.add(row);
                this.processRows.set(proc.pid, row);
            }
        }

        this.processListBox.show_all();
    }

    refreshConflicts() {
        if (this.isDestroyed || !this.conflictsListBox) return;

        const conflicts = this.detectConflicts();

        this.conflictsListBox.foreach(child => this.conflictsListBox.remove(child));

        if (conflicts.length === 0) {
            const noConflictsLabel = new Gtk.Label({
                label: this.t('PROC_NO_CONFLICTS'),
                halign: Gtk.Align.CENTER
            });
            noConflictsLabel.get_style_context().add_class('dim-label');
            this.conflictsListBox.add(noConflictsLabel);
        } else {
            for (const conflict of conflicts) {
                const row = this.buildConflictRow(conflict);
                this.conflictsListBox.add(row);
            }
        }

        this.conflictsListBox.show_all();
    }

    updateQuickStartButtons() {
        if (this.isDestroyed) return;

        const runningProcesses = this.scanProcesses();
        const runningNames = new Set(runningProcesses.map(p => p.name.toLowerCase()));

        for (const daemon of QUICK_START_DAEMONS) {
            const btn = this.quickStartButtons.get(daemon.name);
            if (!btn) continue;

            const isRunning = runningNames.has(daemon.name.toLowerCase()) ||
                runningNames.has(daemon.name.replace('-daemon', '').toLowerCase());

            if (isRunning) {
                btn.set_label(daemon.label);
                btn.get_style_context().add_class('qa-daemon-active');
                btn.set_tooltip_text(this.t('PROC_ALREADY_RUNNING') || 'Already running');
                btn.set_label(daemon.label);
                btn.get_style_context().remove_class('qa-daemon-active');
                btn.set_tooltip_text(daemon.command);
            }
        }
    }


    scanProcesses() {
        const results = [];
        const seenNames = new Map();

        const commandResult = this.runSyncCommand(
            'ps -eo pid,comm,state,%cpu,%mem,rss,args --no-headers',
            'ProcessManagerPopup.scanProcesses'
        );
        const [ok, stdout] = commandResult || [];
        if (!ok || !stdout) return results;

            const lines = new TextDecoder().decode(stdout).trim().split('\n');

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 7) continue;

                const pid = parseInt(parts[0]);
                const comm = parts[1];
                const state = parts[2];
                const cpu = parseFloat(parts[3]) || 0;
                const memPercent = parseFloat(parts[4]) || 0;
                const rss = parseInt(parts[5]) || 0;
                const args = parts.slice(6).join(' ');

                const categoryEntry = Object.entries(PROCESS_CATEGORIES).find(([, catInfo]) =>
                    catInfo.processes.some((processName) => comm.toLowerCase().includes(processName.toLowerCase()))
                );
                if (!categoryEntry) continue;
                const [category, categoryInfo] = categoryEntry;

                const count = (seenNames.get(comm) || 0) + 1;
                seenNames.set(comm, count);

                const isZombie = state === STUCK_INDICATORS.zombie;
                const isStopped = state === STUCK_INDICATORS.stopped;
                const isHighCpu = cpu > STUCK_INDICATORS.highCpu;
                const isHighMem = (rss / 1024) > STUCK_INDICATORS.highMem;
                const isMultiple = count > STUCK_INDICATORS.multipleInstances &&
                    !ALLOWED_MULTIPLE.includes(comm);

                const isStuck = isZombie || isStopped || isHighCpu || isHighMem;
                const isProtected = PROTECTED_PROCESSES.some((processName) =>
                    comm.toLowerCase() === processName.toLowerCase()
                );
                const priorityIcon = getPriorityIcon(categoryInfo.priority, isStuck);

                const stuckReasons = [];
                if (isZombie) stuckReasons.push('zombie');
                if (isStopped) stuckReasons.push('stopped');
                if (isHighCpu) stuckReasons.push(`CPU ${cpu.toFixed(1)}%`);
                if (isHighMem) stuckReasons.push(`MEM ${(rss / 1024).toFixed(0)}MB`);
                if (isMultiple) stuckReasons.push(`Г—${count}`);

                results.push({
                    pid,
                    name: comm,
                    category,
                    categoryLabel: this.t(categoryInfo.label),
                    categoryColor: categoryInfo.color,
                    conflictGroup: categoryInfo.conflictGroup,
                    priority: categoryInfo.priority,
                    priorityIcon,
                    state,
                    cpu,
                    memMB: rss / 1024,
                    args: args.substring(0, 50),
                    isStuck,
                    isProtected,
                    isMultiple,
                    stuckReasons,
                    instanceCount: count
                });
            }
        return results;
    }

    detectConflicts() {
        const processes = this.scanProcesses();
        const conflicts = [];

        const conflictGroups = new Map();
        for (const proc of processes) {
            if (!proc.conflictGroup) continue;
            const group = conflictGroups.get(proc.conflictGroup) || [];
            group.push(proc);
            conflictGroups.set(proc.conflictGroup, group);
        }

        for (const [groupName, procs] of conflictGroups) {
            const uniqueNames = new Set(procs.map(p => p.name));
            if (uniqueNames.size > 1) {
                conflicts.push({
                    type: 'multiple_daemons',
                    group: groupName,
                    label: this.t(`PROC_CONFLICT_${groupName.toUpperCase()}`),
                    processes: procs,
                    description: `${this.t('PROC_CONFLICT_MULTIPLE')}: ${[...uniqueNames].join(', ')}`
                });
            }
        }

        const nameCounts = new Map();
        for (const proc of processes) {
            const count = (nameCounts.get(proc.name) || 0) + 1;
            nameCounts.set(proc.name, count);
        }

        for (const [name, count] of nameCounts) {
            if (count > 1 && !ALLOWED_MULTIPLE.includes(name)) {
                const dupeProcs = processes.filter(p => p.name === name);
                conflicts.push({
                    type: 'duplicates',
                    group: 'duplicates',
                    label: this.t('PROC_CONFLICT_DUPLICATE'),
                    processes: dupeProcs,
                    description: `${name} Г— ${count}`
                });
            }
        }

        const stuckProcs = processes.filter(p => p.isStuck);
        if (stuckProcs.length > 0) {
            conflicts.push({
                type: 'stuck',
                group: 'stuck',
                label: this.t('PROC_CONFLICT_STUCK'),
                processes: stuckProcs,
                description: `${stuckProcs.length} ${this.t('PROC_STUCK_PROCESSES')}`
            });
        }

        return conflicts;
    }


    buildProcessRow(proc) {
        const row = new Gtk.ListBoxRow();
        row.set_activatable(false);

        const card = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            margin_top: 2,
            margin_bottom: 2,
            margin_start: 4,
            margin_end: 4
        });
        card.get_style_context().add_class('proc-row');
        if (proc.isStuck) {
            card.get_style_context().add_class('proc-row-stuck');
        }

        const priorityColors = {
            'рџ”ґ': '#ef4444',
            'рџџЎ': '#f59e0b',
            'рџџў': '#33d17a',
            'вљЄ': '#6b7280'
        };
        const dotColor = priorityColors[proc.priorityIcon] || '#6b7280';
        const priorityDot = new Gtk.Label();
        priorityDot.set_markup(`<span color="${dotColor}">в—Џ</span>`);
        priorityDot.get_style_context().add_class('proc-priority-dot');
        priorityDot.set_valign(Gtk.Align.CENTER);
        card.pack_start(priorityDot, false, false, 0);

        const infoBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 3});
        infoBox.set_hexpand(true);
        infoBox.set_valign(Gtk.Align.CENTER);

        const nameRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        const nameLabel = new Gtk.Label({
            label: proc.name,
            halign: Gtk.Align.START
        });
        nameLabel.get_style_context().add_class('proc-name');
        nameRow.pack_start(nameLabel, false, false, 0);

        const pidLabel = new Gtk.Label({
            label: `PID: ${proc.pid}`,
            halign: Gtk.Align.START
        });
        pidLabel.get_style_context().add_class('proc-pid');
        nameRow.pack_start(pidLabel, false, false, 0);

        infoBox.pack_start(nameRow, false, false, 0);

        const statusRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});

        const categoryLabel = new Gtk.Label();
        categoryLabel.set_markup(`<span color="${proc.categoryColor}">${proc.categoryLabel}</span>`);
        categoryLabel.get_style_context().add_class('proc-category');
        statusRow.pack_start(categoryLabel, false, false, 0);

        if (proc.isStuck && proc.stuckReasons.length > 0) {
            const stuckLabel = new Gtk.Label();
            stuckLabel.set_markup(`<span color="#ef4444">${proc.stuckReasons.join(', ')}</span>`);
            stuckLabel.get_style_context().add_class('proc-stats');
            statusRow.pack_start(stuckLabel, false, false, 0);
        } else {
            const statsLabel = new Gtk.Label({
                label: `CPU: ${proc.cpu.toFixed(1)}%  MEM: ${proc.memMB.toFixed(0)}MB`
            });
            statsLabel.get_style_context().add_class('proc-stats');
            statusRow.pack_start(statsLabel, false, false, 0);
        }

        infoBox.pack_start(statusRow, false, false, 0);
        card.pack_start(infoBox, true, true, 0);

        const actionBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        actionBox.set_valign(Gtk.Align.CENTER);

        if (!proc.isProtected) {
            const restartBtn = new Gtk.Button({label: 'в†»'});
            restartBtn.get_style_context().add_class('proc-action-btn');
            restartBtn.set_tooltip_text(this.t('PROC_RESTART') || 'Restart');
            addPointerCursor(restartBtn);
            restartBtn.connect('clicked', () => this.restartProcess(proc));
            actionBox.pack_start(restartBtn, false, false, 0);

            const killBtn = new Gtk.Button({label: this.t('PROC_KILL') || 'Kill'});
            killBtn.get_style_context().add_class('proc-action-btn');
            killBtn.get_style_context().add_class('proc-kill-btn');
            killBtn.set_tooltip_text(`kill ${proc.pid}`);
            addPointerCursor(killBtn);
            killBtn.connect('clicked', () => this.killProcess(proc.pid, proc.name));
            actionBox.pack_start(killBtn, false, false, 0);

            const forceBtn = new Gtk.Button({label: this.t('PROC_FORCE_KILL') || 'Force'});
            forceBtn.get_style_context().add_class('proc-action-btn');
            forceBtn.set_tooltip_text(`kill -9 ${proc.pid}`);
            addPointerCursor(forceBtn);
            forceBtn.connect('clicked', () => this.killProcess(proc.pid, proc.name, true));
            actionBox.pack_start(forceBtn, false, false, 0);
        } else {
            const protectedLabel = new Gtk.Label({label: this.t('PROC_PROTECTED') || 'Protected'});
            protectedLabel.get_style_context().add_class('proc-stats');
            actionBox.pack_start(protectedLabel, false, false, 0);
        }

        card.pack_start(actionBox, false, false, 0);

        row.add(card);
        return row;
    }

    buildConflictRow(conflict) {
        const row = new Gtk.ListBoxRow();
        row.set_activatable(false);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 8,
            margin_end: 8
        });

        const icon = conflict.type === 'stuck' ? 'рџ”ґ' : 'вљ пёЏ';
        const iconLabel = new Gtk.Label({label: icon});
        box.pack_start(iconLabel, false, false, 0);

        const infoBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2});
        infoBox.set_hexpand(true);

        const titleLabel = new Gtk.Label({
            label: `<b>${conflict.label}</b>`,
            use_markup: true,
            halign: Gtk.Align.START
        });
        infoBox.pack_start(titleLabel, false, false, 0);

        const descLabel = new Gtk.Label({
            label: conflict.description,
            halign: Gtk.Align.START
        });
        descLabel.get_style_context().add_class('dim-label');
        infoBox.pack_start(descLabel, false, false, 0);

        box.pack_start(infoBox, true, true, 0);

        const fixBtn = new Gtk.Button({label: this.t('PROC_FIX')});
        addPointerCursor(fixBtn);
        fixBtn.connect('clicked', () => this.fixConflict(conflict));
        box.pack_start(fixBtn, false, false, 0);

        row.add(box);
        return row;
    }


    killProcess(pid, name, force = false) {
        const signal = force ? '-9' : '-15';
        const killed = this.runSyncCommand(`kill ${signal} ${pid}`, `ProcessManagerPopup.killProcess.${name}`);
        killed && this.scheduleRefresh(500);
    }

    restartProcess(proc) {
        const categoryInfo = PROCESS_CATEGORIES[proc.category];
        const startCommand = categoryInfo?.startCommands?.[proc.name];

        this.killProcess(proc.pid, proc.name);

        if (startCommand) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this.runAsyncCommand(startCommand, `ProcessManagerPopup.restartProcess.${proc.name}`);
                this.scheduleRefresh(500);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    startDaemon(name, command) {
        this.runAsyncCommand(command, `ProcessManagerPopup.startDaemon.${name}`);
        this.scheduleRefresh(1000);
    }

    killAllStuck() {
        const processes = this.scanProcesses();
        const stuckProcesses = processes.filter(p => p.isStuck && !p.isProtected);

        for (const proc of stuckProcesses) {
            this.killProcess(proc.pid, proc.name, true);
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this.refreshAll();
            return GLib.SOURCE_REMOVE;
        });
    }

    killAllUI() {
        const processes = this.scanProcesses();
        const uiProcesses = processes.filter(p =>
            !p.isProtected &&
            p.category !== 'hyprland'
        );

        for (const proc of uiProcesses) {
            this.killProcess(proc.pid, proc.name);
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this.refreshAll();
            return GLib.SOURCE_REMOVE;
        });
    }

    cleanSlate() {
        const categoriesToKill = ['bars', 'wallpaper', 'notifications', 'widgets', 'idle'];
        const processes = this.scanProcesses();

        for (const proc of processes) {
            if (categoriesToKill.includes(proc.category) && !proc.isProtected) {
                this.killProcess(proc.pid, proc.name);
            }
        }

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this.refreshAll();
            return GLib.SOURCE_REMOVE;
        });
    }

    restartCategory(categoryName) {
        const processes = this.scanProcesses();
        const categoryProcesses = processes.filter(p => p.category === categoryName && !p.isProtected);
        const categoryInfo = PROCESS_CATEGORIES[categoryName];

        const toRestart = [];
        for (const proc of categoryProcesses) {
            if (categoryInfo?.startCommands?.[proc.name]) {
                toRestart.push({name: proc.name, command: categoryInfo.startCommands[proc.name]});
            }
            this.killProcess(proc.pid, proc.name);
        }

        if (toRestart.length > 0) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
                for (const daemon of toRestart) {
                    this.runAsyncCommand(daemon.command, `ProcessManagerPopup.restartCategory.${categoryName}.${daemon.name}`);
                }
                this.scheduleRefresh(500);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    reloadHyprland() {
        this.runSyncCommand('hyprctl reload', 'ProcessManagerPopup.reloadHyprland');
        this.scheduleRefresh(500);
    }

    fixConflict(conflict) {
        switch (conflict.type) {
            case 'multiple_daemons':
                for (const proc of conflict.processes.slice(1)) {
                    if (!proc.isProtected) {
                        this.killProcess(proc.pid, proc.name);
                    }
                }
                break;
            case 'duplicates':
                for (const proc of conflict.processes.slice(1)) {
                    this.killProcess(proc.pid, proc.name);
                }
                break;
            case 'stuck':
                for (const proc of conflict.processes) {
                    if (!proc.isProtected) {
                        this.killProcess(proc.pid, proc.name, true);
                    }
                }
                break;
            default:
                break;
        }

        this.scheduleRefresh(1000);
    }

    fixAllConflicts() {
        const conflicts = this.detectConflicts();
        for (const conflict of conflicts) {
            this.fixConflict(conflict);
        }
    }

    killDuplicates() {
        const conflicts = this.detectConflicts();
        const dupeConflicts = conflicts.filter(c => c.type === 'duplicates');
        for (const conflict of dupeConflicts) {
            this.fixConflict(conflict);
        }
    }


    readCurrentRiceNameFromFile() {
        return tryOrDefault('ProcessManagerPopup.getCurrentRiceName', () => {
            const themeFile = `${this.home}/.config/lastlayer_pref/current_theme`;
            if (!GLib.file_test(themeFile, GLib.FileTest.EXISTS)) {
                return null;
            }

            const [ok, content] = GLib.file_get_contents(themeFile);
            return ok ? (new TextDecoder().decode(content).trim() || null) : null;
        }, null);
    }

    getCurrentRiceName() {
        return this.readCurrentRiceNameFromFile() || this.settingsManager?.get?.('theme') || null;
    }

    getCurrentRicePath(themeName = this.getCurrentRiceName()) {
        return themeName ? `${this.home}/.config/themes/${themeName}` : null;
    }

    getCategoryConfig(categoryName) {
        return PROCESS_CATEGORIES[categoryName] || null;
    }

    listRunningProcessNames() {
        return tryOrDefault('ProcessManagerPopup.listRunningProcessNames', () => {
            const [ok, stdout] = this.runSyncCommand('ps -eo comm=', 'ProcessManagerPopup.listRunningProcessNames') || [];
            if (!ok || !stdout) {
                return [];
            }

            return new TextDecoder().decode(stdout).split('\n').map(line => line.trim()).filter(Boolean);
        }, []);
    }

    getCategoryStartCommand(categoryName, processName = null) {
        const commands = this.getCategoryConfig(categoryName)?.startCommands || {};
        return processName ? commands[processName] || null : Object.values(commands)[0] || null;
    }

    getRunningDaemonForCategory(categoryName) {
        const category = this.getCategoryConfig(categoryName);
        if (!category) return null;

        const runningNames = this.listRunningProcessNames();
        return category.processes.find(processName => runningNames.includes(processName)) || null;
    }

    updateRiceThemeLabels(themeName) {
        const displayName = themeName || 'No rice active';
        this.riceThemeNameLabel?.set_markup(`<b>${GLib.markup_escape_text(displayName, -1)}</b>`);
        this.ricePathLabel?.set_text(themeName ? `~/.config/themes/${themeName}/` : '');
    }

    updateRiceDaemonIndicator(label, dot, running) {
        label.set_text(running || '-');

        const labelStyles = label.get_style_context();
        const dotStyles = dot?.get_style_context?.();
        switch (Boolean(running)) {
            case true:
                labelStyles.remove_class('dim-label');
                labelStyles.add_class('success-label');
                dotStyles?.remove_class('qa-dot-inactive');
                dotStyles?.add_class('qa-dot-active');
                return;
            default:
                labelStyles.remove_class('success-label');
                labelStyles.add_class('dim-label');
                dotStyles?.remove_class('qa-dot-active');
                dotStyles?.add_class('qa-dot-inactive');
        }
    }

    updateRiceDaemonStatus(key, categoryName) {
        const label = this.riceDaemonLabels?.[key];
        if (!label) return;

        const dot = this.riceDaemonDots?.[key] || null;
        const running = this.getRunningDaemonForCategory(categoryName);
        this.updateRiceDaemonIndicator(label, dot, running);
    }

    updateRiceStatus() {
        const themeName = this.getCurrentRiceName();

        this.updateRiceThemeLabels(themeName);

        for (const [key, categoryName] of [['bar', 'bars'], ['wallpaper', 'wallpaper'], ['notifications', 'notifications']]) {
            this.updateRiceDaemonStatus(key, categoryName);
        }
    }

    scheduleThemeDaemonStart(command, context, delayMs = 0) {
        if (!command) {
            return false;
        }

        const runCommand = () => {
            this.runAsyncCommand(this.trimBackgroundCommand(command), context);
            this.scheduleRefresh(1000, true);
            return GLib.SOURCE_REMOVE;
        };

        switch (delayMs > 0) {
            case true:
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, runCommand);
                return true;
            default:
                runCommand();
                return true;
        }
    }

    restartThemeDaemon(categoryName) {
        const running = this.getRunningDaemonForCategory(categoryName);
        switch (Boolean(running)) {
            case true: {
                const startCommand = this.getCategoryStartCommand(categoryName, running);
                this.runSyncCommand(`pkill -x ${running}`, `ProcessManagerPopup.restartThemeDaemon.kill.${running}`);
                this.scheduleThemeDaemonStart(startCommand, `ProcessManagerPopup.restartThemeDaemon.start.${running}`, 800)
                    || this.scheduleRefresh(1000, true);
                return;
            }
            default:
                this.scheduleThemeDaemonStart(
                    this.getCategoryStartCommand(categoryName),
                    `ProcessManagerPopup.restartThemeDaemon.first.${categoryName}`
                );
        }
    }

    findThemeWallpaperFile(themePath) {
        const wallpaperPaths = [
            `${themePath}/wallpaper`,
            `${themePath}/wallpapers`,
            `${themePath}/hyprland`
        ];
        const extensions = ['.png', '.jpg', '.jpeg', '.webp'];

        for (const dir of wallpaperPaths) {
            if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) continue;

            let match = null;
            this.enumerateDirectory(dir, 'standard::name', (info) => {
                const name = info.get_name().toLowerCase();
                if (!extensions.some(ext => name.endsWith(ext))) {
                    return true;
                }

                match = `${dir}/${info.get_name()}`;
                return false;
            }, `ProcessManagerPopup.findThemeWallpaperFile.${dir}`);
            if (match) {
                return match;
            }
        }

        for (const ext of extensions) {
            const directPath = `${themePath}/wallpaper${ext}`;
            if (GLib.file_test(directPath, GLib.FileTest.EXISTS)) {
                return directPath;
            }
        }

        return null;
    }

    applyWallpaperWithDaemon(wallpaperFile) {
        switch (this.getRunningDaemonForCategory('wallpaper')) {
            case 'hyprpaper':
                this.runSyncCommand(
                    `hyprctl hyprpaper wallpaper ",${wallpaperFile}"`,
                    'ProcessManagerPopup.reapplyThemeWallpaper.hyprpaper'
                );
                return;
            case 'swaybg':
                this.runSyncCommand('pkill swaybg', 'ProcessManagerPopup.reapplyThemeWallpaper.killSwaybg');
                this.runAsyncCommand(`swaybg -i "${wallpaperFile}"`, 'ProcessManagerPopup.reapplyThemeWallpaper.swaybg');
                return;
            default:
                this.runAsyncCommand(
                    `swww img "${wallpaperFile}" --transition-type fade --transition-duration 1`,
                    'ProcessManagerPopup.reapplyThemeWallpaper.swww'
                );
        }
    }

    reapplyThemeWallpaper() {
        const themePath = this.getCurrentRicePath();
        if (!themePath) return;

        const wallpaperFile = this.findThemeWallpaperFile(themePath);
        if (wallpaperFile) {
            this.applyWallpaperWithDaemon(wallpaperFile);
        }
    }

    sourceThemeConfigs(themePath) {
        const hyprlandPath = `${themePath}/hyprland`;
        if (!GLib.file_test(hyprlandPath, GLib.FileTest.IS_DIR)) return;

        this.enumerateDirectory(hyprlandPath, 'standard::name', (info) => {
            const name = info.get_name();
            if (name.endsWith('.conf')) {
                this.runSyncCommand(
                    `hyprctl keyword source "${hyprlandPath}/${name}"`,
                    `ProcessManagerPopup.reloadThemeConfigs.source.${name}`
                );
            }
            return true;
        }, 'ProcessManagerPopup.reloadThemeConfigs.enumerate');
    }

    reloadThemeConfigs() {
        const themePath = this.getCurrentRicePath();
        this.runSyncCommand('hyprctl reload', 'ProcessManagerPopup.reloadThemeConfigs.reload');
        themePath && this.sourceThemeConfigs(themePath);
        this.scheduleRefresh(500);
    }

    openThemeDirectory() {
        const themePath = this.getCurrentRicePath();
        if (!themePath || !GLib.file_test(themePath, GLib.FileTest.IS_DIR)) return;
        this.runAsyncCommand(`xdg-open "${themePath}"`, 'ProcessManagerPopup.openThemeDirectory');
    }

    destroy() {
        this.stopAutoRefresh();
        this.isDestroyed = true;
        this.dialog?.destroy();
        this.dialog = null;
    }
}
