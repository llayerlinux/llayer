import Gtk from 'gi://Gtk?version=3.0';
import { HotkeyAction, HotkeySource } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { determineHotkeyDisplayState } from './HyprlandOverridePopupHotkeysFormat.js';
import {
    appendStandardHotkeyRowActions,
    createHotkeyDeleteButton,
    createHotkeyRowBox
} from '../../../common/HotkeyRowControlsShared.js';

function upsertAddedHotkeyOverride(context, item, patch = {}, metadataPatch = {}) {
    const target = context.currentHotkeyOverrides?.[item.id] || item.override || {};
    context.currentHotkeyOverrides[item.id] = {
        ...target,
        ...patch,
        action: HotkeyAction.ADD,
        metadata: {
            ...(target.metadata ?? {}),
            ...metadataPatch,
            bindType: target.metadata?.bindType || 'bind'
        },
        timestamp: Date.now()
    };
}

function determineMenuHotkeyActionText(context, item) {
    switch (item.type) {
    case 'hotkey':
        return determineHotkeyDisplayState(context, {
            hotkey: item.hotkey,
            override: item.override,
            source: item.source
        }).action;
    case 'added':
        return `${item.override?.dispatcher || ''} ${item.override?.args || ''}`.trim();
    default:
        return '';
    }
}

function hasMenuHotkeyItems(items) {
    return Array.isArray(items) && items.length > 0;
}

