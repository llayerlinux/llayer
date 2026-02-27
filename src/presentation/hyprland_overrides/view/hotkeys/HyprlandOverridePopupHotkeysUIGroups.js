import Gtk from 'gi://Gtk?version=3.0';
import { HotkeyAction, HotkeySource } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { determineHotkeyDisplayState } from './HyprlandOverridePopupHotkeysFormat.js';

export function applyHyprlandOverridePopupHotkeysUIGroups(prototype) {
    prototype.buildHotkeyGroupRow = function(group) {
        let container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        container.get_style_context().add_class('hotkey-group');

        let getInMemoryOverride = (id) => this.currentHotkeyOverrides?.[id],
            getResolvedItemOverride = (item) => item.hotkey ? (getInMemoryOverride(item.hotkey.id) || item.override) : item.override,
            isDeletedItem = (item) => getInMemoryOverride(item.hotkey?.id)?.action === HotkeyAction.DELETE;

        let filteredAddedHotkeys = group.addedHotkeys.filter(item => {
            let inMemory = getInMemoryOverride(item.id);
            return !inMemory || inMemory.action !== HotkeyAction.DELETE;
        });

        let itemPriority = (item) => item.hotkey
            ? (() => {
                let displayState = determineHotkeyDisplayState(this, {
                    hotkey: item.hotkey,
                    override: item.override,
                    source: item.source
                });
                let effectiveSource = displayState.isUseGlobal && !displayState.hasGlobalOverride
                    ? HotkeySource.ORIGINAL
                    : displayState.effectiveSource;
                return ({
                    [HotkeySource.GLOBAL]: 0,
                    [HotkeySource.PER_RICE]: 1
                })[effectiveSource] ?? 2;
            })()
            : ({ global: 0, 'per-rice': 1 })[item.source] ?? 2;

        let buildGroupItemRow = (item, marginStart = 0) => {
            let row = item.hotkey
                ? this.buildHotkeySubRow(
                    item.hotkey,
                    getResolvedItemOverride(item),
                    item.source,
                    item.isOverridden,
                    isDeletedItem(item)
                )
                : (item.override ? this.buildAddedHotkeyRow(item.id, item.override, item.source) : null);
            row && marginStart > 0 && row.set_margin_start(marginStart);
            return row;
        };

        let allHotkeys = [...group.hotkeys, ...filteredAddedHotkeys]
            .sort((a, b) => itemPriority(a) - itemPriority(b));

        switch (allHotkeys.length) {
        case 0:
            return container;
        case 1: {
            let item = allHotkeys[0],
                row = buildGroupItemRow(item);
            row && container.pack_start(row, false, false, 0);
            break;
        }
        default: {
            let headerRow = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8
            });
            headerRow.get_style_context().add_class('hotkey-group-header');

            let keyLabel = new Gtk.Label({
                label: group.displayKeyCombo,
                halign: Gtk.Align.START
            });
            keyLabel.get_style_context().add_class('hotkey-key-combo');
            let groupPriority = this.getGroupPriority(group),
                sourceClass = ({
                0: 'global-override-label',
                1: 'per-rice-override-label'
            })[groupPriority];
            sourceClass && keyLabel.get_style_context().add_class(sourceClass);
            keyLabel.set_size_request(150, -1);
            headerRow.pack_start(keyLabel, false, false, 0);

            let countLabel = new Gtk.Label({
                label: `(${allHotkeys.length} binds)`,
                halign: Gtk.Align.START
            });
            countLabel.get_style_context().add_class('dim-label');
            headerRow.pack_start(countLabel, false, false, 0);

            container.get_style_context().add_class('hotkey-group-multi');
            container.pack_start(headerRow, false, false, 0);

            for (let item of allHotkeys) {
                let row = buildGroupItemRow(item, 24);
                row && container.pack_start(row, false, false, 0);
            }
        }
        }

        return container;
    };
}
