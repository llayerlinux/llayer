import Gtk from 'gi://Gtk?version=3.0';
import { tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';
import { applyOptionalSetters } from '../../../common/ViewUtils.js';
import { determineHotkeyDisplayState } from './HyprlandOverridePopupHotkeysFormat.js';
import {
    createGlobalHotkeyToggleButton,
    createHotkeyDeleteButton
} from '../../../common/HotkeyRowControlsShared.js';

function destroyDialogFrame(ctx, frameKey, scope) {
    const frame = ctx[frameKey];
    frame && (
        ctx[frameKey] = null,
        tryRun(scope, () => frame.destroy())
    );
}

function t(ctx, key, fallback) {
    return ctx.t(key) || fallback;
}

export function applyHotkeyMultiActionSupport(prototype) {
    prototype.showMultiActionWarning = function() {
        if (!this.hotkeyListBox) {
            return;
        }
        destroyDialogFrame(this, '_multiActionWarningFrame', 'showMultiActionWarning.destroy');

        const multiActions = this.findMultiActionHotkeys();
        if (multiActions.length === 0) {
            return;
        }

        const totalKeys = multiActions.length;
        const totalBindings = multiActions.reduce((sum, g) => sum + g.hotkeys.length, 0);

        const frame = new Gtk.Frame({
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 4,
            margin_end: 4
        });
        frame.get_style_context().add_class('multi-action-warning-frame');
        frame.connect('destroy', () => {
            this._multiActionWarningFrame === frame && (this._multiActionWarningFrame = null);
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12
        });

        const warningIcon = new Gtk.Label({ label: '⚡' });
        warningIcon.get_style_context().add_class('warning-icon');
        box.pack_start(warningIcon, false, false, 0);

        const warningText = new Gtk.Label({
            label: t(this, 'MULTI_ACTION_WARNING', 'Found {keys} key(s) with multiple actions ({bindings} bindings)')
                .replace('{keys}', totalKeys)
                .replace('{bindings}', totalBindings),
            halign: Gtk.Align.START
        });
        box.pack_start(warningText, true, true, 0);

        const showAllBtn = new Gtk.Button({
            label: t(this, 'SHOW_ALL', 'Show All')
        });
        showAllBtn.connect('clicked', () => this.showMultiActionDialog());
        this.applyPointerCursor(showAllBtn);
        box.pack_start(showAllBtn, false, false, 0);

        frame.add(box);
        this._multiActionWarningFrame = frame;

        this.hotkeyListBox.pack_start(frame, false, false, 0);
        const targetIndex = this._duplicatesWarningFrame ? 1 : 0;
        this.hotkeyListBox.reorder_child(frame, targetIndex);
        frame.show_all();
    };

    prototype.showMultiActionDialog = function() {
        const multiActions = this.findMultiActionHotkeys();
        if (multiActions.length === 0) {
            return;
        }

        this.applyMultiActionDialogStyles();

        const dialog = new Gtk.Dialog({
            title: '',
            modal: true,
            resizable: true
        });
        this._multiActionDialog = dialog;
        dialog.connect('destroy', () => { this._multiActionDialog = null; });
        dialog.set_transient_for?.(this.popup);
        dialog.set_default_size(520, 480);

        const content = dialog.get_content_area();
        content.set_spacing(0);
        content.get_style_context().add_class('mad-content');

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            margin_start: 20,
            margin_end: 20,
            margin_top: 16,
            margin_bottom: 8
        });

        const titleLabel = new Gtk.Label({
            label: t(this, 'MULTI_ACTION_TITLE', 'Key Conflicts'),
            halign: Gtk.Align.START
        });
        titleLabel.get_style_context().add_class('mad-title');
        headerBox.pack_start(titleLabel, false, false, 0);

        const subtitleLabel = new Gtk.Label({
            label: t(this, 'MULTI_ACTION_DESC', 'Multiple bindings detected'),
            halign: Gtk.Align.START
        });
        subtitleLabel.get_style_context().add_class('mad-subtitle');
        headerBox.pack_start(subtitleLabel, false, false, 0);

        content.pack_start(headerBox, false, false, 0);

        const sectionLabel = new Gtk.Label({
            label: 'Bindings',
            halign: Gtk.Align.START,
            margin_start: 20,
            margin_top: 12,
            margin_bottom: 8
        });
        sectionLabel.get_style_context().add_class('mad-section');
        content.pack_start(sectionLabel, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true
        });
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            margin_start: 20,
            margin_end: 20
        });

        const dotColors = ['dot-purple', 'dot-cyan', 'dot-green', 'dot-pink', 'dot-orange', 'dot-blue'];

        let groupIdx = 0;
        for (const group of multiActions) {
            const dotColor = dotColors[groupIdx % dotColors.length];

            for (const hkEntry of group.hotkeys) {
                const hotkeyData = this.findHotkeyDataById(hkEntry.id);
                hotkeyData && (() => {
                    const rowContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
                    const buildRow = (isDeleted) => this.buildMultiActionRow(
                        hotkeyData,
                        isDeleted,
                        rowContainer,
                        buildRow,
                        group.displayCombo,
                        dotColor
                    );

                    const row = buildRow(hotkeyData.isDeleted);
                    rowContainer.pack_start(row, false, false, 0);
                    listBox.pack_start(rowContainer, false, false, 0);
                })();
            }
            groupIdx++;
        }

        scrolled.add(listBox);
        content.pack_start(scrolled, true, true, 0);

        const totalActions = multiActions.reduce((sum, g) => sum + g.actionCount, 0);
        const infoCard = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 0
        });
        infoCard.get_style_context().add_class('mad-info-card');

        const infoLeft = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            valign: Gtk.Align.CENTER
        });
        const infoTitle = new Gtk.Label({
            label: 'Conflict summary',
            halign: Gtk.Align.START
        });
        infoTitle.get_style_context().add_class('mad-info-title');
        infoLeft.pack_start(infoTitle, false, false, 0);
        infoCard.pack_start(infoLeft, true, true, 0);

        const statsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 20
        });

        const stat1Box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
        const stat1L = new Gtk.Label({ label: 'Keys' });
        stat1L.get_style_context().add_class('mad-info-stat-label');
        const stat1V = new Gtk.Label({ label: `${multiActions.length}` });
        stat1V.get_style_context().add_class('mad-info-stat-value');
        stat1Box.pack_start(stat1L, false, false, 0);
        stat1Box.pack_start(stat1V, false, false, 0);
        statsBox.pack_start(stat1Box, false, false, 0);

        const stat2Box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
        const stat2L = new Gtk.Label({ label: 'Bindings' });
        stat2L.get_style_context().add_class('mad-info-stat-label');
        const stat2V = new Gtk.Label({ label: `${totalActions}` });
        stat2V.get_style_context().add_class('mad-info-stat-value');
        stat2Box.pack_start(stat2L, false, false, 0);
        stat2Box.pack_start(stat2V, false, false, 0);
        statsBox.pack_start(stat2Box, false, false, 0);

        infoCard.pack_end(statsBox, false, false, 0);
        content.pack_start(infoCard, false, false, 0);

        const footerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.END,
            margin_end: 16,
            margin_top: 8,
            margin_bottom: 12
        });

        const closeBtn = new Gtk.Button({ label: t(this, 'CLOSE', 'Close') });
        closeBtn.get_style_context().add_class('mad-close-btn');
        closeBtn.connect('clicked', () => {
            dialog.destroy();
            this.loadHotkeysForTheme();
        });
        this.applyPointerCursor(closeBtn);
        footerBox.pack_end(closeBtn, false, false, 0);

        content.pack_start(footerBox, false, false, 0);

        dialog.show_all();
    };

    prototype.createMultiActionRowBase = function(dotColor) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        row.get_style_context().add_class('mad-row');
        const leftBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            valign: Gtk.Align.CENTER
        });

        const dot = new Gtk.Label({ label: '●' });
        dot.get_style_context().add_class('mad-dot');
        dot.get_style_context().add_class(dotColor || 'dot-purple');
        leftBox.pack_start(dot, false, false, 0);

        const plus = new Gtk.Label({ label: '+' });
        plus.get_style_context().add_class('mad-plus');
        leftBox.pack_start(plus, false, false, 0);

        row.pack_start(leftBox, false, false, 0);
        return row;
    };

    prototype.replaceMultiActionRow = function(rowContainer, row, buildRowFn, isDeleted) {
        row.destroy();
        const newRow = buildRowFn(isDeleted);
        rowContainer.pack_start(newRow, false, false, 0);
        rowContainer.show_all();
    };

    prototype.buildDeletedMultiActionRow = function({ row, rowContainer, buildRowFn, hotkey, keyCombo }) {
        row.get_style_context().add_class('mad-row-deleted');

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 1,
            valign: Gtk.Align.CENTER
        });

        const line1 = new Gtk.Label({
            label: `${keyCombo}:`,
            halign: Gtk.Align.START
        });
        line1.get_style_context().add_class('mad-line1');
        line1.get_style_context().add_class('mad-line1-deleted');
        textBox.pack_start(line1, false, false, 0);

        const line2 = new Gtk.Label({
            label: t(this, 'MARKED_FOR_DELETION', 'Will be removed'),
            halign: Gtk.Align.START
        });
        line2.get_style_context().add_class('mad-line2');
        line2.get_style_context().add_class('mad-line2-deleted');
        textBox.pack_start(line2, false, false, 0);

        row.pack_start(textBox, true, true, 0);

        const undoBtn = new Gtk.Button({ label: 'Undo' });
        undoBtn.get_style_context().add_class('mad-link-btn');
        undoBtn.connect('clicked', () => {
            delete this.currentHotkeyOverrides[hotkey.id];
            this.replaceMultiActionRow(rowContainer, row, buildRowFn, false);
            this.savePerRiceHotkeyOverrides?.();
            this.setApplyPending?.(true);
        });
        this.applyPointerCursor(undoBtn);
        row.pack_end(undoBtn, false, false, 0);
    };

    prototype.buildActiveMultiActionRow = function({ row, rowContainer, buildRowFn, hotkeyData, keyCombo }) {
        const { hotkey, override, source } = hotkeyData;
        const { action: currentAction, hasGlobalOverride, isGlobalActive } = determineHotkeyDisplayState(this, {
            hotkey,
            override,
            source
        });

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 1,
            valign: Gtk.Align.CENTER
        });

        const line1 = new Gtk.Label({
            label: `${keyCombo}:`,
            halign: Gtk.Align.START
        });
        line1.get_style_context().add_class('mad-line1');
        textBox.pack_start(line1, false, false, 0);

        const line2 = new Gtk.Label({
            label: currentAction,
            halign: Gtk.Align.START,
            ellipsize: 3,
            max_width_chars: 45
        });
        line2.get_style_context().add_class('mad-line2');
        isGlobalActive && line2.get_style_context().add_class('mad-line2-global');
        textBox.pack_start(line2, false, false, 0);

        row.pack_start(textBox, true, true, 0);

        (hasGlobalOverride || isGlobalActive) && (() => {
            const globalBtn = createGlobalHotkeyToggleButton({
                context: this,
                active: isGlobalActive,
                tooltip: 'Global override',
                onToggle: (active) => {
                    this.handleGlobalToggle(hotkey.id, active, hotkey);
                    this.refreshHotkeysDeferred();
                },
                size: -1,
                cssClass: 'mad-icon-btn',
                activeClass: 'mad-icon-btn-active'
            });
            applyOptionalSetters([[globalBtn, (button) => button.set_size_request(-1, -1), (button) => typeof button?.get_size_request === 'function']]);
            row.pack_end(globalBtn, false, false, 0);
        })();

        const deleteBtn = createHotkeyDeleteButton({
            context: this,
            tooltip: 'Remove binding',
            onClick: () => {
                this.handleHotkeyDelete(hotkey.id, hotkey);
                this.replaceMultiActionRow(rowContainer, row, buildRowFn, true);
                this.savePerRiceHotkeyOverrides?.();
                this.setApplyPending?.(true);
            },
            label: '×',
            cssClass: 'mad-icon-btn',
            applyRoundStyle: false
        });
        deleteBtn.get_style_context().add_class('mad-icon-btn-del');
        row.pack_end(deleteBtn, false, false, 0);
    };

    prototype.buildMultiActionRow = function(hotkeyData, isDeleted, rowContainer, buildRowFn, keyCombo, dotColor) {
        const row = this.createMultiActionRowBase(dotColor);
        isDeleted
            ? this.buildDeletedMultiActionRow({ row, rowContainer, buildRowFn, hotkey: hotkeyData.hotkey, keyCombo })
            : this.buildActiveMultiActionRow({ row, rowContainer, buildRowFn, hotkeyData, keyCombo });
        return row;
    };

    prototype.applyMultiActionDialogStyles = function() {
        this._multiActionStylesApplied || (this._multiActionStylesApplied = true);
    };
}
