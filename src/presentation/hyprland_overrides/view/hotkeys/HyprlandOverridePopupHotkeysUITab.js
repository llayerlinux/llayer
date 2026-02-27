import Gtk from 'gi://Gtk?version=3.0';

export function applyHyprlandOverridePopupHotkeysUITab(prototype) {
    prototype.buildHotkeysTab = function(box) {
        this.initHotkeyService();

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_bottom: 8
        });

        const desc = new Gtk.Label({
            label: this.t('HOTKEYS_TAB_DESC') || 'Override keybindings for this theme. Global overrides are shown in blue.',
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            hexpand: true
        });
        desc.get_style_context().add_class('dim-label');
        headerBox.pack_start(desc, true, true, 0);

        const helpBtn = new Gtk.Button();
        helpBtn.set_image(Gtk.Image.new_from_icon_name('help-about-symbolic', Gtk.IconSize.BUTTON));
        helpBtn.get_style_context().add_class('flat');
        helpBtn.set_tooltip_text(this.t('HOTKEYS_HELP') || 'Help');
        helpBtn.connect('clicked', () => this.showHotkeysHelpPopup(helpBtn));
        this.applyPointerCursor(helpBtn);
        headerBox.pack_end(helpBtn, false, false, 0);

        box.pack_start(headerBox, false, false, 0);

        const searchBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
            margin_bottom: 8
        });

        this.searchModeKey = false;
        this.searchModeBtn = new Gtk.Button();
        this.searchModeBtn.set_image(Gtk.Image.new_from_icon_name('font-x-generic-symbolic', Gtk.IconSize.BUTTON));
        this.searchModeBtn.get_style_context().add_class('flat');
        this.searchModeBtn.set_tooltip_text(this.t('SEARCH_MODE_TEXT_TOOLTIP') || 'Text mode: search keys & commands. Click for key mode.');
        this.searchModeBtn.connect('clicked', () => this.toggleSearchMode());
        this.applyPointerCursor(this.searchModeBtn);
        searchBox.pack_start(this.searchModeBtn, false, false, 0);

        this.hotkeySearchEntry = new Gtk.Entry({
            placeholder_text: this.t('SEARCH_HOTKEY_PLACEHOLDER_TEXT') || 'super + shift + S or alacritty...',
            hexpand: false
        });
        this.hotkeySearchEntry.set_width_chars(12);
        this.hotkeySearchEntry.set_size_request(340, -1);
        this.hotkeySearchEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find-symbolic');
        this.hotkeySearchEntry.set_tooltip_text(this.t('SEARCH_HOTKEY_TOOLTIP_TEXT') || 'Type keys separated by + or space, or search commands.');
        this.hotkeySearchEntry.connect('changed', () => this.onHotkeySearchChanged());
        this.hotkeySearchEntry.connect('key-press-event', (widget, event) => this.onSearchKeyPress(widget, event));
        searchBox.pack_start(this.hotkeySearchEntry, false, false, 0);

        this.searchKeysBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4
        });
        this.searchKeysBox.hide();
        searchBox.pack_start(this.searchKeysBox, false, false, 0);

        this.updateSearchModeUI?.();

        const clearBtn = new Gtk.Button({ label: '\u00D7' });
        clearBtn.get_style_context().add_class('flat');
        this.applyRoundButton(clearBtn);
        clearBtn.set_tooltip_text(this.t('CLEAR_SEARCH') || 'Clear search');
        clearBtn.connect('clicked', () => {
            const hasText = (this.hotkeySearchEntry?.get_text?.() || '').trim().length > 0;
            const hasFilter = this.searchModeKey && (this.hotkeySearchFilter?.length || 0) > 0;
            (this.hotkeySearchEntry?.get_parent?.() && (hasText || hasFilter)) && (
                this.resetHotkeySearchState(true),
                this.updateSearchKeysDisplay(),
                this.filterHotkeys()
            );
        });
        searchBox.pack_start(clearBtn, false, false, 4);
        this.applyPointerCursor(clearBtn);
        clearBtn.set_no_show_all(true);
        clearBtn.set_visible(false);
        this.clearSearchBtn = clearBtn;

        box.pack_start(searchBox, false, false, 0);

        const addBtnRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_bottom: 3
        });
        const sep = new Gtk.Label({ label: '\u2502' });
        sep.get_style_context().add_class('dim-label');
        addBtnRow.pack_start(sep, false, false, 4);
        const addBtn = new Gtk.Button({ label: '+' });
        addBtn.get_style_context().add_class('hotkey-add-btn');
        addBtn.set_tooltip_text(this.t('ADD_HOTKEY') || 'Add Hotkey');
        addBtn.connect('clicked', () => this.showAddHotkeyDialogPerRice());
        this.applyPointerCursor(addBtn);
        addBtnRow.pack_start(addBtn, false, false, 0);

        searchBox.pack_start(addBtnRow, false, false, 0);
        this.addHotkeyRow = addBtnRow;

        this.menuNoticeBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_bottom: 8
        });
        this.menuNoticeBox.set_no_show_all(true);
        box.pack_start(this.menuNoticeBox, false, false, 0);

        this.buildMainModRow(box);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 250
        });
        scrolled.set_overlay_scrolling?.(false);

        this.hotkeyListBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        this.hotkeyListBox.set_margin_end?.(12);

        scrolled.add(this.hotkeyListBox);
        box.pack_start(scrolled, true, true, 0);

        this.resetHotkeySearchState(false);
        this.allHotkeyGroups = null;
        this.menuHotkeyInfo = null;
        this.menuHotkeyCollection = null;

        this.loadHotkeysForTheme();
    };
}
