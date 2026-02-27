import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import Pango from 'gi://Pango';
import {addPointerCursor, setupPointerCursors} from '../../../common/ViewUtils.js';

export function applyAdvancedTabBars(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, AdvancedTabBars.prototype);
}

class AdvancedTabBars {
    buildSupportedBarsSection(box) {
        const supportedBarsRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        supportedBarsRow.pack_start(
            new Gtk.Label({label: this.t('SUPPORTED_BARS_LABEL'), halign: Gtk.Align.START}),
            false,
            false,
            0
        );

        const editBarsButton = new Gtk.Button({
            label: '📝',
            tooltip_text: this.t('EDIT_BARS_TOOLTIP')
        });
        editBarsButton.set_size_request(32, 32);
        addPointerCursor(editBarsButton);

        editBarsButton.connect('clicked', () => {
            this.createBarEditorDialog
                ? this.createBarEditorDialog(this.dialog, this.settings, this.writeSettingsFile, () => {
                    this.refreshBarCombos();
                })
                : this.openBarEditor();
        });

        supportedBarsRow.pack_start(editBarsButton, false, false, 0);
        box.pack_start(supportedBarsRow, false, false, 0);
    }

    buildBarSettingsSection(box) {
        const altRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        altRow.pack_start(
            new Gtk.Label({label: this.t('ALT_BAR_LABEL'), halign: Gtk.Align.START}),
            false,
            false,
            0
        );

        const altBarCombo = new Gtk.ComboBoxText();
        altBarCombo.append('none', this.t('NONE'));
        this.BarRegistry && this.BarRegistry.getIds().forEach(bar => altBarCombo.append(bar, bar));
        altBarCombo.set_active_id(this.settings.alt_bar || 'none');
        this.widgets.altBarCombo = altBarCombo;
        altRow.pack_start(altBarCombo, false, false, 0);

        const timeoutEntry = new Gtk.Entry({text: String(this.settings.alt_timeout || 3)});
        timeoutEntry.set_size_request(30, 30);
        timeoutEntry.set_max_length(2);
        this.widgets.altTimeoutEntry = timeoutEntry;
        altRow.pack_start(timeoutEntry, false, false, 0);

        altRow.pack_start(
            new Gtk.Label({
                label: `${this.t('SEC_SUFFIX')} (${this.t('ALT_TIMEOUT_DESC')})`,
                halign: Gtk.Align.START
            }),
            false,
            false,
            0
        );

        altBarCombo.connect('changed', this.guardStoreUpdate(() => {
            this.settings.alt_bar = altBarCombo.get_active_id();
            this.writeSettingsFile();
        }));

        timeoutEntry.connect('changed', this.guardStoreUpdate(() => {
            const val = parseInt(timeoutEntry.get_text(), 10);
            this.settings.alt_timeout = isNaN(val) ? 3 : val;
            this.writeSettingsFile();
        }));

        box.pack_start(altRow, false, false, 0);

        const altNote = new Gtk.Label({label: this.t('ALT_BAR_NOTE'), wrap: true, xalign: 0});
        altNote.set_margin_top(4);
        box.pack_start(altNote, false, false, 0);

        this.addSeparator(box, 6);

        const defaultRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        defaultRow.pack_start(
            new Gtk.Label({label: this.t('DEFAULT_BAR_LABEL'), halign: Gtk.Align.START}),
            false,
            false,
            0
        );

        const defaultBarCombo = new Gtk.ComboBoxText();
        this.BarRegistry
            ? ['none', ...this.BarRegistry.getIds()].forEach(bar =>
                defaultBarCombo.append(bar, bar === 'none' ? this.t('NONE') : bar))
            : defaultBarCombo.append('none', this.t('NONE'));
        defaultBarCombo.set_active_id(this.settings.default_theme_bar || 'none');
        this.widgets.defaultBarCombo = defaultBarCombo;
        defaultRow.pack_start(defaultBarCombo, false, false, 0);

        const defaultBarStatusLabel = new Gtk.Label({
            label: this.settings.default_bar_manual ? this.t('SELECTED_BY_USER') : this.t('SELECTED_AUTOMATICALLY'),
            wrap: true,
            xalign: 0
        });
        this.widgets.defaultBarStatusLabel = defaultBarStatusLabel;
        defaultRow.pack_start(defaultBarStatusLabel, false, false, 0);

        defaultBarCombo.connect('changed', this.guardStoreUpdate(() => {
            this.defaultBarManualChanged.value = true;
            this.settings.default_theme_bar = defaultBarCombo.get_active_id() || 'none';
            this.settings.default_bar_manual = true;
            defaultBarStatusLabel.set_label(this.t('SELECTED_BY_USER'));
            this.writeSettingsFile();
        }));

        box.pack_start(defaultRow, false, false, 0);

        const defaultBarNoteLabel = new Gtk.Label({
            label: this.t('DEFAULT_BAR_NOTE') + ' ' + this.t('DEFAULT_SCRIPT_NOTE'),
            wrap: true,
            xalign: 0,
            max_width_chars: 50
        });
        defaultBarNoteLabel.set_line_wrap(true);
        defaultBarNoteLabel.set_line_wrap_mode?.(Pango.WrapMode.WORD_CHAR);
        box.pack_start(defaultBarNoteLabel, false, false, 0);
    }

