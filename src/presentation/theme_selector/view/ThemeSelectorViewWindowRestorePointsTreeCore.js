import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as ViewUtils from '../../common/ViewUtils.js';

export function applyThemeSelectorViewWindowRestorePointsTreeCore(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewWindowRestorePointsTreeCore.prototype);
}

class ThemeSelectorViewWindowRestorePointsTreeCore {
    hideDefaultRestorePointsMenu() {
        this.restorePointDetailsDialog?.destroy?.();
        this.restorePointDetailsDialog = null;
        this.defaultRestorePointsDialog?.destroy?.();
        this.defaultRestorePointsDialog = null;
    }

    appendRestorePointTreeNode(store, parentIter, node, parentRelativePath = '') {
        if (!node) {
            return;
        }

        let nodeTypeRaw = String(node.type || 'file');
        let type = nodeTypeRaw === 'folder'
            ? this.translate('RESTORE_POINT_NODE_FOLDER')
            : (nodeTypeRaw === 'truncated'
                ? this.translate('RESTORE_POINT_NODE_TRUNCATED')
                : this.translate('RESTORE_POINT_NODE_FILE'));
        const name = String(node.name || '');
        const relativePath = parentIter
            ? (parentRelativePath ? `${parentRelativePath}/${name}` : name)
            : '';

        const iter = store.append(parentIter);
        store.set(
            iter,
            [0, 1, 2, 3, 4],
            [
                name,
                type,
                String(node.sizeLabel || '0 B'),
                relativePath,
                nodeTypeRaw
            ]
        );

        const children = Array.isArray(node.children) ? node.children : [];
        children.forEach((child) => this.appendRestorePointTreeNode(store, iter, child, relativePath));
    }

    getRestorePointTreeSelection(treeView) {
        const selected = treeView?.get_selection?.()?.get_selected?.(),
              [hasSelection, model, iter] = (selected?.length >= 3 && selected[0]) ? selected : [];
        if (!hasSelection || !model || !iter) return null;
        return {
            name: String(model.get_value(iter, 0) || ''),
            typeLabel: String(model.get_value(iter, 1) || ''),
            sizeLabel: String(model.get_value(iter, 2) || ''),
            relativePath: String(model.get_value(iter, 3) || ''),
            typeRaw: String(model.get_value(iter, 4) || '')
        };
    }

    getParentRestoreRelativePath(relativePath = '') {
        const cleanPath = String(relativePath || '').trim();
        if (!cleanPath.length) {
            return '';
        }
        const parent = GLib.path_get_dirname(cleanPath);
        return parent === '.' ? '' : parent;
    }

    joinRestoreRelativePath(base = '', leaf = '') {
        const basePart = String(base || '').trim().replace(/^\/+|\/+$/g, '');
        const leafPart = String(leaf || '').trim().replace(/^\/+|\/+$/g, '');
        return basePart && leafPart
            ? `${basePart}/${leafPart}`
            : (basePart || leafPart || '');
    }

    resolveRestoreTargetDir(selection = null) {
        if (!selection || !selection.relativePath) {
            return '';
        }
        return selection.typeRaw === 'folder'
            ? selection.relativePath
            : this.getParentRestoreRelativePath(selection.relativePath);
    }

    primeRestorePointTreeView(treeView) {
        treeView?.collapse_all?.();
        if (!treeView
            || !(Number(
                treeView.get_model?.()?.iter_n_children?.(null)) > 0)) return;

        const firstPath = Gtk.TreePath.new_from_string('0');
        firstPath && treeView.expand_row?.(firstPath, false);
        firstPath && treeView.get_selection?.()?.select_path?.(
            firstPath);
        firstPath && treeView.scroll_to_cell?.(
            firstPath, null, true, 0.1, 0);
    }

