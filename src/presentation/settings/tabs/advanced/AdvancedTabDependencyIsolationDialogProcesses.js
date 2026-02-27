import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GObject from 'gi://GObject';
import { addPointerCursor, runMessageDialog } from '../../../common/ViewUtils.js';

class AdvancedTabDependencyIsolationDialogProcesses {

    buildDependencyIsolationProcessesSection(dialog) {
        const t = this.t;

        const processesFrame = new Gtk.Frame({label: t('DEPENDENCY_ISOLATION_ACTIVE_ISOLATION_PROCESSES') || 'Active Isolation Processes'}),
            processesOuterBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8}),
            processesSpinnerBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, halign: Gtk.Align.CENTER}),
            processesSpinner = new Gtk.Spinner();
        processesSpinner.set_size_request(20, 20);
        processesSpinnerBox.pack_start(processesSpinner, false, false, 0);
        processesSpinnerBox.pack_start(new Gtk.Label({label: t('DEPENDENCY_ISOLATION_LOADING') || 'Loading...'}), false, false, 0);
        processesOuterBox.pack_start(processesSpinnerBox, false, false, 0);

        const processesBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8}),
            processesScrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                min_content_width: 300,
                min_content_height: 150
            }),
            processesListStore = new Gtk.ListStore();
        processesListStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING]);

        const processesTreeView = new Gtk.TreeView({model: processesListStore});
        processesTreeView.set_headers_visible(true);
        processesTreeView.set_rules_hint(true);
        processesTreeView.set_grid_lines(Gtk.TreeViewGridLines.BOTH);

        const addColumn = (title, textIndex, opts = {}) => {
            const col = new Gtk.TreeViewColumn({title, min_width: opts.minWidth || 50, resizable: true, ...(opts.expand ? {expand: true} : {})}),
                renderer = new Gtk.CellRendererText();
            opts.ellipsize && renderer.set_property('ellipsize', 3);
            col.pack_start(renderer, true);
            col.add_attribute(renderer, 'text', textIndex);
            processesTreeView.append_column(col);
        };
        addColumn(t('DEPENDENCY_ISOLATION_PID'), 0, {minWidth: 60});
        addColumn(t('DEPENDENCY_ISOLATION_TYPE') || 'Type', 1, {minWidth: 90});
        addColumn(t('DEPENDENCY_ISOLATION_COMMAND'), 2, {minWidth: 50, expand: true, ellipsize: true});
        addColumn(t('DEPENDENCY_ISOLATION_PREFIX'), 3, {minWidth: 150});

        processesScrolled.add(processesTreeView);
        processesBox.pack_start(processesScrolled, true, true, 0);

        const processActionsFrame = new Gtk.Frame({label: t('DEPENDENCY_ISOLATION_PROCESS_ACTIONS')}),
            processActionsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin: 8});
        processActionsBox.get_style_context().add_class('dependency-isolation-process-box');

        const makeWrappedLabel = (text, opts = {}) => {
            const lbl = new Gtk.Label({label: text, wrap: true, max_width_chars: 40, ...opts});
            lbl.set_line_wrap(true);
            lbl.set_ellipsize(3);
            return lbl;
        };
        const selectedProcessLabel = makeWrappedLabel(t('DEPENDENCY_ISOLATION_SELECT_PROCESS')),
            selectedProcessPathLabel = makeWrappedLabel('', {selectable: true}),
            selectedProcessCmdLabel = makeWrappedLabel('', {selectable: true});

        const killButton = new Gtk.Button({label: '⚠️ ' + t('DEPENDENCY_ISOLATION_TERMINATE_PROCESS')});
        killButton.get_style_context().add_class('destructive-action');
        addPointerCursor(killButton);

        const refreshButton = new Gtk.Button({label: '🔄 ' + t('DEPENDENCY_ISOLATION_REFRESH_LIST')});
        addPointerCursor(refreshButton);

        killButton.set_sensitive(false);

        processActionsBox.pack_start(selectedProcessLabel, false, false, 0);
        processActionsBox.pack_start(selectedProcessPathLabel, false, false, 0);
        processActionsBox.pack_start(selectedProcessCmdLabel, false, false, 0);
        processActionsBox.pack_start(killButton, false, false, 0);
        processActionsBox.pack_start(refreshButton, false, false, 0);

        processActionsFrame.add(processActionsBox);
        processesBox.pack_start(processActionsFrame, false, false, 0);

        processesOuterBox.pack_start(processesBox, true, true, 0);
        processesFrame.add(processesOuterBox);

        const processesData = [];

        const populateProcessesList = () => {
            processesListStore.clear();
            processesData.length = 0;
            processesSpinnerBox.show_all();
            processesSpinner.start();
            selectedProcessLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROCESS'));
            refreshButton.set_sensitive(false);

            this.listIsolationProcessesAsync((processes) => {
                processesSpinner.stop();
                processesSpinnerBox.set_visible(false);
                processesBox.show_all();
                refreshButton.set_sensitive(true);

                if (!processes || processes.length === 0) {
                    const iter = processesListStore.append();
                    processesListStore.set(iter, [0, 1, 2, 3], ['—', '—', t('DEPENDENCY_ISOLATION_NO_PROCESSES') || 'No active isolation processes', '—']);
                    selectedProcessLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROCESS'));
                    return;
                }

                const getProcTypeIcon = (type) => {
                    switch (type) {
                        case 'shared': return '📦 Hybrid';
                        case 'per-rice': return '🍚 Per-Rice';
                        case 'per-program': return '🔧 Per-Prog';
                        default: return '❓ Unknown';
                    }
                };

                processes.forEach(proc => {
                    processesData.push(proc);
                    const iter = processesListStore.append();
                    processesListStore.set(iter, [0, 1, 2, 3], [
                        proc.pid || '',
                        getProcTypeIcon(proc.type),
                        (proc.command || '').substring(0, 100),
                        proc.prefix || ''
                    ]);
                });

                selectedProcessLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROCESS'));
            });
        };

        processesTreeView.get_selection().connect('changed', () => {
            const [selected, model, iter] = processesTreeView.get_selection().get_selected();
            selected
                ? (() => {
                    const pid = model.get_value(iter, 0), typeIcon = model.get_value(iter, 1),
                        command = model.get_value(iter, 2), prefix = model.get_value(iter, 3);
                    selectedProcessLabel.set_text(`${t('DEPENDENCY_ISOLATION_LABEL_PROCESS')} PID ${pid} (${typeIcon})`);
                    selectedProcessPathLabel.set_text(`${t('DEPENDENCY_ISOLATION_LABEL_PREFIX')} ${prefix}`);
                    selectedProcessCmdLabel.set_text(`${t('DEPENDENCY_ISOLATION_LABEL_COMMAND')} ${command}`);
                    killButton.set_sensitive(pid !== '' && pid !== t('ERROR'));
                })()
                : (
                    selectedProcessLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROCESS')),
                    selectedProcessPathLabel.set_text(''),
                    selectedProcessCmdLabel.set_text(''),
                    killButton.set_sensitive(false)
                );
        });

        killButton.connect('clicked', () => {
            const [selected, model, iter] = processesTreeView.get_selection().get_selected();
            if (selected) {
                const pid = model.get_value(iter, 0), command = model.get_value(iter, 2);

                const confirmed = runMessageDialog({
                    parent: dialog,
                    messageType: Gtk.MessageType.QUESTION,
                    buttons: Gtk.ButtonsType.YES_NO,
                    title: t('DEPENDENCY_ISOLATION_KILL_CONFIRM').replace('{pid}', pid),
                    secondaryText: t('DEPENDENCY_ISOLATION_KILL_WARNING').replace('{command}', command)
                }) === Gtk.ResponseType.YES;
                if (confirmed) {
                    this.terminateIsolationProcess(pid);
                    populateProcessesList();
                    this.notify(t('DEPENDENCY_ISOLATION_PROCESS_TERMINATED').replace('{pid}', pid));
                }
            }
        });

        refreshButton.connect('clicked', () => populateProcessesList());

        return {frame: processesFrame, populateProcessesList};
    }

}

export function applyAdvancedTabDependencyIsolationDialogProcesses(prototype) {
    copyPrototypeDescriptors(prototype, AdvancedTabDependencyIsolationDialogProcesses.prototype);
}
