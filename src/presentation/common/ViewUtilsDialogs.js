import Gtk from 'gi://Gtk?version=3.0';
import Pango from 'gi://Pango';
import { applyOptionalSetters } from './ViewUtilsText.js';
import { setupPointerCursors } from './ViewUtilsPointers.js';

export function showPropertiesHelpDialog({ translator, parent = null, cssProvider = null }) {
    const t = translator || ((key) => key);
    const dialog = new Gtk.Dialog({
        title: t('PROPERTIES_HELP_TITLE'),
        transient_for: parent,
        modal: true,
        default_width: 600,
        default_height: 550
    });

    cssProvider && dialog.get_style_context().add_provider(
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );

    const contentArea = dialog.get_content_area();
    contentArea.set_margin_start(20);
    contentArea.set_margin_end(20);
    contentArea.set_margin_top(16);
    contentArea.set_margin_bottom(10);
    contentArea.set_spacing(0);

    const scrolled = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        min_content_height: 300
    });

    const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
    scrolled.add(box);

    const properties = [
        {letter: 'M', color: 'yellow-accent', title: t('MULTI_CONFIG'), description: t('MULTI_CONFIG_DESC')},
        {letter: 'D+', color: 'blue-accent', title: t('DESKTOP_PLUS'), description: t('DESKTOP_PLUS_DESC')},
        {letter: 'W', color: 'purple-accent', title: t('WIDGETS_ADDITIONAL'), description: t('WIDGETS_DESC')},
        {letter: 'U', color: 'red-accent', title: t('UNIQUE'), description: t('UNIQUE_DESC')},
        {letter: 'F', color: 'green-accent', title: t('FAMILIAR'), description: t('FAMILIAR_DESC')}
    ];

    properties.forEach((prop) => {
        const propBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
        const letterLabel = new Gtk.Label({label: prop.letter});
        letterLabel.get_style_context().add_class(prop.color);
        letterLabel.set_size_request(30, -1);
        letterLabel.set_halign(Gtk.Align.CENTER);

        const textBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        const titleLabel = new Gtk.Label({label: prop.title, xalign: 0});
        titleLabel.get_style_context().add_class('header-label');
        titleLabel.set_margin_bottom(0);

        const descLabel = new Gtk.Label({
            label: prop.description,
            wrap: true,
            xalign: 0
        });
        descLabel.get_style_context().add_class('field-label');

        textBox.pack_start(titleLabel, false, false, 0);
        textBox.pack_start(descLabel, false, false, 0);

        propBox.pack_start(letterLabel, false, false, 0);
        propBox.pack_start(textBox, true, true, 0);

        box.pack_start(propBox, false, false, 0);
    });

    contentArea.pack_start(scrolled, true, true, 0);
    const closeBtn = dialog.add_button(t('CLOSE'), Gtk.ResponseType.CLOSE);
    closeBtn.get_style_context().add_class('suggested-action');
    dialog.connect('response', () => dialog.destroy());
    dialog.show_all();
    setupPointerCursors(dialog);
    return dialog;
}

export { showPropertiesHelpDialog as showPropertiesHelp };

function createMessageDialog(options = {}) {
    const {
        parent = null,
        modal = true,
        messageType = Gtk.MessageType.INFO,
        buttons = Gtk.ButtonsType.OK,
        title = '',
        secondaryText = '',
        keepAbove = false,
        urgencyHint = false
    } = options;

    const dialog = new Gtk.MessageDialog({
        transient_for: parent,
        modal,
        message_type: messageType,
        buttons,
        text: title,
        secondary_text: secondaryText
    });

    keepAbove && dialog.set_keep_above?.(true);
    urgencyHint && dialog.set_urgency_hint?.(true);
    return dialog;
}

export function showMessageDialog(options = {}) {
    const {
        onResponse = null,
        translateWidgets = null,
        setupPointers = true,
        present = true
    } = options;
    const dialog = createMessageDialog(options);

    dialog.connect('response', (_dialog, response) => {
        onResponse?.(response, dialog);
        dialog.destroy();
    });

    typeof translateWidgets === 'function' && translateWidgets(dialog);
    dialog.show_all();
    present && dialog.present?.();
    setupPointers && setupPointerCursors(dialog);
    return dialog;
}

export function runMessageDialog(options = {}) {
    const {
        translateWidgets = null,
        setupPointers = true,
        present = true
    } = options;
    const dialog = createMessageDialog(options);

    typeof translateWidgets === 'function' && translateWidgets(dialog);
    dialog.show_all();
    present && dialog.present?.();
    setupPointers && setupPointerCursors(dialog);

    const response = dialog.run();
    dialog.destroy();
    return response;
}

export function openFileChooserDialog(options = {}) {
    const {
        title = '',
        action = Gtk.FileChooserAction.OPEN,
        parent = null,
        modal = true,
        currentFolder = null,
        showHidden = false,
        borderWidth = null,
        filters = [],
        buttons = null,
        onResponse = null,
        translateWidgets = null,
        setupPointers = true
    } = options;

    const chooser = new Gtk.FileChooserDialog({
        title,
        action,
        transient_for: parent,
        modal
    });

    chooser.set_show_hidden(!!showHidden);
    applyOptionalSetters([
        [currentFolder, (value) => chooser.set_current_folder(value), Boolean],
        [borderWidth, (value) => chooser.set_border_width(value), Number.isFinite]
    ]);

    for (const filterDef of filters) {
        if (!filterDef) continue;
        if (typeof filterDef.add_pattern === 'function') {
            chooser.add_filter(filterDef);
            continue;
        }
        const filter = new Gtk.FileFilter();
        const patterns = Array.isArray(filterDef.patterns) ? filterDef.patterns : [];
        const mimeTypes = Array.isArray(filterDef.mimeTypes) ? filterDef.mimeTypes : [];
        filterDef.name && filter.set_name(filterDef.name);
        patterns.forEach((pattern) => filter.add_pattern(pattern));
        mimeTypes.forEach((mimeType) => filter.add_mime_type(mimeType));
        chooser.add_filter(filter);
    }

    const chooserButtons = Array.isArray(buttons) && buttons.length > 0
        ? buttons
        : [
            {label: Gtk.STOCK_CANCEL, response: Gtk.ResponseType.CANCEL},
            {label: Gtk.STOCK_OPEN, response: Gtk.ResponseType.ACCEPT}
        ];
    chooserButtons.forEach(({label, response}) => chooser.add_button(label, response));

    chooser.connect('response', (_dialog, response) => {
        const shouldClose = onResponse?.(chooser, response) !== false;
        shouldClose && chooser.destroy();
    });

    typeof translateWidgets === 'function' && translateWidgets(chooser);
    chooser.show_all();
    setupPointers && setupPointerCursors(chooser);
    return chooser;
}
