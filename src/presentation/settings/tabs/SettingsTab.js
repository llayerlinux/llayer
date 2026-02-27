import Gtk from 'gi://Gtk?version=3.0';
import { applyOptionalSetters } from '../../common/ViewUtils.js';

export class SettingsTab {

    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.settings = deps.settings ?? {};
        this.widgets = deps.widgets ?? {};
        this.translations = deps.translations ?? {};
        this.styleSeparator = deps.styleSeparator || ((sep) => sep);
        this.getSystemGtkThemes = deps.getSystemGtkThemes || (() => []);
    }

    checkbox(opts) {
        const label = opts.t ? opts.t(opts.label) : opts.label;
        const check = new Gtk.CheckButton({label});
        applyOptionalSetters([
            [opts.active, (value) => check.set_active(value), (value) => value != null],
            [opts.marginTop, (value) => check.set_margin_top(value), Boolean],
            [opts.onChange, (handler) => check.connect('toggled', () => handler(check.get_active())), (value) => typeof value === 'function']
        ]);
        return check;
    }

    combo(opts) {
        const combo = new Gtk.ComboBoxText();
        (opts.items ?? []).forEach(([id, text]) => combo.append(id, text));
        applyOptionalSetters([
            [opts.activeId, (value) => combo.set_active_id(value), Boolean],
            [opts.sensitive, (value) => combo.set_sensitive(value), (value) => value != null],
            [opts.onChange, (handler) => combo.connect('changed', () => handler(combo.get_active_id())), (value) => typeof value === 'function']
        ]);
        return combo;
    }

    createLabel(text, {halign = Gtk.Align.START, wrap = false, xalign = null, useMarkup = false, className = null} = {}) {
        const label = new Gtk.Label({label: text, halign, wrap, use_markup: useMarkup});
        applyOptionalSetters([
            [xalign, (value) => label.set_xalign(value)],
            [className, (value) => label.get_style_context().add_class(value), Boolean]
        ]);
        return label;
    }

    createDimLabel(text, {halign = Gtk.Align.START, wrap = true, xalign = 0} = {}) {
        return this.createLabel(text, {halign, wrap, xalign, className: 'dim-label'});
    }

    separator(margin = 8) {
        const sep = this.styleSeparator(new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL}));
        sep.set_margin_top(margin);
        sep.set_margin_bottom(margin);
        return sep;
    }

    build() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 20,
            margin_end: 20
        });

        this.buildWcDeSection(box);
        this.addSeparator(box);
        this.buildLanguageSection(box);
        this.buildGtkThemeSection(box);
        this.addSeparator(box);
        this.buildBehaviorSection(box);
        this.addSeparator(box, 12);
        this.buildAnimationSection(box);

        const tabLabel = new Gtk.Label({label: this.t('SETTINGS_TAB')});
        tabLabel.set_margin_left(10);
        tabLabel.set_margin_right(10);

        return {box, tabLabel};
    }

    buildWcDeSection(box) {
        const label = this.createLabel(this.t('SETTINGS_WC_DE_LABEL'));
        label.set_margin_bottom(4);
        box.pack_start(label, false, false, 0);
        box.pack_start(this.combo({items: [['hyprland', this.t('HYPRLAND_WC_OPTION')]], activeId: 'hyprland', sensitive: false}), false, false, 0);

        const note = this.createDimLabel(this.t('WC_DE_NOTE'));
        note.set_margin_top(2);
        note.set_margin_bottom(8);
        box.pack_start(note, false, false, 0);
    }

    buildLanguageSection(box) {
        const label = this.createLabel(this.t('SETTINGS_LANG_LABEL'));
        label.set_margin_bottom(4);
        box.pack_start(label, false, false, 0);

        const combo = this.combo({
            items: ['en', 'es', 'de', 'ru', 'fr']
                .filter((code) => this.translations[code])
                .map((code) => [code, this.translations[code].LANG_NAME]),
            activeId: this.settings.language || 'en'
        });
        this.widgets.langCombo = combo;
        box.pack_start(combo, false, false, 0);
    }

    buildGtkThemeSection(box) {
        const label = this.createLabel(this.t('GTK_THEME_LABEL'));
        label.set_margin_top(8);
        label.set_margin_bottom(4);
        box.pack_start(label, false, false, 0);

        const internalThemes = ['LastLayer', 'LastLayer2', 'LastLayer3'],
            themeItems = [
                ...internalThemes.map((n) => [n, n]),
                ['System', this.t('SYSTEM_THEME_OPTION')],
                ...this.getSystemGtkThemes()
                    .filter((n) => typeof n === 'string' && n.trim().length > 0)
                    .map((n) => n.trim())
                    .filter((n) => !internalThemes.includes(n) && n !== 'System')
                    .map((n) => [n, n])
            ],
            desired = (this.settings.gtkTheme || 'LastLayer').trim();
        const combo = this.combo({items: themeItems, activeId: themeItems.some(([id]) => id === desired) ? desired : 'LastLayer'});
        this.widgets.gtkThemeCombo = combo;
        box.pack_start(combo, false, false, 0);
    }

    buildBehaviorSection(box) {
        const applyCheck = this.checkbox({
            label: this.t('SETTINGS_APPLY_LABEL'),
            active: this.settings.applyNetworkThemesImmediately === true
                || (this.settings.applyNetworkThemesImmediately === undefined && this.settings.applyImmediately === true),
            marginTop: 6
        });
        this.widgets.applyCheck = applyCheck;
        this.widgets.originalApplyImmediately = this.settings.applyImmediately;
        box.pack_start(applyCheck, false, false, 0);

        const closeCheck = this.checkbox({label: this.t('CLOSE_AFTER_APPLY_LABEL'), active: this.settings.closePopupAfterApply || false, marginTop: 4});
        this.widgets.closeAfterApplyCheck = closeCheck;
        box.pack_start(closeCheck, false, false, 0);

        const soundCheck = this.checkbox({label: this.t('SOUND_ENABLED_LABEL'), active: this.settings.soundEnabled !== false, marginTop: 4});
        this.widgets.soundEnabledCheck = soundCheck;
        box.pack_start(soundCheck, false, false, 0);

        const showTimeCheck = this.checkbox({label: this.t('SHOW_APPLY_TIME_LABEL'), active: this.settings.showApplyTime || false, marginTop: 4});
        this.widgets.showApplyTimeCheck = showTimeCheck;
        box.pack_start(showTimeCheck, false, false, 0);

        const statsCheck = this.checkbox({label: this.t('SEND_PERFORMANCE_STATS_LABEL'), active: this.settings.sendPerformanceStats || false, marginTop: 4});
        this.widgets.sendPerformanceStatsCheck = statsCheck;
        box.pack_start(statsCheck, false, false, 0);

        let syncing = false;
        const syncExclusive = (changed = null) => {
            !syncing && (() => {
                syncing = true;

                (closeCheck.get_active() && statsCheck.get_active()) && (
                    changed === 'close' ? statsCheck : closeCheck
                ).set_active(false);

                closeCheck.set_sensitive(!statsCheck.get_active());
                statsCheck.set_sensitive(!closeCheck.get_active());

                syncing = false;
            })();
        };

        closeCheck.connect('toggled', () => {
            syncExclusive('close');
            closeCheck.get_active() && showTimeCheck.set_active(false);
        });
        showTimeCheck.connect('toggled', () => showTimeCheck.get_active() && closeCheck.set_active(false));
        statsCheck.connect('toggled', () => syncExclusive('stats'));

        syncExclusive();
    }

    buildAnimationSection(box) {
        let heading = this.createLabel(this.t('ANIMATION_SWITCH_HEADING'), {useMarkup: true});
        heading.set_margin_top(6);
        box.pack_start(heading, false, false, 0);

        let grid = new Gtk.Grid({column_spacing: 20, row_spacing: 6, margin_top: 6});

        let typeItems = ['grow', 'wave', 'fade'].map((type) => {
            let key = `ANIMATION_TYPE_${type.toUpperCase()}`, translated = this.t(key);
            return [type, translated !== key ? translated : type.charAt(0).toUpperCase() + type.slice(1)];
        });
        this.widgets.animTypeCombo = this.combo({items: typeItems, activeId: this.settings.animationType || 'grow'});
        grid.attach(this.createLabel(this.t('ANIMATION_TYPE_LABEL')), 0, 0, 1, 1);
        grid.attach(this.widgets.animTypeCombo, 0, 1, 1, 1);

        let makeEntry = (value, widgetKey) => {
            let entry = new Gtk.Entry({text: String(value)});
            entry.set_size_request(120, 30);
            this.widgets[widgetKey] = entry;
            return entry;
        };

        grid.attach(this.createLabel(this.t('ANIMATION_FPS_LABEL')), 0, 2, 1, 1);
        grid.attach(makeEntry(this.settings.animationFPS || 240, 'fpsEntry'), 0, 3, 1, 1);
        grid.attach(this.createLabel(this.t('ANIMATION_ANGLE_LABEL')), 1, 0, 1, 1);
        grid.attach(makeEntry(this.settings.animationAngle || 135, 'angleEntry'), 1, 1, 1, 1);
        grid.attach(this.createLabel(this.t('ANIMATION_DURATION_LABEL')), 1, 2, 1, 1);
        grid.attach(makeEntry(this.settings.wallpaperDuration || 1.3, 'durEntry'), 1, 3, 1, 1);

        box.pack_start(grid, false, false, 0);
    }

    addSeparator(box, margin = 8) {
        box.pack_start(this.separator(margin), false, false, 0);
    }
}