    openBarEditor() {
        const t = this.t;
        if (!this.BarRegistry) return this.notify(t('BAR_EDITOR_NO_REGISTRY'));

        const dialog = new Gtk.Dialog({
                    title: t('BAR_EDITOR_TITLE'),
                    modal: true,
                    resizable: true,
                    default_width: 720,
                    default_height: 700,
                    type_hint: Gdk.WindowTypeHint.DIALOG,
                    transient_for: this.dialog
                });
                dialog.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);
                dialog.set_keep_above(true);

                const contentArea = dialog.get_content_area();
                contentArea.set_spacing(12);
                contentArea.set_margin_top(16);
                contentArea.set_margin_bottom(16);
                contentArea.set_margin_start(16);
                contentArea.set_margin_end(16);

                contentArea.pack_start(
                    new Gtk.Label({
                        label: t('BAR_EDITOR_DESCRIPTION'),
                        wrap: true,
                        xalign: 0
                    }),
                    false,
                    false,
                    0
                );

                const scrolled = new Gtk.ScrolledWindow({
                    hscrollbar_policy: Gtk.PolicyType.NEVER,
                    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
                });
                scrolled.set_min_content_height(400);

                const grid = new Gtk.Grid({
                    column_spacing: 10,
                    row_spacing: 10,
                    column_homogeneous: true
                });
                scrolled.add(grid);
                contentArea.pack_start(scrolled, true, true, 0);

                const customBars = this.settings.customBars ?? [];
                const defaultBars = this.BarRegistry.getDefaultBars?.() ?? [];
                const editedBars = {};
                let gridItemCount = 0;

                const addToGrid = (widget) => {
                    const row = Math.floor(gridItemCount / 2);
                    grid.attach(widget, gridItemCount % 2, row, 1, 1);
                    gridItemCount++;
                };

