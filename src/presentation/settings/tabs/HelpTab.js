import Gtk from 'gi://Gtk?version=3.0';

export class HelpTab {
    constructor(deps) {
        this.t = deps.t || ((key) => key);
    }

    createHelpLabel(text) {
        return new Gtk.Label({
            label: text,
            wrap: true,
            xalign: 0,
            use_markup: true
        });
    }

    createScrolledWindow(child) {
        const scrolledWindow = new Gtk.ScrolledWindow();
        scrolledWindow.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
        scrolledWindow.set_hexpand(true);
        scrolledWindow.set_vexpand(true);
        child && scrolledWindow.add(child);
        return scrolledWindow;
    }

    build() {
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24
        });

        let helpLabel = this.createHelpLabel(this.t('HELP_CONTENT')),
            scrolledWindow = this.createScrolledWindow(helpLabel);
        box.pack_start(scrolledWindow, true, true, 0);

        let tabLabel = new Gtk.Label({label: this.t('HELP_TAB')});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return {box, tabLabel};
    }
}
