import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=3.0';
import {addPointerCursor, openFileChooserDialog, applyLabelAttributes, applyOptionalSetters} from '../../common/ViewUtils.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export class StartPointTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings ?? {};
        this.widgets = deps.widgets ?? {};
        this.dialog = deps.dialog;
        this.controller = deps.controller;
        this.styleSeparator = deps.styleSeparator || ((sep) => sep);
        this.notify = deps.notify || (() => {});
        this.readBackupFolders = deps.readBackupFolders || (() => []);
        this.readExcludedBackupFolders = deps.readExcludedBackupFolders || (() => []);
        this.createStartPointUpdateScript = deps.createStartPointUpdateScript || (() => '');
        this.homePath = deps.homePath || GLib.get_home_dir();
        this.onCheckpointUpdated = deps.onCheckpointUpdated || (() => {});
        this.onBackupFoldersChanged = deps.onBackupFoldersChanged || (() => {});
        this.onExcludedFoldersChanged = deps.onExcludedFoldersChanged || (() => {});

        this.tempBackupFolders = [];
        this.tempExcludedFolders = [];
        this.backupFolderChecks = {};
        this.folderAddedSinceLastUpdate = false;
        this.lastUpdateValueLabel = null;
        this.folderUpdateNote = null;
        this.backupFoldersBox = null;
    }

    build() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24
        });

        this.buildHeader(box);
        this.buildLastUpdate(box);
        this.buildUpdateButton(box);
        this.addSeparator(box);
        this.buildBackupFolders(box);

        const tabLabel = new Gtk.Label({label: this.t('START_POINT_TAB')});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return {
            box,
            tabLabel,
            state: {
                tempBackupFolders: this.tempBackupFolders,
                tempExcludedFolders: this.tempExcludedFolders
            }
        };
    }

    createLabel(text, {bold = false, wrap = false, xalign = null, halign = Gtk.Align.START} = {}) {
        const label = new Gtk.Label({
            label: text,
            halign,
            wrap
        });
        applyOptionalSetters([
            [bold, () => applyLabelAttributes(label, { bold: true }), Boolean],
            [xalign, (value) => label.set_xalign(value)]
        ]);
        return label;
    }

    buildHeader(box) {
        const title = this.createLabel(this.t('START_POINT_TAB'), {bold: true});
        box.pack_start(title, false, false, 0);

        const info = this.createLabel(this.t('START_POINT_INFO'), {wrap: true, xalign: 0});
        box.pack_start(info, false, false, 0);
    }

    buildLastUpdate(box) {
        const lastUpdateBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });

        this.lastUpdateValueLabel = this.createLabel(this.getLastUpdateTimestamp(), {xalign: 0});
        lastUpdateBox.pack_start(this.createLabel(this.t('LAST_UPDATE_LABEL'), {xalign: 0}), false, false, 0);
        lastUpdateBox.pack_start(this.lastUpdateValueLabel, false, false, 0);
        box.pack_start(lastUpdateBox, false, false, 0);

        this.widgets.restorePointLastUpdateLabel = this.lastUpdateValueLabel;
    }

    getLastUpdateTimestamp() {
        let scriptsDir = `${this.homePath}/.config/lastlayer/scripts`;
        let primaryPath = `${scriptsDir}/start_point_update.sh`;
        let updateScriptPath = Gio.File.new_for_path(primaryPath).query_exists(null)
            ? primaryPath : `${scriptsDir}/update_start_point.sh`;
        let updateScriptFile = Gio.File.new_for_path(updateScriptPath);

        let trim = (v) => (typeof v === 'string' && v.trim()) || null;
        let lastUpdateStr = trim(this.controller?.getRestorePointLastUpdate?.()) || trim(this.settings.restore_point_last_update);

        if (!updateScriptFile.query_exists(null)) {
            let scriptDir = Gio.File.new_for_path(scriptsDir);
            !scriptDir.query_exists(null) && scriptDir.make_directory_with_parents(null);
            GLib.file_set_contents(primaryPath, this.createStartPointUpdateScript());
            updateScriptFile = Gio.File.new_for_path(primaryPath);
        }

        if (!lastUpdateStr) {
            let dt = GLib.DateTime.new_from_unix_local(
                updateScriptFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null)
                    .get_attribute_uint64('time::modified') / 1000
            );
            lastUpdateStr = dt.get_year() >= 2025 ? dt.format('%Y-%m-%d %H:%M:%S') : null;
        }

        lastUpdateStr ||= this.t('DEFAULT_INSTALL_TEXT');
        lastUpdateStr !== this.t('DEFAULT_INSTALL_TEXT') && (this.settings.restore_point_last_update = lastUpdateStr);
        return lastUpdateStr;
    }

    buildUpdateButton(box) {
        const updateCheckpointBtn = new Gtk.Button({
            label: this.t('ADD_RESTORE_POINT_BUTTON')
        });
        addPointerCursor(updateCheckpointBtn);

        updateCheckpointBtn.connect('clicked', () => this.onUpdateCheckpoint());
        box.pack_start(updateCheckpointBtn, false, false, 0);
    }

    async onUpdateCheckpoint() {
        let checkedFolders = Object.keys(this.backupFolderChecks)
            .filter(folder => this.backupFolderChecks[folder].get_active());

        !checkedFolders.includes('default_wallpapers') && checkedFolders.push('default_wallpapers');

        let requestTimestamp = (() => {
            let now = GLib.DateTime.new_now_local();
            return now ? now.format('%Y-%m-%d %H:%M:%S') : null;
        })();

        let result = this.controller?.updateCheckpoint
            ? await this.controller.updateCheckpoint({folders: checkedFolders})
            : null;

        this.folderAddedSinceLastUpdate = false;
        this.folderUpdateNote?.hide();

        function standardizeTimestamp(value) {
            return (typeof value === 'string' && value.trim().length) ? value.trim() : null;
        }

        this.onCheckpointUpdated({
            timestamp: standardizeTimestamp(result?.lastUpdate)
                || requestTimestamp
                || standardizeTimestamp(this.controller?.getRestorePointLastUpdate?.())
                || null,
            detectedBar: result?.detectedBar || 'none'
        });

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_DELAY_SHORT_MS, () => {
            let label = this.lastUpdateValueLabel;
            if (!label) {
                return GLib.SOURCE_REMOVE;
            }
            let latest = this.controller?.getRestorePointLastUpdate?.()?.trim?.();
            latest && latest > (label.get_text() || '') && label.set_text(latest);
            return GLib.SOURCE_REMOVE;
        });

        let hasSnapshot = !!result?.snapshot;
        this.notify(this.t(hasSnapshot ? 'RESTORE_POINT_ADDED' : 'RESTORE_POINT_CREATE_ERROR'));
    }

    buildBackupFolders(box) {
        const label = this.createLabel(this.t('BACKUP_FOLDERS_LABEL'), {xalign: 0});
        box.pack_start(label, false, false, 0);

        const originalBackupFolders = this.readBackupFolders();
        this.tempBackupFolders = [...originalBackupFolders];
        const excludedFolders = this.readExcludedBackupFolders();
        this.tempExcludedFolders = [...excludedFolders];

        this.onBackupFoldersChanged(this.tempBackupFolders);
        this.onExcludedFoldersChanged(this.tempExcludedFolders);

        this.backupFoldersBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });

        this.folderUpdateNote = this.createLabel(this.t('FOLDER_UPDATE_NOTE'), {wrap: true, xalign: 0});
        this.folderUpdateNote.set_margin_top(8);
        this.folderUpdateNote.set_margin_bottom(8);
        this.folderUpdateNote.hide();

        this.refreshBackupFoldersUI();

        const addFolderBtn = new Gtk.Button({label: '+'});
        addPointerCursor(addFolderBtn);
        addFolderBtn.connect('clicked', () => this.onAddFolder());

        box.pack_start(this.backupFoldersBox, true, true, 0);
        box.pack_start(addFolderBtn, false, false, 0);
        box.pack_start(this.folderUpdateNote, false, false, 0);
    }

    refreshBackupFoldersUI() {
        this.backupFoldersBox && (() => {
            (this.backupFoldersBox.get_children?.() ?? []).forEach(child => this.backupFoldersBox.remove(child));
            this.backupFolderChecks = {};

            this.tempBackupFolders
                .filter((folder) => folder !== 'default_wallpapers' && folder !== 'hypr')
                .forEach((folder) => {
                    const check = new Gtk.CheckButton({
                        label: folder,
                        active: !this.tempExcludedFolders.includes(folder)
                    });

                    check.connect('toggled', () => {
                        this.folderAddedSinceLastUpdate = true;
                        const idx = this.tempExcludedFolders.indexOf(folder);
                        const isActive = check.get_active();
                        isActive && idx >= 0 && this.tempExcludedFolders.splice(idx, 1);
                        !isActive && !this.tempExcludedFolders.includes(folder) && this.tempExcludedFolders.push(folder);
                        this.onExcludedFoldersChanged(this.tempExcludedFolders);
                    });

                    this.backupFoldersBox.pack_start(check, false, false, 0);
                    this.backupFolderChecks[folder] = check;
                });

            this.backupFoldersBox.show_all();
        })();
    }

    onAddFolder() {
        openFileChooserDialog({
            title: this.t('FOLDER_SELECTION_TITLE'),
            action: Gtk.FileChooserAction.SELECT_FOLDER,
            parent: this.dialog,
            currentFolder: `${this.homePath}/.config`,
            borderWidth: 10,
            buttons: [
                {label: Gtk.STOCK_CANCEL, response: Gtk.ResponseType.CANCEL},
                {label: Gtk.STOCK_OPEN, response: Gtk.ResponseType.ACCEPT}
            ],
            onResponse: (chooser, response) => {
                response === Gtk.ResponseType.ACCEPT && (() => {
                    const folderName = GLib.path_get_basename(chooser.get_filename());
                    folderName === 'hypr'
                        ? this.notify(this.t('CANNOT_ADD_HYPR_FOLDER'))
                        : (
                            !this.tempBackupFolders.includes(folderName)
                            && (
                                this.tempBackupFolders.push(folderName),
                                this.refreshBackupFoldersUI(),
                                this.folderAddedSinceLastUpdate = true,
                                this.folderUpdateNote?.show(),
                                this.onBackupFoldersChanged(this.tempBackupFolders)
                            )
                        );
                })();
            }
        });
    }

    addSeparator(box) {
        const sep = this.styleSeparator(new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL
        }));
        sep.set_margin_top(12);
        sep.set_margin_bottom(12);
        box.pack_start(sep, false, false, 0);
    }

    setTimestamp(timestamp) {
        timestamp && this.lastUpdateValueLabel?.set_text(timestamp);
    }
}
