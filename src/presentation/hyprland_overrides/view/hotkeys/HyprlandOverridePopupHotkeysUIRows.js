import Gtk from 'gi://Gtk?version=3.0';
import { HotkeyAction, HotkeySource } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { determineHotkeyDisplayState } from './HyprlandOverridePopupHotkeysFormat.js';
import {
    appendStandardHotkeyRowActions,
    createGlobalHotkeyToggleButton,
    createHotkeyDeleteButton,
    createHotkeyDigButton,
    createHotkeyRowBox
} from '../../../common/HotkeyRowControlsShared.js';

export function applyHyprlandOverridePopupHotkeysUIRows(prototype) {
    prototype.buildHotkeySubRow = function(hotkey, override, source, isOverridden, isDeleted = false, options = {}) {
        const row = createHotkeyRowBox();

        isDeleted && row.get_style_context().add_class('hotkey-deleted');

        const keyLabel = new Gtk.Label({
            label: hotkey.displayKeyCombo,
            halign: Gtk.Align.START
        });
        keyLabel.get_style_context().add_class('hotkey-key-combo');
        isDeleted && keyLabel.get_style_context().add_class('strikethrough');
        keyLabel.set_size_request(150, -1);
        row.pack_start(keyLabel, false, false, 0);

        isDeleted
            ? (() => {
                const deletedLabel = new Gtk.Label({
                    label: this.t('MARKED_FOR_DELETION') || '(will be unbound)',
                    halign: Gtk.Align.START
                });
                deletedLabel.get_style_context().add_class('destructive-label');
                deletedLabel.get_style_context().add_class('dim-label');
                row.pack_start(deletedLabel, true, true, 0);

                const undoBtn = new Gtk.Button({ label: this.t('UNDO') || 'Undo' });
                undoBtn.get_style_context().add_class('suggested-action');
                const onUndo = options.onUndo || (() => this.refreshHotkeysDeferred());
                undoBtn.connect('clicked', () => {
                    delete this.currentHotkeyOverrides[hotkey.id];
                    onUndo(hotkey.id, row);
                });
                this.applyPointerCursor(undoBtn);
                row.pack_start(undoBtn, false, false, 0);
            })()
            : (() => {
                const {
                    action: currentAction,
                    effectiveSource,
                    isUseGlobal,
                    isGlobalActive
                } = determineHotkeyDisplayState(this, { hotkey, override, source });

                const actionEntry = new Gtk.Entry({
                    text: currentAction,
                    width_chars: 25
                });

                const sourceClass = (effectiveSource === HotkeySource.GLOBAL || isUseGlobal)
                    ? 'global-override-label'
                    : (effectiveSource === HotkeySource.PER_RICE ? 'per-rice-override-label' : null);
                sourceClass && keyLabel.get_style_context().add_class(sourceClass);

                actionEntry.set_sensitive(!isUseGlobal);

                actionEntry.connect('changed', () => {
                    !isUseGlobal && this.handleHotkeyActionChange(hotkey.id, actionEntry.get_text().trim(), hotkey);
                });
                row.pack_start(actionEntry, true, true, 0);

                const hasOverride = override && (override.action === HotkeyAction.REPLACE || override.dispatcher);
                const onDelete = options.onDelete || (() => this.refreshHotkeysDeferred());
                const initiator = this.globalHotkeyInitiators?.[hotkey.id];
                const digActive = isGlobalActive
                    && this.globalHotkeyOverrides?.[hotkey.id]
                    && initiator === this.currentTheme?.name;

                const { digBtn } = appendStandardHotkeyRowActions({
                    context: this,
                    row,
                    isGlobalActive,
                    isUseGlobal,
                    hasOverride,
                    originalAction: hotkey.displayAction,
                    globalTooltip: this.t('USE_GLOBAL_HOTKEY') || 'Delegate to global override',
                    digTooltip: this.t('DUPLICATE_IN_GLOBAL_HOTKEY') || 'Duplicate in global and delegate',
                    resetTooltip: this.t('RESET_TO_ORIGINAL') || 'Reset to original value',
                    deleteTooltip: this.t('DELETE_HOTKEY') || 'Mark for deletion (unbind)',
                    onGlobalToggle: (active) => {
                        this.handleGlobalToggle(hotkey.id, active, hotkey);
                        this.refreshHotkeysDeferred();
                    },
                    onDig: () => {
                        this.handleGlobalDuplicate(hotkey.id, hotkey, override);
                        this.refreshHotkeysDeferred();
                    },
                    onReset: () => {
                        delete this.currentHotkeyOverrides[hotkey.id];
                        this.refreshHotkeysDeferred();
                    },
                    onDelete: () => {
                        this.handleHotkeyDelete(hotkey.id, hotkey);
                        onDelete(hotkey.id, row);
                    },
                    deleteCssClass: 'hotkey-delete-btn',
                    deleteApplyRoundStyle: true
                });

                digBtn && (() => {
                    const ctx = digBtn.get_style_context?.();
                    ctx && ctx[digActive ? 'add_class' : 'remove_class']('dig-active');
                    digBtn.set_sensitive(!digActive);
                })();
            })();

        return row;
    };

    prototype.buildAddedHotkeyRow = function(id, override, source) {
        const row = createHotkeyRowBox();
        row.get_style_context().add_class('added-hotkey');

        const isRecommended = override.isRecommended === true;

        const keyLabel = new Gtk.Label({
            label: this.formatKeyComboFromMetadata(override.metadata),
            halign: Gtk.Align.START
        });
        keyLabel.get_style_context().add_class('hotkey-key-combo');
        keyLabel.get_style_context().add_class('added-hotkey-label');
        keyLabel.get_style_context().add_class(source === 'global' ? 'global-override-label' : 'per-rice-override-label');
        keyLabel.set_size_request(150, -1);
        row.pack_start(keyLabel, false, false, 0);

        const actionEntry = new Gtk.Entry({
            text: `${override.dispatcher || ''} ${override.args || ''}`.trim(),
            width_chars: 25
        });
        actionEntry.connect('changed', () => {
            const text = actionEntry.get_text().trim();
            const parsed = this.parseAction(text);
            parsed && (this.currentHotkeyOverrides[id] = {
                ...override,
                dispatcher: parsed.dispatcher,
                args: parsed.args,
                timestamp: Date.now()
            });
        });
        row.pack_start(actionEntry, true, true, 0);

        const isGlobalActive = source === 'global';
        const globalBtn = createGlobalHotkeyToggleButton({
            context: this,
            active: isGlobalActive,
            tooltip: this.t('USE_GLOBAL_HOTKEY') || 'Delegate to global override',
            onToggle: (active) => {
                this.handleAddedHotkeyGlobalToggle(id, override, active);
                this.refreshHotkeysDeferred();
            }
        });
        row.pack_start(globalBtn, false, false, 0);

        const digBtn = createHotkeyDigButton({
            context: this,
            tooltip: this.t('DUPLICATE_IN_GLOBAL_HOTKEY') || 'Duplicate in global and delegate',
            onClick: () => {
                this.handleAddedHotkeyDuplicate(id, override);
                this.refreshHotkeysDeferred();
            }
        });
        const digActive = isGlobalActive
            && this.globalHotkeyOverrides?.[id]
            && this.globalHotkeyInitiators?.[id] === this.currentTheme?.name;
        digBtn.set_sensitive(!digActive);
        digActive && digBtn.get_style_context().add_class('dig-active');
        row.pack_start(digBtn, false, false, 0);

        !isRecommended && (() => {
            const removeBtn = createHotkeyDeleteButton({
                context: this,
                tooltip: this.t('REMOVE_ADDED_HOTKEY') || 'Remove added hotkey',
                onClick: () => {
                    delete this.currentHotkeyOverrides[id];
                    this.refreshHotkeysDeferred();
                },
                cssClass: 'hotkey-round-danger',
                applyRoundStyle: true
            });
            row.pack_start(removeBtn, false, false, 0);
        })();

        return row;
    };
}
