import Gtk from 'gi://Gtk?version=3.0';
import { applyOptionalSetters } from './ViewUtils.js';

function applyPointerCursor(context, widget) {
    context?.applyPointerCursor?.(widget);
}

export function createHotkeyRowBox() {
    const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
        margin_top: 4,
        margin_bottom: 4,
        margin_start: 4,
        margin_end: 10
    });
    row.get_style_context().add_class('hotkey-row');
    return row;
}

export function createGlobalHotkeyToggleButton(options = {}) {
    const {
        context,
        active = false,
        tooltip = '',
        onToggle = null,
        size = 24,
        cssClass = 'global-btn',
        activeClass = 'has-global'
    } = options;
    const button = new Gtk.ToggleButton({ label: 'G' });
    button.set_tooltip_text(tooltip);
    button.set_active(active);
    button.set_size_request(size, size);
    applyOptionalSetters([
        [cssClass, (value) => button.get_style_context().add_class(value), Boolean],
        [activeClass, (value) => button.get_style_context().add_class(value), (value) => Boolean(active) && Boolean(value)]
    ]);
    button.connect('toggled', () => {
        onToggle?.(button.get_active());
    });
    applyPointerCursor(context, button);
    return button;
}

export function createHotkeyDigButton(options = {}) {
    const {
        context,
        tooltip = '',
        onClick = null,
        label = 'DIG',
        cssClass = 'hotkey-dig-btn'
    } = options;
    const button = new Gtk.Button({ label });
    applyOptionalSetters([[cssClass, (value) => button.get_style_context().add_class(value), Boolean]]);
    button.set_tooltip_text(tooltip);
    button.connect('clicked', () => onClick?.());
    applyPointerCursor(context, button);
    return button;
}

export function createHotkeyArrowButton(options = {}) {
    const {
        context,
        tooltip = '',
        onClick = null,
        sensitive = true,
        label = '\u2190',
        cssClass = 'hotkey-arrow-btn'
    } = options;
    const button = new Gtk.Button({ label });
    applyOptionalSetters([[cssClass, (value) => button.get_style_context().add_class(value), Boolean]]);
    button.set_tooltip_text(tooltip);
    button.set_sensitive(!!sensitive);
    button.connect('clicked', () => onClick?.());
    applyPointerCursor(context, button);
    return button;
}

export function createHotkeyDeleteButton(options = {}) {
    const {
        context,
        tooltip = '',
        onClick = null,
        label = '\u00D7',
        cssClass = 'hotkey-delete-btn',
        applyRoundStyle = true
    } = options;
    const button = new Gtk.Button({ label });
    applyOptionalSetters([
        [cssClass, (value) => button.get_style_context().add_class(value), Boolean],
        [applyRoundStyle, () => context?.applyRoundButton?.(button), Boolean]
    ]);
    button.set_tooltip_text(tooltip);
    button.connect('clicked', () => onClick?.());
    applyPointerCursor(context, button);
    return button;
}

export function createOriginalActionReadOnlyWidget(text, options = {}) {
    const {
        minWidth = 150,
        maxWidth = 150
    } = options;
    const scroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        vscrollbar_policy: Gtk.PolicyType.NEVER,
        min_content_width: minWidth,
        max_content_width: maxWidth
    });
    const entry = new Gtk.Entry({
        text,
        editable: false,
        sensitive: false,
        has_frame: false
    });
    entry.get_style_context().add_class('original-value-entry');
    entry.get_style_context().add_class('dim-label');
    scroll.add(entry);
    return scroll;
}

export function appendStandardHotkeyRowActions(options = {}) {
    const {
        context,
        row,
        isGlobalActive = false,
        isUseGlobal = false,
        hasOverride = false,
        originalAction = '',
        globalTooltip = '',
        digTooltip = '',
        resetTooltip = '',
        deleteTooltip = '',
        onGlobalToggle = null,
        onDig = null,
        onReset = null,
        onDelete = null,
        deleteCssClass = 'hotkey-delete-btn',
        deleteApplyRoundStyle = true
    } = options;

    const globalBtn = createGlobalHotkeyToggleButton({
        context,
        active: isGlobalActive,
        tooltip: globalTooltip,
        onToggle: onGlobalToggle
    });
    row.pack_start(globalBtn, false, false, 0);

    const digBtn = createHotkeyDigButton({
        context,
        tooltip: digTooltip,
        onClick: onDig
    });
    row.pack_start(digBtn, false, false, 0);

    const arrowBtn = createHotkeyArrowButton({
        context,
        tooltip: resetTooltip,
        sensitive: hasOverride || isUseGlobal,
        onClick: onReset
    });
    row.pack_start(arrowBtn, false, false, 0);

    const originalScroll = createOriginalActionReadOnlyWidget(originalAction, {
        minWidth: 150,
        maxWidth: 150
    });
    row.pack_start(originalScroll, false, false, 0);

    const deleteBtn = createHotkeyDeleteButton({
        context,
        tooltip: deleteTooltip,
        onClick: onDelete,
        cssClass: deleteCssClass,
        applyRoundStyle: deleteApplyRoundStyle
    });
    row.pack_start(deleteBtn, false, false, 0);

    return { globalBtn, digBtn, arrowBtn, originalScroll, deleteBtn };
}
