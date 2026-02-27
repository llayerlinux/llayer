import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';

let _handCursor = null;
function getHandCursor(display) {
    _handCursor ||= Gdk.Cursor.new_for_display(
        display || Gdk.Display.get_default(),
        Gdk.CursorType.HAND2
    );
    return _handCursor;
}

const _cursorWidgets = new WeakSet();

export function addPointerCursor(widget) {
    if (!widget || _cursorWidgets.has(widget)) return;
    _cursorWidgets.add(widget);

    (typeof widget.add_events === 'function')
        && widget.add_events(Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK);

    widget.connect('enter-notify-event', () => {
        const win = widget.get_window?.(),
            display = widget.get_display?.() || Gdk.Display.get_default();
        win && win.set_cursor(getHandCursor(display));
        return false;
    });

    widget.connect('leave-notify-event', () => {
        widget.get_window?.()?.set_cursor(null);
        return false;
    });
}

let _handHoverCursor = null;
export function enableHandCursorOnHover(widget) {
    widget && (() => {
        widget.add_events(Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK);

        const getWindow = () => widget.get_toplevel?.()?.get_window?.() || widget.get_window?.() || null,
            getCursor = () => {
                _handHoverCursor ||= ((d) => d ? Gdk.Cursor.new_for_display(d, Gdk.CursorType.HAND1) : null)(Gdk.Display.get_default());
                return _handHoverCursor;
            };

        widget.connect('enter-notify-event', () => {
            const win = getWindow(), cursor = getCursor();
            win && cursor && win.set_cursor(cursor);
            return Gdk.EVENT_PROPAGATE;
        });

        widget.connect('leave-notify-event', () => {
            getWindow()?.set_cursor(null);
            return Gdk.EVENT_PROPAGATE;
        });
    })();
}

export function wrapTabLabel(label) {
    const eventBox = new Gtk.EventBox();
    eventBox.add(label);
    addPointerCursor(eventBox);
    eventBox.show_all();
    return eventBox;
}

function isClickableWidget(widget) {
    const typeName = widget?.constructor?.name || '';
    return typeName === 'Button'
           || typeName === 'ToggleButton'
           || typeName === 'CheckButton'
           || typeName === 'RadioButton'
           || typeName === 'Switch'
           || typeName === 'LinkButton'
           || typeName === 'ModelButton'
           || typeName === 'EventBox'
           || typeName === 'ComboBox'
           || typeName === 'ComboBoxText'
           || typeName === 'SpinButton';
}

function traverseWidget(widget, depth = 0) {
    if (!widget || depth > 15) return;
    isClickableWidget(widget) && addPointerCursor(widget);

    let children = typeof widget.get_children === 'function'
        ? tryOrNull('traverseWidget.children', () => widget.get_children())
        : null;
    Array.isArray(children) && children.forEach((child) => traverseWidget(child, depth + 1));

    let child = typeof widget.get_child === 'function'
        ? tryOrNull('traverseWidget.child', () => widget.get_child())
        : null;
    child && traverseWidget(child, depth + 1);
}

export function setupPointerCursors(container) {
    if (!container) {
        return;
    }
    const guardedGet = (getter, context, onValue) => {
        const value = typeof getter === 'function' ? tryOrNull(context, () => getter()) : null;
        value && onValue(value);
    };

    traverseWidget(container);
    guardedGet(() => container.get_action_area?.(), 'setupPointerCursors.actionArea', (actionArea) => {
        const buttons = (typeof actionArea.get_children === 'function') ? actionArea.get_children() : [];
        Array.isArray(buttons) && buttons.forEach((button) => addPointerCursor(button));
    });

    guardedGet(() => container.get_content_area?.(), 'setupPointerCursors.contentArea', (contentArea) => {
        traverseWidget(contentArea);
    });

    guardedGet(() => container.get_header_bar?.(), 'setupPointerCursors.headerBar', (headerBar) => {
        traverseWidget(headerBar);
        const children = (typeof headerBar.get_children === 'function') ? headerBar.get_children() : [];
        Array.isArray(children) && children
            .filter((child) => isClickableWidget(child))
            .forEach((child) => addPointerCursor(child));
    });

    guardedGet(() => container.get_message_area?.(), 'setupPointerCursors.messageArea', (messageArea) => {
        traverseWidget(messageArea);
    });
}

export function autoSetupPointerCursors(widget) {
    widget && widget.connect('map', () => setupPointerCursors(widget));
}
