import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

const MODE_OPTIONS = [
    {id: 'hybrid', label: '\uD83D\uDCE6 Hybrid', tKey: 'DEPENDENCY_ISOLATION_MODE_HYBRID_LABEL'},
    {id: 'per-rice', label: '\uD83C\uDF5A Per-Rice', tKey: 'DEPENDENCY_ISOLATION_MODE_PER_RICE_LABEL'},
    {id: 'per-program', label: '\uD83D\uDD27 Per-Program', tKey: 'DEPENDENCY_ISOLATION_MODE_PER_PROGRAM_LABEL'},
    {id: 'disabled', label: '\u274C Disabled', tKey: 'DEPENDENCY_ISOLATION_MODE_DISABLED_LABEL'}
];

class ThemeAppsSectionList {
    withListBox(action) {
        return this.listBox ? action(this.listBox) : null;
    }

    populate(options = {}) {
        const {force = false} = options;
        const canPopulate = !this.populating && (force || !this.loaded);
        canPopulate && (
            this.populating = true,
            this.setLoading(true),
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.UI_BATCH_SMALL_MS, () => {
                const themes = this.loadThemesSync();
                const uniqueThemes = this.collectUniqueThemes(themes);
                const finalizePopulation = () => {
                    this.loaded = true;
                    this.setLoading(false);
                    this.populating = false;
                };

                this.clearListBox();

                uniqueThemes.length === 0
                    ? (this.showEmptyState(), finalizePopulation())
                    : this.populateListBoxAsync(uniqueThemes, finalizePopulation);

                return GLib.SOURCE_REMOVE;
            })
        );
    }

    setLoading(loading) {
        this.stack && this.loadingLabel && (() => {
            const showLoading = Boolean(loading);
            showLoading && this.loadingLabel.set_text(this.t('LOADING'));
            this.loadingSpinner?.[showLoading ? 'start' : 'stop']?.();
            this.stack.set_visible_child_name(showLoading ? 'loading' : 'content');
        })();
    }

    showEmptyState() {
        this.withListBox((listBox) => {
            const row = new Gtk.ListBoxRow();
            const label = new Gtk.Label({
                label: this.t('THEME_APPS_EMPTY'),
                wrap: true,
                xalign: 0,
                margin_top: 8,
                margin_bottom: 8,
                margin_start: 8,
                margin_end: 8
            });
            label.get_style_context().add_class('dim-label');
            row.add(label);
            row.set_selectable(false);
            listBox.add(row);
            listBox.show_all();
        });
    }

    clearListBox() {
        this.withListBox((listBox) => {
            (listBox.get_children() ?? []).forEach(child => listBox.remove(child));
            this.checkboxes = {};
            this.isolationCombos = {};
        });
    }

    populateListBox(themes) {
        this.withListBox((listBox) => {
            const skipList = this.settings.skip_install_theme_apps ?? [];
            const perRiceIsolation = this.settings.per_rice_isolation_mode ?? {};

            const modeOptions = MODE_OPTIONS.map((opt) => ({
                ...opt,
                label: this.t(opt.tKey) || opt.label
            }));

            themes.forEach(theme => {
                this.addThemeRow(theme, skipList, perRiceIsolation, modeOptions);
            });

            listBox.show_all();
            this.widgets.themeCheckButtons = this.checkboxes;
            this.widgets.themeIsolationCombos = this.isolationCombos;
        });
    }

    populateListBoxAsync(themes, onComplete) {
        return this.listBox
            ? (() => {
                const skipList = this.settings.skip_install_theme_apps ?? [];
                const perRiceIsolation = this.settings.per_rice_isolation_mode ?? {};

                const modeOptions = MODE_OPTIONS.map((opt) => ({
                    ...opt,
                    label: this.t(opt.tKey) || opt.label
                }));

                const CHUNK_SIZE = 5;
                let index = 0;

                const processNextChunk = () => {
                    const completed = index >= themes.length;
                    return completed
                        ? (
                            this.listBox.show_all(),
                            this.widgets.themeCheckButtons = this.checkboxes,
                            this.widgets.themeIsolationCombos = this.isolationCombos,
                            onComplete?.(),
                            GLib.SOURCE_REMOVE
                        )
                        : (() => {
                            const endIndex = Math.min(index + CHUNK_SIZE, themes.length);
                            for (let i = index; i < endIndex; i++) {
                                this.addThemeRow(themes[i], skipList, perRiceIsolation, modeOptions);
                            }
                            index = endIndex;

                            this.listBox.show_all();

                            return GLib.SOURCE_CONTINUE;
                        })();
                };

                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, processNextChunk);
                return undefined;
            })()
            : onComplete?.();
    }

    addThemeRow(theme, skipList, perRiceIsolation, modeOptions) {
        const themeName = theme.name;
        return this.checkboxes[themeName]
            ? undefined
            : (() => {
                const row = new Gtk.ListBoxRow();
                row.set_selectable(false);

                const hbox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8
                });

                const previewImage = this.createPreviewImage(theme);
                hbox.pack_start(previewImage, false, false, 0);

                const check = new Gtk.CheckButton({
                    label: themeName,
                    active: !skipList.includes(themeName)
                });

                const combo = new Gtk.ComboBoxText({
                    margin_end: 8
                });
                modeOptions.forEach(opt => combo.append(opt.id, opt.label));

                const currentMode = perRiceIsolation[themeName] || 'hybrid';
                combo.set_active_id(currentMode);

                combo.set_visible(check.get_active());
                combo.set_no_show_all(true);

                check.connect('toggled', () => {
                    this.onAppToggled(themeName, check.get_active());
                    combo.set_visible(check.get_active());
                });

                combo.connect('changed', () => {
                    !this.updatingFromGlobal && this.onIsolationModeChanged(themeName, combo.get_active_id());
                });

                hbox.pack_start(check, false, false, 0);
                hbox.pack_end(combo, false, false, 0);

                row.add(hbox);
                this.listBox.add(row);
                this.checkboxes[themeName] = check;
                this.isolationCombos[themeName] = combo;
            })();
    }
}

export function applyThemeAppsSectionList(prototype) {
    copyPrototypeDescriptors(prototype, ThemeAppsSectionList.prototype);
}
