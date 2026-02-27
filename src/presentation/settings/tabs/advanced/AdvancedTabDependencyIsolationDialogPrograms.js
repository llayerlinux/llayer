import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import { addPointerCursor, runMessageDialog } from '../../../common/ViewUtils.js';
import { formatDate, formatPath, formatPathForDisplay } from './AdvancedTabDependencyIsolationDialogProgramsFormatters.js';
import { populateProgramsList } from './AdvancedTabDependencyIsolationDialogProgramsPopulate.js';

const PROGRAM_TREE_COLUMN = {
    CHECKED: 0,
    TYPE: 1,
    PROGRAM: 2,
    VERSION: 3,
    RICE: 4,
    PATH: 5,
    SIZE: 6
};
const UNKNOWN_VALUE = '—';

function hasRealPath(filePath) {
    return Boolean(filePath) && filePath !== UNKNOWN_VALUE;
}

class AdvancedTabDependencyIsolationDialogPrograms {

    buildDependencyIsolationProgramsSection(dialog) {
        let t = this.t,
            programsFrame = new Gtk.Frame(),
            programsHeaderBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8}),
            programsHeaderLabel = new Gtk.Label({label: t('DEPENDENCY_ISOLATION_INSTALLED_PROGRAMS')});
        programsHeaderLabel.get_style_context().add_class('frame-label');
        let totalSizeLabel = new Gtk.Label({label: ''});
        totalSizeLabel.get_style_context().add_class('dim-label');

        let viewModeStore = new Gtk.ListStore();
        viewModeStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
        let byTypeIter = viewModeStore.append();
        viewModeStore.set(byTypeIter, [0, 1], ['by-type', t('DEPENDENCY_ISOLATION_VIEW_BY_TYPE') || 'By Type']);
        let byProgramIter = viewModeStore.append();
        viewModeStore.set(byProgramIter, [0, 1], ['by-program', t('DEPENDENCY_ISOLATION_VIEW_BY_PROGRAM') || 'By Program']);

        let viewModeCombo = new Gtk.ComboBox({model: viewModeStore}),
            viewModeRenderer = new Gtk.CellRendererText();
        viewModeCombo.pack_start(viewModeRenderer, true);
        viewModeCombo.add_attribute(viewModeRenderer, 'text', 1);
        viewModeCombo.set_active(0);
        viewModeCombo.set_tooltip_text(t('DEPENDENCY_ISOLATION_VIEW_MODE_TOOLTIP') || 'Select how programs are grouped');
        addPointerCursor(viewModeCombo);

        let deleteAllButton = new Gtk.Button({label: '🗑️ ' + (t('DEPENDENCY_ISOLATION_DELETE_ALL') || 'Delete All')});
        deleteAllButton.get_style_context().add_class('destructive-action');
        deleteAllButton.set_sensitive(false);
        addPointerCursor(deleteAllButton);

        programsHeaderBox.pack_start(programsHeaderLabel, false, false, 0);
        programsHeaderBox.pack_start(totalSizeLabel, false, false, 8);
        programsHeaderBox.pack_start(viewModeCombo, false, false, 4);
        programsHeaderBox.pack_end(deleteAllButton, false, false, 0);
        programsFrame.set_label_widget(programsHeaderBox);

        let programsOuterBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8}),
            programsSpinnerBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, halign: Gtk.Align.CENTER}),
            programsSpinner = new Gtk.Spinner();
        programsSpinner.set_size_request(20, 20);
        let programsLoadingLabel = new Gtk.Label({label: t('DEPENDENCY_ISOLATION_LOADING') || 'Loading...'});
        programsSpinnerBox.pack_start(programsSpinner, false, false, 0);
        programsSpinnerBox.pack_start(programsLoadingLabel, false, false, 0);
        programsOuterBox.pack_start(programsSpinnerBox, false, false, 0);

        let programsBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8}),
            programsScrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_width: 300,
            min_content_height: 200
        });

        let programsTreeStore = new Gtk.TreeStore();
        programsTreeStore.set_column_types([
            GObject.TYPE_BOOLEAN,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_STRING
        ]);

        let programsTreeView = new Gtk.TreeView({model: programsTreeStore});
        programsTreeView.set_headers_visible(true);
        programsTreeView.set_rules_hint(true);
        programsTreeView.set_grid_lines(Gtk.TreeViewGridLines.HORIZONTAL);
        programsTreeView.set_enable_search(true);
        programsTreeView.set_search_column(1);

        let checkCol = new Gtk.TreeViewColumn({title: '', min_width: 30, resizable: false}),
            checkRenderer = new Gtk.CellRendererToggle();
        checkRenderer.set_activatable(true);
        checkCol.pack_start(checkRenderer, false);
        checkCol.add_attribute(checkRenderer, 'active', 0);
        programsTreeView.append_column(checkCol);

        let selectedItems = new Map();

        function updateSelectionState() {
            let count = selectedItems.size,
                hasSelection = count > 0;
            deleteButton.set_label(
                hasSelection
                    ? `🗑️ ${t('DEPENDENCY_ISOLATION_DELETE_SELECTED') || 'Delete Selected'} (${count})`
                    : `🗑️ ${t('DEPENDENCY_ISOLATION_DELETE_PROGRAM')}`
            );
            deleteButton.set_sensitive(hasSelection);
        }

        function syncSelectedItem(checked, filePath, payload) {
            if (!hasRealPath(filePath)) {
                return;
            }
            if (checked) {
                selectedItems.set(filePath, payload);
                return;
            }
            selectedItems.delete(filePath);
        }

        checkRenderer.connect('toggled', (renderer, pathStr) => {
            let treePath = Gtk.TreePath.new_from_string(pathStr),
                [ok, iter] = programsTreeStore.get_iter(treePath);
            if (!ok) {
                return;
            }

            let currentValue = programsTreeStore.get_value(iter, PROGRAM_TREE_COLUMN.CHECKED),
                filePath = programsTreeStore.get_value(iter, PROGRAM_TREE_COLUMN.PATH),
                program = programsTreeStore.get_value(iter, PROGRAM_TREE_COLUMN.PROGRAM),
                nextChecked = !currentValue;

            programsTreeStore.set_value(iter, PROGRAM_TREE_COLUMN.CHECKED, nextChecked);
            syncSelectedItem(nextChecked, filePath, { program, treePath: pathStr });
            updateSelectionState();
        });

        let typeCol = new Gtk.TreeViewColumn({title: t('DEPENDENCY_ISOLATION_TYPE') || 'Type', min_width: 80, resizable: true}),
            typeRenderer = new Gtk.CellRendererText();
        typeCol.pack_start(typeRenderer, true);
        typeCol.add_attribute(typeRenderer, 'text', 1);
        programsTreeView.append_column(typeCol);

        let programCol = new Gtk.TreeViewColumn({title: t('DEPENDENCY_ISOLATION_PROGRAM'), min_width: 120, resizable: true}),
            programRenderer = new Gtk.CellRendererText();
        programCol.pack_start(programRenderer, true);
        programCol.add_attribute(programRenderer, 'text', 2);
        programCol.set_sort_column_id(2);
        programsTreeView.append_column(programCol);

        let versionCol = new Gtk.TreeViewColumn({title: t('DEPENDENCY_ISOLATION_VERSION'), min_width: 80, resizable: true}),
            versionRenderer = new Gtk.CellRendererText();
        versionCol.pack_start(versionRenderer, true);
        versionCol.add_attribute(versionRenderer, 'text', 3);
        programsTreeView.append_column(versionCol);

        let riceCol = new Gtk.TreeViewColumn({title: t('DEPENDENCY_ISOLATION_RICE') || 'Rice', min_width: 100, resizable: true}),
            riceRenderer = new Gtk.CellRendererText();
        riceCol.pack_start(riceRenderer, true);
        riceCol.add_attribute(riceRenderer, 'text', 4);
        riceCol.set_sort_column_id(4);
        programsTreeView.append_column(riceCol);

        let pathCol = new Gtk.TreeViewColumn({title: t('DEPENDENCY_ISOLATION_PATH'), min_width: 120, resizable: true}),
            pathRenderer = new Gtk.CellRendererText();
        pathCol.pack_start(pathRenderer, true);

        let homeDir = GLib.get_home_dir();

        pathCol.set_cell_data_func(pathRenderer, (col, cell, model, iter) => {
            let fullPath = model.get_value(iter, PROGRAM_TREE_COLUMN.PATH),
                displayPath = formatPathForDisplay(fullPath, homeDir);
            cell.set_property('text', displayPath);
            cell.set_property('ellipsize', 3);
        });

        programsTreeView.append_column(pathCol);

        let sizeCol = new Gtk.TreeViewColumn({title: t('DEPENDENCY_ISOLATION_SIZE'), min_width: 70, resizable: true}),
            sizeRenderer = new Gtk.CellRendererText();
        sizeCol.pack_start(sizeRenderer, true);
        sizeCol.add_attribute(sizeRenderer, 'text', 6);
        programsTreeView.append_column(sizeCol);

        programsScrolled.add(programsTreeView);
        programsBox.pack_start(programsScrolled, true, true, 0);

        let detailsFrame = new Gtk.Frame({label: t('DEPENDENCY_ISOLATION_DETAILS')}),
            detailsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});
        detailsBox.get_style_context().add_class('dependency-isolation-details-box');

        let selectedProgramLabel = new Gtk.Label({label: t('DEPENDENCY_ISOLATION_SELECT_PROGRAM'), wrap: true, max_width_chars: 35});
        selectedProgramLabel.set_ellipsize(3);
        let selectedPathLabel = new Gtk.Label({label: '', wrap: true, selectable: true, max_width_chars: 35});
        selectedPathLabel.set_ellipsize(3);
        let selectedSizeLabel = new Gtk.Label({label: '', wrap: true, max_width_chars: 35}),
            selectedDateLabel = new Gtk.Label({label: '', wrap: true, max_width_chars: 35}),
            deleteButton = new Gtk.Button({label: '🗑️ ' + t('DEPENDENCY_ISOLATION_DELETE_PROGRAM')});
        deleteButton.get_style_context().add_class('destructive-action');
        addPointerCursor(deleteButton);
        deleteButton.set_sensitive(false);

        let refreshProgramsButton = new Gtk.Button({label: '🔄 ' + (t('DEPENDENCY_ISOLATION_REFRESH_LIST') || 'Refresh')});
        addPointerCursor(refreshProgramsButton);

        detailsBox.pack_start(selectedProgramLabel, false, false, 0);
        detailsBox.pack_start(selectedPathLabel, false, false, 0);
        detailsBox.pack_start(selectedSizeLabel, false, false, 0);
        detailsBox.pack_start(selectedDateLabel, false, false, 0);
        detailsBox.pack_start(deleteButton, false, false, 0);
        detailsBox.pack_start(refreshProgramsButton, false, false, 0);

        detailsFrame.add(detailsBox);
        programsBox.pack_start(detailsFrame, false, false, 0);

        programsOuterBox.pack_start(programsBox, true, true, 0);
        programsFrame.add(programsOuterBox);

        let programsData = new Map(),
            state = {
            t,
            currentViewMode: 'by-type',
            programsTreeStore,
            programsTreeView,
            programsData,
            selectedItems,
            updateSelectionState,
            programsSpinnerBox,
            programsSpinner,
            selectedProgramLabel,
            refreshProgramsButton,
            deleteAllButton,
            totalSizeLabel,
            programsHeaderLabel,
            listIsolationProgramsAsync: this.listIsolationProgramsAsync.bind(this),
            loadVersionsAsync: this.loadVersionsAsync.bind(this)
        };

        let populatePrograms = () => populateProgramsList(state),
            isConfirmed = ({messageType = Gtk.MessageType.QUESTION, text = '', secondaryText = ''}) =>
            runMessageDialog({
                parent: dialog,
                messageType,
                buttons: Gtk.ButtonsType.YES_NO,
                title: text,
                secondaryText
            }) === Gtk.ResponseType.YES;

        function getSelectedProgram() {
            let [selected, model, iter] = programsTreeView.get_selection().get_selected();
            return selected ? {
                typeIcon: model.get_value(iter, PROGRAM_TREE_COLUMN.TYPE),
                program: model.get_value(iter, PROGRAM_TREE_COLUMN.PROGRAM),
                version: model.get_value(iter, PROGRAM_TREE_COLUMN.VERSION),
                rice: model.get_value(iter, PROGRAM_TREE_COLUMN.RICE),
                path: model.get_value(iter, PROGRAM_TREE_COLUMN.PATH),
                size: model.get_value(iter, PROGRAM_TREE_COLUMN.SIZE)
            } : null;
        }

        function clearSelectedProgramDetails() {
            selectedProgramLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROGRAM'));
            selectedPathLabel.set_text('');
            selectedSizeLabel.set_text('');
            selectedDateLabel.set_text('');
            selectedItems.size === 0 && deleteButton.set_sensitive(false);
        }

        function showSelectedProgramDetails(selectedProgram) {
            let riceInfo = selectedProgram.rice && selectedProgram.rice !== UNKNOWN_VALUE ? ` (${selectedProgram.rice})` : '';
            selectedProgramLabel.set_text(`${selectedProgram.typeIcon} ${selectedProgram.program} ${selectedProgram.version}${riceInfo}`);
            selectedPathLabel.set_text(`${t('DEPENDENCY_ISOLATION_LABEL_PATH')} ${formatPath(selectedProgram.path, homeDir)}`);
            selectedSizeLabel.set_text(`${t('DEPENDENCY_ISOLATION_LABEL_SIZE')} ${selectedProgram.size}`);

            let progData = programsData.get(selectedProgram.path);
            selectedDateLabel.set_text(
                progData?.mtime ? `${t('DEPENDENCY_ISOLATION_INSTALLED_ON')} ${formatDate(progData.mtime)}` : ''
            );
            selectedItems.size === 0 && deleteButton.set_sensitive(Boolean(selectedProgram.path));
        }

        programsTreeView.get_selection().connect('changed', () => {
            let selectedProgram = getSelectedProgram();
            selectedProgram ? showSelectedProgramDetails(selectedProgram) : clearSelectedProgramDetails();
        });

        deleteButton.connect('clicked', () => {

            if (selectedItems.size > 0) {
                let count = selectedItems.size,
                    confirmed = isConfirmed({
                    text: (t('DEPENDENCY_ISOLATION_DELETE_MULTI_CONFIRM') || 'Delete {count} selected programs?').replace('{count}', count),
                    secondaryText: t('DEPENDENCY_ISOLATION_DELETE_MULTI_WARNING') || 'This action cannot be undone.'
                });
                confirmed && (() => {
                    for (const [filePath] of selectedItems) {
                        this.deleteIsolationProgram(filePath);
                    }
                    selectedItems.clear();
                    populatePrograms();
                    this.notify((t('DEPENDENCY_ISOLATION_PROGRAMS_DELETED') || '{count} programs deleted').replace('{count}', count));
                })();
                return;
            }

            let selectedProgram = getSelectedProgram();
            if (!selectedProgram) {
                return;
            }
            let displayPath = formatPath(selectedProgram.path, homeDir),
                confirmed = isConfirmed({
                text: t('DEPENDENCY_ISOLATION_DELETE_CONFIRM')
                    .replace('{program}', selectedProgram.program)
                    .replace('{version}', selectedProgram.version),
                secondaryText: t('DEPENDENCY_ISOLATION_DELETE_WARNING').replace('{path}', displayPath)
            });
            confirmed && (() => {
                this.deleteIsolationProgram(selectedProgram.path);
                populatePrograms();
                this.notify(
                    t('DEPENDENCY_ISOLATION_PROGRAM_DELETED')
                        .replace('{program}', selectedProgram.program)
                        .replace('{version}', selectedProgram.version)
                );
            })();
        });

        refreshProgramsButton.connect('clicked', () => populatePrograms());

        viewModeCombo.connect('changed', () => {
            let activeIter = viewModeCombo.get_active_iter(),
                mode = activeIter[0] ? viewModeStore.get_value(activeIter[1], 0) : state.currentViewMode;
            mode !== state.currentViewMode && (state.currentViewMode = mode, populatePrograms());
        });

        deleteAllButton.connect('clicked', () => {

            let allPaths = Array.from(programsData.keys());
            if (allPaths.length === 0) {
                return;
            }

            let count = allPaths.length,
                confirmed = isConfirmed({
                messageType: Gtk.MessageType.WARNING,
                text: (t('DEPENDENCY_ISOLATION_DELETE_ALL_CONFIRM') || 'Delete ALL {count} installed programs?').replace('{count}', count),
                secondaryText: t('DEPENDENCY_ISOLATION_DELETE_ALL_WARNING') || 'This will remove all isolated dependencies. This action cannot be undone!'
            });
            confirmed && (() => {
                for (const path of new Set(allPaths)) {
                    this.deleteIsolationProgram(path);
                }

                selectedItems.clear();
                populatePrograms();
                this.notify((t('DEPENDENCY_ISOLATION_ALL_DELETED') || 'All {count} programs deleted').replace('{count}', count));
            })();
        });

        return {frame: programsFrame, populateProgramsList: populatePrograms};
    }

}

export function applyAdvancedTabDependencyIsolationDialogPrograms(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationDialogPrograms.prototype);
}