    askRestorePointPathInput({
        title,
        label,
        defaultValue = ''
    } = {}) {
        const dialog = new Gtk.Dialog({
            title,
            transient_for: this.restorePointDetailsDialog || this.defaultRestorePointsDialog || this.window || null,
            modal: true,
            window_position: Gtk.WindowPosition.CENTER
        });
        dialog.add_button(this.translate('CANCEL'), Gtk.ResponseType.CANCEL);
        dialog.add_button(this.translate('SAVE'), Gtk.ResponseType.OK);

        const content = dialog.get_content_area();
        content.set_spacing(8);
        content.set_margin_left(12);
        content.set_margin_right(12);
        content.set_margin_top(12);
        content.set_margin_bottom(12);

        const fieldLabel = new Gtk.Label({
            label,
            xalign: 0
        });
        fieldLabel.get_style_context().add_class('field-label');

        const entry = new Gtk.Entry({
            text: String(defaultValue || ''),
            hexpand: true
        });

        content.pack_start(fieldLabel, false, false, 0);
        content.pack_start(entry, false, false, 0);

        dialog.show_all();
        ViewUtils.setupPointerCursors?.(dialog);

        const response = dialog.run();
        const value = response === Gtk.ResponseType.OK
            ? String(entry.get_text() || '').trim()
            : '';
        dialog.destroy();
        return value.length ? value : null;
    }