                const createBarCard = (bar, isCustom) => {
                    const frame = new Gtk.Frame();
                    frame.get_style_context().add_class('widget-card');
                    const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6});
                    box.set_margin_top(10);
                    box.set_margin_bottom(10);
                    box.set_margin_start(10);
                    box.set_margin_end(10);
                    box.set_hexpand(true);

                    const headerBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
                    const nameBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
                    nameBox.set_hexpand(true);

                    const nameLabel = new Gtk.Label({label: bar.id, xalign: 0, halign: Gtk.Align.START});
                    nameLabel.get_style_context().add_class('bar-id-label');
                    nameBox.pack_start(nameLabel, false, false, 0);

                    if (isCustom) {
                        const customBadgeLabel = new Gtk.Label({label: t('BAR_CUSTOM_BADGE'), xalign: 0, halign: Gtk.Align.START});
                        customBadgeLabel.get_style_context().add_class('bar-custom-badge');
                        nameBox.pack_start(customBadgeLabel, false, false, 0);
                    }

                    headerBox.pack_start(nameBox, true, true, 0);

                    if (isCustom) {
                        const deleteBtn = new Gtk.Button({label: '✕'});
                        deleteBtn.get_style_context().add_class('destructive-action');
                        deleteBtn.get_style_context().add_class('flat');
                        addPointerCursor(deleteBtn);
                        deleteBtn.connect('clicked', () => {
                            editedBars[bar.id] = null;
                            frame.destroy();
                        });
                        headerBox.pack_end(deleteBtn, false, false, 0);
                    }
                    box.pack_start(headerBox, false, false, 0);

                    const createCommandRow = (labelText, initialValue, onChange) => {
                        const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4}),
                            label = new Gtk.Label({label: labelText, xalign: 0}),
                            entry = new Gtk.Entry({text: initialValue, hexpand: true});
                        label.set_size_request(45, -1);
                        entry.connect('changed', () => onChange(entry.get_text()));
                        row.pack_start(label, false, false, 0);
                        row.pack_start(entry, true, true, 0);
                        return row;
                    };

                    box.pack_start(createCommandRow(t('BAR_START_CMD'), bar.startCmd || bar.id, (value) => {
                        editedBars[bar.id] ||= {...bar};
                        editedBars[bar.id].startCmd = value;
                    }), false, false, 0);

                    box.pack_start(createCommandRow(t('BAR_KILL_CMD'), bar.killCmd || `pkill ${bar.id}`, (value) => {
                        editedBars[bar.id] ||= {...bar};
                        editedBars[bar.id].killCmd = value;
                    }), false, false, 0);

                    frame.add(box);
                    frame.barId = bar.id;
                    frame.isCustom = isCustom;
                    return frame;
                };

                defaultBars.forEach(bar => {
                    const customOverride = customBars.find(c => c.id === bar.id);
                    const mergedBar = customOverride ? {...bar, ...customOverride} : bar;
                    addToGrid(createBarCard(mergedBar, false));
                });

                customBars.filter(c => !defaultBars.some(d => d.id === c.id)).forEach(bar => {
                    addToGrid(createBarCard(bar, true));
                });

                const addBarBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, margin_top: 12});
                const newBarEntry = new Gtk.Entry({placeholder_text: t('NEW_BAR_ID_PLACEHOLDER')});
                newBarEntry.set_size_request(150, -1);
                const addBarBtn = new Gtk.Button({label: t('ADD_BAR')});
                addBarBtn.get_style_context().add_class('green-button');
                addPointerCursor(addBarBtn);
                addBarBtn.connect('clicked', () => {
                    const newId = newBarEntry.get_text().trim();
                    const canAdd = newId && !(this.BarRegistry.getById?.(newId) || editedBars[newId]);
                    if (canAdd) {
                        const newBar = {
                            id: newId,
                            name: newId,
                            process: newId,
                            startCmd: newId,
                            killCmd: `pkill ${newId}`
                        };
                        editedBars[newId] = newBar;
                        const card = createBarCard(newBar, true);
                        addToGrid(card);
                        grid.show_all();
                        newBarEntry.set_text('');

                        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                            const adj = scrolled.get_vadjustment();
                            adj.set_value(adj.get_upper());
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                });
                addBarBox.pack_start(newBarEntry, false, false, 0);
                addBarBox.pack_start(addBarBtn, false, false, 0);
                contentArea.pack_start(addBarBox, false, false, 0);

                dialog.add_button(t('CANCEL'), Gtk.ResponseType.CANCEL);
                dialog.add_button(t('SAVE'), Gtk.ResponseType.OK).get_style_context().add_class('suggested-action');

                dialog.show_all();
                setupPointerCursors(dialog);

                dialog.connect('response', (_, responseId) => {
                    if (responseId === Gtk.ResponseType.OK) {
                        const newCustomBars = [];

                        for (const [barId, barData] of Object.entries(editedBars).filter(([, data]) => data !== null)) {
                            const defaultBar = defaultBars.find(b => b.id === barId);
                            const isDefaultBar = this.BarRegistry.isDefaultBar?.(barId);
                            const hasChangedDefaultCommands = defaultBar
                                && (barData.startCmd !== defaultBar.startCmd || barData.killCmd !== defaultBar.killCmd);

                            isDefaultBar && hasChangedDefaultCommands && newCustomBars.push({
                                id: barId,
                                startCmd: barData.startCmd,
                                killCmd: barData.killCmd
                            });
                            !isDefaultBar && newCustomBars.push(barData);
                        }

                        this.settings.customBars = [
                            ...(this.settings.customBars ?? []).filter(c => !editedBars.hasOwnProperty(c.id)),
                            ...newCustomBars
                        ];

                        this.BarRegistry.setCustomBars && this.BarRegistry.setCustomBars(this.settings.customBars);

                        this.writeSettingsFile();

                        this.refreshBarCombos();
                    }
                    dialog.destroy();
                });
    }
}