export function applyHyprlandOverridePopupHotkeysMenuUI(prototype) {
    prototype.buildMenuHotkeyRow = function(item) {
        const row = createHotkeyRowBox();

        const updateAddedHotkeyOverride = (parsed) => item.override && upsertAddedHotkeyOverride(
            this,
            item,
            {},
            {
                modifiers: parsed.modifiers,
                key: parsed.key
            }
        );

        const keyEntry = this.buildMenuKeyEntry(item, item.type === 'hotkey'
            ? item.hotkey?.displayKeyCombo
            : this.formatKeyComboFromMetadata(item.override?.metadata), (parsed) => {
            switch (item.type) {
                case 'hotkey':
                    this.applyMenuKeyChangeForHotkey(item, parsed, actionEntry?.get_text?.().trim() || actionText);
                    break;
                case 'added':
                    updateAddedHotkeyOverride(parsed);
                    break;
                default:
                    break;
            }
        });
        const actionText = determineMenuHotkeyActionText(this, item);

        keyEntry.set_size_request(160, -1);
        switch (item.source) {
            case HotkeySource.GLOBAL:
                keyEntry.get_style_context().add_class('global-override-label');
                break;
            case HotkeySource.PER_RICE:
                keyEntry.get_style_context().add_class('per-rice-override-label');
                break;
            default:
                break;
        }
        row.pack_start(keyEntry, false, false, 0);

        const actionEntry = new Gtk.Entry({
            text: actionText,
            width_chars: 25
        });
        actionEntry.set_placeholder_text(this.t('MENU_HOTKEY_COMMAND_PLACEHOLDER') || 'exec command...');
        actionEntry.connect('changed', () => {
            const text = actionEntry.get_text().trim();
            switch (item.type) {
                case 'hotkey':
                    this.applyMenuCommandChangeForHotkey(item, text);
                    return;
                case 'added': {
                    const parsed = this.parseAction(text);
                    parsed && upsertAddedHotkeyOverride(this, item, {
                        dispatcher: parsed.dispatcher,
                        args: parsed.args
                    });
                    return;
                }
                default:
                    return;
            }
        });
        row.pack_start(actionEntry, true, true, 0);

        const buildHotkeyActions = () => {
            const { isUseGlobal, isGlobalActive } = determineHotkeyDisplayState(this, {
                hotkey: item.hotkey,
                override: item.override,
                source: item.source
            });

            actionEntry.set_sensitive(!isUseGlobal);

            const hasOverride = item.override && (item.override.action === HotkeyAction.REPLACE || item.override.dispatcher);
            const globalOverride = this.globalHotkeyOverrides?.[item.hotkey.id];
            const initiator = this.globalHotkeyInitiators?.[item.hotkey.id];
            const digActive = isGlobalActive
                && !!globalOverride
                && initiator === this.currentTheme?.name;

            const { digBtn } = appendStandardHotkeyRowActions({
                context: this,
                row,
                isGlobalActive,
                isUseGlobal,
                hasOverride,
                originalAction: item.hotkey.displayAction,
                globalTooltip: this.t('USE_GLOBAL_HOTKEY') || 'Delegate to global override',
                digTooltip: this.t('DUPLICATE_IN_GLOBAL_HOTKEY') || 'Duplicate in global and delegate',
                resetTooltip: this.t('RESET_TO_ORIGINAL') || 'Reset to original value',
                deleteTooltip: this.t('DELETE_HOTKEY') || 'Mark for deletion (unbind)',
                onGlobalToggle: (active) => {
                    this.handleGlobalToggle(item.hotkey.id, active, item.hotkey);
                    this.refreshHotkeysDeferred();
                },
                onDig: () => {
                    this.handleGlobalDuplicate(item.hotkey.id, item.hotkey, item.override);
                    this.refreshHotkeysDeferred();
                },
                onReset: () => {
                    delete this.currentHotkeyOverrides[item.hotkey.id];
                    this.clearMenuRebindOverride(item.hotkey.id);
                    this.refreshHotkeysDeferred();
                },
                onDelete: () => {
                    this.handleHotkeyDelete(item.hotkey.id, item.hotkey);
                    this.refreshHotkeysDeferred();
                },
                deleteCssClass: 'hotkey-delete-btn',
                deleteApplyRoundStyle: true
            });

            digBtn && (() => {
                const ctx = digBtn.get_style_context?.();
                ctx && ctx[digActive ? 'add_class' : 'remove_class']('dig-active');
                digBtn.set_sensitive(!digActive);
            })();
        };
        const buildAddedActions = () => {
            const removeBtn = createHotkeyDeleteButton({
                context: this,
                tooltip: this.t('REMOVE_ADDED_HOTKEY') || 'Remove added hotkey',
                onClick: () => {
                    delete this.currentHotkeyOverrides[item.id];
                    this.refreshHotkeysDeferred();
                },
                cssClass: 'hotkey-round-danger',
                applyRoundStyle: true
            });
            row.pack_start(removeBtn, false, false, 0);
        };
        const actionBuilders = {
            hotkey: buildHotkeyActions,
            added: buildAddedActions
        };
        actionBuilders[item.type]?.();

        return row;
    };

    prototype.updateMenuNotice = function() {
        this.menuNoticeBox && (
            this.menuNoticeBox.get_children().forEach(child => child.destroy()),
            hasMenuHotkeyItems(this.menuHotkeyItems)
                ? (() => {
                    const container = new Gtk.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        spacing: 4,
                        margin_bottom: 6
                    });
                    container.get_style_context().add_class('menu-hotkey-box');

                    const headerRow = new Gtk.Box({
                        orientation: Gtk.Orientation.HORIZONTAL,
                        spacing: 8
                    });

                    const typesLabel = this.t('RICE_WIDGET_TYPES_LABEL') === 'RICE_WIDGET_TYPES_LABEL'
                        ? '\u043C\u0435\u043D\u044E, \u043F\u0430\u043D\u0435\u043B\u0438'
                        : this.t('RICE_WIDGET_TYPES_LABEL');
                    const titleLabel = new Gtk.Label({
                        label: `${this.menuHotkeyItems.length > 1
                            ? (this.t('RICE_WIDGET_FOUND_LABEL_MULTI') === 'RICE_WIDGET_FOUND_LABEL_MULTI'
                                ? '\u041D\u0430\u0439\u0434\u0435\u043D\u044B \u0432\u0438\u0434\u0436\u0435\u0442\u044B \u0440\u0430\u0439\u0441\u0430'
                                : this.t('RICE_WIDGET_FOUND_LABEL_MULTI'))
                            : (this.t('RICE_WIDGET_FOUND_LABEL') === 'RICE_WIDGET_FOUND_LABEL'
                                ? '\u041D\u0430\u0439\u0434\u0435\u043D \u0432\u0438\u0434\u0436\u0435\u0442 \u0440\u0430\u0439\u0441\u0430'
                                : this.t('RICE_WIDGET_FOUND_LABEL'))}${typesLabel ? ` (${typesLabel})` : ''}${this.menuHotkeyItems.length > 1 ? ` (${this.menuHotkeyItems.length})` : ''}`,
                        halign: Gtk.Align.START
                    });
                    titleLabel.get_style_context().add_class('menu-hotkey-title');
                    headerRow.pack_start(titleLabel, false, false, 0);

                    container.pack_start(headerRow, false, false, 0);

                    this.menuHotkeyItems.forEach((item, idx) => {
                        const row = this.buildMenuHotkeyRow(item);
                        row && (
                            row.set_margin_start(8),
                            row.get_style_context().add_class('menu-hotkey-row'),
                            idx === 0 && row.get_style_context().add_class('menu-hotkey-row-first'),
                            container.pack_start(row, false, false, 0)
                        );
                    });

                    this.menuNoticeRow = container;
                    this.menuNoticeBox.pack_start(container, false, false, 0);
                    this.menuNoticeBox.show();
                    this.menuNoticeBox.show_all();
                })()
                : this.menuNoticeBox.hide()
        );
    };
}