    askRestorePointFileContent({
        title,
        label,
        defaultValue = ''
    } = {}) {
        const dialog = new Gtk.Dialog({
            title,
            transient_for: this.restorePointDetailsDialog || this.defaultRestorePointsDialog || this.window || null,
            modal: true,
            window_position: Gtk.WindowPosition.CENTER,
            default_width: 760,
            default_height: 520
        });
        dialog.add_button(this.translate('CANCEL'), Gtk.ResponseType.CANCEL);
        dialog.add_button(this.translate('SAVE'), Gtk.ResponseType.OK);

        const content = dialog.get_content_area();
        content.set_spacing(8);
        content.set_margin_left(12);
        content.set_margin_right(12);
        content.set_margin_top(12);
        content.set_margin_bottom(12);

        const fieldLabel = new Gtk.Label({
            label,
            xalign: 0
        });
        fieldLabel.get_style_context().add_class('field-label');

        const textView = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            monospace: true
        });
        textView.get_buffer?.().set_text(String(defaultValue || ''), -1);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 360
        });
        scrolled.add(textView);

        content.pack_start(fieldLabel, false, false, 0);
        content.pack_start(scrolled, true, true, 0);

        dialog.show_all();
        ViewUtils.setupPointerCursors?.(dialog);

        const response = dialog.run();
        let value = null;
        if (response === Gtk.ResponseType.OK) {
            const buffer = textView.get_buffer?.();
            if (!buffer) {
                value = '';
            } else {
                const [hasText, start, end] = buffer.get_bounds();
                value = hasText ? String(buffer.get_text(start, end, false) || '') : '';
            }
        }
        dialog.destroy();
        return value;
    }

    getRestorePointSelectedFoldersFromSettings() {
        const manager = this.controller?.settingsService?.settingsManager,
            backupFolders = Array.isArray(manager?.get?.('backupFolders'))
                ? manager.get('backupFolders') : [],
            excludedSet = new Set(
                (Array.isArray(manager?.get?.('excludedBackupFolders'))
                    ? manager.get('excludedBackupFolders') : [])
                    .map((folder) => String(folder || '').trim())
                    .filter(Boolean)),
            selected = [],
            seen = new Set();

        for (const folder of backupFolders) {
            const normalized = String(folder || '').trim();
            if (!normalized || normalized === 'hypr' || normalized === 'default_wallpapers') continue;
            if (excludedSet.has(normalized) || seen.has(normalized)) continue;
            seen.add(normalized);
            selected.push(normalized);
        }

        return selected;
    }

    askRestorePointFolderName(dialogRef) {
        const chooser = new Gtk.FileChooserDialog({
            title: this.translate('FOLDER_SELECTION_TITLE'),
            action: Gtk.FileChooserAction.SELECT_FOLDER,
            transient_for: dialogRef || this.defaultRestorePointsDialog || this.window || null,
            modal: true
        });
        chooser.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        chooser.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT);
        chooser.set_current_folder?.(`${GLib.get_home_dir()}/.config`);
        chooser.show_all();
        ViewUtils.setupPointerCursors?.(chooser);
        const response = chooser.run();
        const selectedPath = response === Gtk.ResponseType.ACCEPT ? chooser.get_filename?.() : null;
        chooser.destroy?.();
        return selectedPath ? GLib.path_get_basename(selectedPath) : null;
    }

    askRestorePointFoldersSelection(defaultFolders = []) {
        const dialog = new Gtk.Dialog({
            title: this.translate('ADD_RESTORE_POINT_BUTTON'),
            transient_for: this.defaultRestorePointsDialog || this.window || null,
            modal: true,
            window_position: Gtk.WindowPosition.CENTER,
            default_width: 460,
            default_height: 480
        });
        dialog.get_style_context().add_class('theme-repo-dialog');
        dialog.get_style_context().add_class('restore-points-shell');
        dialog.get_style_context().add_class('restore-points-dialog');
        dialog.get_style_context().add_class('restore-point-folder-picker-dialog');
        this._restorePointsTypewriterMode && dialog.get_style_context().add_class('tw-dialog');
        dialog.get_action_area?.()?.hide?.();

        const content = dialog.get_content_area();
        content.get_style_context().add_class('restore-points-content');
        content.set_spacing(10);
        content.set_margin_left(14);
        content.set_margin_right(14);
        content.set_margin_top(14);
        content.set_margin_bottom(14);


        const nameLabel = new Gtk.Label({label: this.translate('RESTORE_POINT_DETAILS_NAME') || 'Name', xalign: 0});
        nameLabel.get_style_context().add_class('field-label');
        content.pack_start(nameLabel, false, false, 0);

        const defaultName = this.controller?.settingsService?.getCurrentTheme?.()
            || this.controller?.store?.get?.('currentTheme')
            || 'default';
        const nameEntry = new Gtk.Entry({text: defaultName, hexpand: true});
        nameEntry.get_style_context().add_class('restore-point-name-entry');
        content.pack_start(nameEntry, false, false, 0);


        const titleLabel = new Gtk.Label({
            label: this.translate('BACKUP_FOLDERS_LABEL'),
            xalign: 0
        });
        titleLabel.get_style_context().add_class('field-label');
        content.pack_start(titleLabel, false, false, 0);

        const foldersState = Array.isArray(defaultFolders)
            ? defaultFolders
                .map((folder) => String(folder || '').trim())
                .filter(Boolean)
            : [];
        const folderChecks = new Map();
        const folderState = new Map(foldersState.map((folder) => [folder, true]));

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6
        });
        listBox.get_style_context().add_class('restore-point-folder-list');
        const listScrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 220
        });
        listScrolled.get_style_context().add_class('restore-point-scrolled');
        listScrolled.get_style_context().add_class('restore-point-folder-scrolled');
        listScrolled.add(listBox);

        const refreshFoldersList = () => {
            (listBox.get_children?.() || []).forEach((child) => listBox.remove(child));
            folderChecks.clear();

            if (!foldersState.length) {
                const emptyLabel = new Gtk.Label({
                    label: this.translate('RESTORE_POINTS_EMPTY'),
                    xalign: 0
                });
                emptyLabel.get_style_context().add_class('field-label');
                listBox.pack_start(emptyLabel, false, false, 0);
                listBox.show_all();
                return;
            }

            foldersState.forEach((folder) => {
                const check = new Gtk.CheckButton({
                    label: folder,
                    active: folderState.get(folder) !== false
                });
                check.get_style_context().add_class('restore-point-folder-check');
                ViewUtils.addPointerCursor?.(check);
                check.connect('toggled', () => {
                    folderState.set(folder, check.get_active() === true);
                });
                folderChecks.set(folder, check);
                listBox.pack_start(check, false, false, 0);
            });
            listBox.show_all();
        };

        const addFolderBtn = new Gtk.Button({
            label: '+ folder'
        });
        addFolderBtn.get_style_context().add_class('restore-point-folder-btn');
        ViewUtils.addPointerCursor?.(addFolderBtn);
        addFolderBtn.connect('clicked', () => {
            const folderName = String(this.askRestorePointFolderName(dialog) || '').trim();
            if (!folderName) {
                return;
            }
            if (folderName === 'hypr') {
                this.showNotification(this.translate('CANNOT_ADD_HYPR_FOLDER'), 'info');
                return;
            }
            if (folderName === 'default_wallpapers') {
                return;
            }
            if (foldersState.includes(folderName)) {
                folderState.set(folderName, true);
                const check = folderChecks.get(folderName);
                check?.set_active?.(true);
                return;
            }
            foldersState.push(folderName);
            folderState.set(folderName, true);
            refreshFoldersList();
        });

        const addRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });
        addRow.get_style_context().add_class('restore-point-folder-add-row');
        addRow.pack_start(addFolderBtn, false, false, 0);
        content.pack_start(addRow, false, false, 0);
        content.pack_start(listScrolled, true, true, 0);

        const bottomRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, hexpand: true});
        bottomRow.set_margin_top(6);
        const cancelBtn = new Gtk.Button({label: this.translate('CANCEL')});
        cancelBtn.get_style_context().add_class('cancel-btn');
        cancelBtn.set_size_request(100, 34);
        ViewUtils.addPointerCursor?.(cancelBtn);
        const saveBtn = new Gtk.Button({label: this.translate('ADD_POINT') || 'SAVE'});
        saveBtn.get_style_context().add_class('save-btn');
        this._restorePointsTypewriterMode && saveBtn.get_style_context().add_class('tw-save-btn');
        saveBtn.set_size_request(100, 34);
        ViewUtils.addPointerCursor?.(saveBtn);
        bottomRow.pack_end(saveBtn, false, false, 0);
        bottomRow.pack_end(cancelBtn, false, false, 0);
        content.pack_end(bottomRow, false, false, 0);

        let dialogResult = null;
        cancelBtn.connect('clicked', () => { dialogResult = 'cancel'; dialog.response(Gtk.ResponseType.CANCEL); });
        saveBtn.connect('clicked', () => { dialogResult = 'ok'; dialog.response(Gtk.ResponseType.OK); });

        refreshFoldersList();
        dialog.show_all();
        ViewUtils.setupPointerCursors?.(dialog);

        const response = dialog.run();
        if (response === Gtk.ResponseType.OK || dialogResult === 'ok') {
            const selectedFolders = foldersState.filter((folder) => folderState.get(folder) === true);
            const name = String(nameEntry.get_text() || '').trim() || defaultName;
            dialog.destroy();
            return {folders: selectedFolders, name};
        }
        dialog.destroy();
        return null;
    }

    pickRestorePointImportFile() {
        const chooser = new Gtk.FileChooserDialog({
            title: this.translate('RESTORE_POINT_PICK_FILE'),
            action: Gtk.FileChooserAction.OPEN,
            transient_for: this.restorePointDetailsDialog || this.defaultRestorePointsDialog || this.window || null,
            modal: true
        });
        chooser.add_button(this.translate('CANCEL'), Gtk.ResponseType.CANCEL);
        chooser.add_button(this.translate('ADD'), Gtk.ResponseType.ACCEPT);
        chooser.set_select_multiple?.(false);
        this.translateWidgetTexts?.(chooser);
        chooser.show_all();
        ViewUtils.setupPointerCursors?.(chooser);
        const response = chooser.run();
        const selectedPath = (response === Gtk.ResponseType.ACCEPT || response === Gtk.ResponseType.OK)
            ? chooser.get_filename?.()
            : null;
        chooser.destroy();
        return selectedPath || null;
    }

    buildRestorePointTreeView(tree) {
        const hasTree = tree && Array.isArray(tree.children) && tree.children.length > 0;
        if (!hasTree) {
            const placeholder = new Gtk.Label({
                label: this.translate('RESTORE_POINT_DETAILS_TREE_EMPTY'),
                xalign: 0
            });
            placeholder.get_style_context().add_class('field-label');
            return {widget: placeholder, treeView: null};
        }

        const store = new Gtk.TreeStore();
        store.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING
        ]);
        this.appendRestorePointTreeNode(store, null, tree);

        const treeView = new Gtk.TreeView({
            model: store,
            headers_visible: true,
            enable_grid_lines: Gtk.TreeViewGridLines.BOTH
        });

        const addColumn = (title, index, expand = false) => {
            const renderer = new Gtk.CellRendererText();
            const column = new Gtk.TreeViewColumn({title, expand});
            column.pack_start(renderer, true);
            column.add_attribute(renderer, 'text', index);
            treeView.append_column(column);
        };

        addColumn(this.translate('RESTORE_POINT_DETAILS_NAME'), 0, true);
        addColumn(this.translate('RESTORE_POINT_DETAILS_TYPE'), 1, false);
        addColumn(this.translate('RESTORE_POINT_DETAILS_SIZE'), 2, false);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 320
        });
        scrolled.add(treeView);
        return {widget: scrolled, treeView};
    }

}
