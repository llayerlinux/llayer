import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { addPointerCursor, applyOptionalSetters } from './ViewUtils.js';
import {
    HOTKEY_CAPTURE_MODIFIER_MAP,
    extractHotkeyFromInput,
    standardizeCapturedHotkeyName,
    updateCapturedKeysDisplay
} from './HotkeyCaptureShared.js';

function determineText(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function createDimLabel(label) {
    const widget = new Gtk.Label({
        label,
        halign: Gtk.Align.START,
        xalign: 0
    });
    widget.get_style_context().add_class('dim-label');
    return widget;
}

function showHotkeyAddDialog({
    parentDialog = null,
    title = '',
    t = null,
    dispatchers = [],
    defaults = {},
    labels = {},
    modeTooltips = {},
    pointerCursorFn = null,
    onSubmit = null,
    onAfterSave = null
} = {}) {
    const translate = (key, fallback) => {
        const translated = typeof t === 'function' ? t(key) : null;
        return determineText(translated, fallback);
    };
    const usePointerCursor = pointerCursorFn || addPointerCursor;

    const dialog = new Gtk.Dialog({
        title,
        modal: true,
        resizable: false,
        decorated: false
    });
    dialog.set_transient_for?.(parentDialog);
    dialog.set_default_size(420, -1);
    dialog.get_style_context().add_class('hotkey-add-dialog');

    const content = dialog.get_content_area();
    content.set_margin_top(16);
    content.set_margin_bottom(16);
    content.set_margin_start(20);
    content.set_margin_end(20);
    content.set_spacing(14);

    content.pack_start(createDimLabel(determineText(labels.keyBinding, 'Key Binding')), false, false, 0);

    const bindingRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
    let keyMode = false;
    let lastBackspaceTime = 0;
    const capturedKeys = [];

    Array.isArray(defaults.modifiers)
        && defaults.modifiers.forEach((modifier) => capturedKeys.push(String(modifier).toUpperCase()));
    applyOptionalSetters([[defaults.key, (value) => capturedKeys.push(String(value)), Boolean]]);

    const modeBtn = new Gtk.Button();
    modeBtn.set_image(Gtk.Image.new_from_icon_name('font-x-generic-symbolic', Gtk.IconSize.BUTTON));
    modeBtn.get_style_context().add_class('flat');
    modeBtn.set_tooltip_text(determineText(modeTooltips.text, 'Text mode. Click for key capture mode.'));
    usePointerCursor(modeBtn);
    bindingRow.pack_start(modeBtn, false, false, 0);

    const keyEntry = new Gtk.Entry({
        placeholder_text: determineText(labels.keyEntryPlaceholder, 'e.g., SUPER + T, CTRL + SHIFT + Q'),
        hexpand: true
    });
    applyOptionalSetters([[capturedKeys.length, () => keyEntry.set_text(capturedKeys.join(' + ')), (count) => count > 0]]);
    bindingRow.pack_start(keyEntry, true, true, 0);

    const keysFrame = new Gtk.Frame();
    keysFrame.set_no_show_all(true);
    keysFrame.get_style_context().add_class('capture-frame');

    const keysDisplayBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6, hexpand: true});
    const captureHint = new Gtk.Label({
        label: determineText(labels.captureHint, 'Press keys...'),
        hexpand: true,
        halign: Gtk.Align.START
    });
    captureHint.get_style_context().add_class('dim-label');
    keysDisplayBox.pack_start(captureHint, true, true, 0);
    keysFrame.add(keysDisplayBox);
    bindingRow.pack_start(keysFrame, true, true, 0);

    const clearKeysBtn = new Gtk.Button({label: '\u00D7'});
    clearKeysBtn.get_style_context().add_class('flat');
    clearKeysBtn.set_tooltip_text(determineText(labels.clearTooltip, 'Clear captured keys'));
    clearKeysBtn.set_no_show_all(true);
    clearKeysBtn.set_visible(false);
    usePointerCursor(clearKeysBtn);
    clearKeysBtn.connect('clicked', () => {
        capturedKeys.length = 0;
        updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint);
        clearKeysBtn.set_visible(false);
    });
    bindingRow.pack_start(clearKeysBtn, false, false, 0);

    content.pack_start(bindingRow, false, false, 0);

    let argsEntry = null;

    modeBtn.connect('clicked', () => {
        keyMode = !keyMode;
        keyMode
            ? (
                modeBtn.set_image(Gtk.Image.new_from_icon_name('input-keyboard-symbolic', Gtk.IconSize.BUTTON)),
                modeBtn.set_tooltip_text(determineText(modeTooltips.key, 'Key capture mode. Click for text mode.')),
                keyEntry.hide(),
                keysFrame.show(),
                keysFrame.show_all(),
                clearKeysBtn.set_visible(capturedKeys.length > 0),
                modeBtn.grab_focus(),
                capturedKeys.length > 0 && updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint)
            )
            : (
                modeBtn.set_image(Gtk.Image.new_from_icon_name('font-x-generic-symbolic', Gtk.IconSize.BUTTON)),
                modeBtn.set_tooltip_text(determineText(modeTooltips.text, 'Text mode. Click for key capture mode.')),
                keysFrame.hide(),
                keyEntry.show(),
                clearKeysBtn.set_visible(false),
                applyOptionalSetters([[capturedKeys.length, () => keyEntry.set_text(capturedKeys.join(' + ')), (count) => count > 0]])
            );
    });

    dialog.connect('key-press-event', (_widget, event) => {
        if (!keyMode) {
            return false;
        }

        const focused = dialog.get_focus();
        if (
            focused === keyEntry
            || focused === argsEntry
            || focused instanceof Gtk.Entry
            || focused instanceof Gtk.ComboBoxText
        ) {
            return false;
        }

        const keyval = event.get_keyval()[1];
        const keyname = Gdk.keyval_name(keyval);
        switch (keyname) {
            case 'Escape':
                dialog.destroy();
                return true;
            case 'BackSpace': {
                const now = Date.now();
                const elapsed = now - lastBackspaceTime;
                lastBackspaceTime = now;
                elapsed < 500 && capturedKeys.length > 0 && (
                    capturedKeys.pop(),
                    updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint),
                    clearKeysBtn.set_visible(capturedKeys.length > 0),
                    lastBackspaceTime = 0
                );
                return true;
            }
            default:
                break;
        }
        lastBackspaceTime = 0;

        const normalizedKey = standardizeCapturedHotkeyName(keyname);
        normalizedKey && !capturedKeys.includes(normalizedKey) && (
            capturedKeys.push(normalizedKey),
            updateCapturedKeysDisplay(keysDisplayBox, capturedKeys, captureHint),
            clearKeysBtn.set_visible(true)
        );
        return true;
    });

    content.pack_start(new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL}), false, false, 0);

    content.pack_start(createDimLabel(determineText(labels.actionSection, 'Action')), false, false, 0);

    const dispatcherBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
    const dispatcherLabel = new Gtk.Label({
        label: determineText(labels.dispatcher, translate('DISPATCHER', 'Dispatcher:')),
        halign: Gtk.Align.START,
        width_chars: 12
    });
    dispatcherBox.pack_start(dispatcherLabel, false, false, 0);

    const dispatcherCombo = new Gtk.ComboBoxText();
    const availableDispatchers = Array.isArray(dispatchers) && dispatchers.length > 0 ? dispatchers : ['exec'];
    availableDispatchers.forEach((dispatcher) => dispatcherCombo.append_text(dispatcher));
    const preferredDispatcher = determineText(defaults.dispatcher, 'exec');
    const defaultDispatcherIndex = availableDispatchers.findIndex((dispatcher) => dispatcher === preferredDispatcher);
    dispatcherCombo.set_active(defaultDispatcherIndex >= 0 ? defaultDispatcherIndex : 0);
    dispatcherBox.pack_start(dispatcherCombo, true, true, 0);
    content.pack_start(dispatcherBox, false, false, 0);

    const argsBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
    const argsLabel = new Gtk.Label({
        label: determineText(labels.arguments, translate('ARGUMENTS', 'Arguments:')),
        halign: Gtk.Align.START,
        width_chars: 12
    });
    argsBox.pack_start(argsLabel, false, false, 0);

    argsEntry = new Gtk.Entry({
        placeholder_text: determineText(labels.argsPlaceholder, 'e.g., alacritty, 1, l')
    });
    applyOptionalSetters([[defaults.args, (value) => argsEntry.set_text(String(value)), Boolean]]);
    argsBox.pack_start(argsEntry, true, true, 0);
    content.pack_start(argsBox, false, false, 0);

    const actionsBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
        halign: Gtk.Align.END,
        margin_top: 12
    });

    const cancelBtn = new Gtk.Button({label: determineText(labels.cancel, translate('CANCEL', 'Cancel'))});
    usePointerCursor(cancelBtn);
    cancelBtn.connect('clicked', () => dialog.destroy());
    actionsBox.pack_start(cancelBtn, false, false, 0);

    const addBtn = new Gtk.Button({label: determineText(labels.add, translate('ADD', 'Add'))});
    addBtn.get_style_context().add_class('suggested-action');
    usePointerCursor(addBtn);
        addBtn.connect('clicked', () => {
            const parsedHotkey = extractHotkeyFromInput({
                keyMode,
                capturedKeys,
                keyText: keyEntry.get_text(),
                modifierMap: HOTKEY_CAPTURE_MODIFIER_MAP
            });
            if (parsedHotkey.error) {
                !keyMode && keyEntry.get_style_context().add_class('error');
                return;
            }

        const payload = {
            id: `add_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            dispatcher: dispatcherCombo.get_active_text(),
            args: argsEntry.get_text().trim(),
            modifiers: parsedHotkey.modifiers,
            key: parsedHotkey.key
        };

        const accepted = typeof onSubmit === 'function' ? onSubmit(payload) !== false : true;
        if (!accepted) {
            return;
        }

        dialog.destroy();
        typeof onAfterSave === 'function' && onAfterSave(payload);
    });
    actionsBox.pack_start(addBtn, false, false, 0);
    content.pack_start(actionsBox, false, false, 0);

    dialog.show_all();
    keysFrame.hide();
}

export { showHotkeyAddDialog };
