import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk';
import { HotkeyAction, HotkeySource } from '../../../../domain/valueObjects/HotkeyOverride.js';
import { determineHotkeyDisplayState } from './HyprlandOverridePopupHotkeysFormat.js';

const SEARCH_KEY_COLORS = ['#3584e4', '#33d17a', '#f6d32d', '#ff7800', '#e01b24'];
const SEARCH_MODE_CONFIG = {
    key: {
        icon: 'input-keyboard-symbolic',
        modeTooltipKey: 'SEARCH_MODE_KEY_TOOLTIP',
        modeTooltipDefault: 'Key mode: captures modifiers. Click for text mode.',
        placeholderKey: 'SEARCH_HOTKEY_PLACEHOLDER_KEY',
        placeholderDefault: 'Press keys (Backspace×2 = undo)',
        inputTooltipKey: 'SEARCH_HOTKEY_TOOLTIP_KEY',
        inputTooltipDefault: 'Press modifier keys to add. Double Backspace removes last.',
        showKeys: true
    },
    text: {
        icon: 'font-x-generic-symbolic',
        modeTooltipKey: 'SEARCH_MODE_TEXT_TOOLTIP',
        modeTooltipDefault: 'Text mode: search keys & commands. Click for key mode.',
        placeholderKey: 'SEARCH_HOTKEY_PLACEHOLDER_TEXT',
        placeholderDefault: 'super + shift + S or alacritty...',
        inputTooltipKey: 'SEARCH_HOTKEY_TOOLTIP_TEXT',
        inputTooltipDefault: 'Type keys separated by + or space, or search commands.',
        showKeys: false
    }
};

function standardizeSearchKeyName(keyname) {
    const source = keyname || '';
    switch (source) {
        case '':
            return null;
        case 'Super_L':
        case 'Super_R':
            return 'SUPER';
        case 'Shift_L':
        case 'Shift_R':
            return 'SHIFT';
        case 'Control_L':
        case 'Control_R':
            return 'CTRL';
        case 'Alt_L':
        case 'Alt_R':
            return 'ALT';
        case 'Return':
            return 'RETURN';
        case 'space':
            return 'SPACE';
        case 'Tab':
            return 'TAB';
        case 'Escape':
            return 'ESCAPE';
        case 'Delete':
            return 'DELETE';
        case 'BackSpace':
            return 'BACKSPACE';
        default:
            break;
    }
    const isSingleCharOrFnKey = source.length === 1 || /^F\d+$/.test(source);
    return isSingleCharOrFnKey ? source.toUpperCase() : null;
}

function toActionText(dispatcher, args) {
    return `${dispatcher || ''} ${args || ''}`.trim().toLowerCase();
}

function splitSearchText(text, regex, mapValue = (value) => value) {
    return text
        .split(regex)
        .filter((part) => part.length > 0)
        .map((part) => mapValue(part));
}

function isProtectedHotkeyRow(child, menuNoticeRow, duplicatesWarningFrame) {
    return child === menuNoticeRow || child === duplicatesWarningFrame;
}

function getHotkeySearchFlags(context) {
    const hasKeyFilter = context.searchModeKey && context.hotkeySearchFilter.length > 0;
    const hasTextFilter = !context.searchModeKey && context.hotkeyTextSearch;
    return {
        hasKeyFilter,
        hasTextFilter,
        hasSearch: hasKeyFilter || hasTextFilter
    };
}

function applyMenuNoticeVisibility(context, hasSearch) {
    const noticeRow = context.menuNoticeRow;
    const noticeParent = noticeRow?.get_parent?.();
    noticeRow && (hasSearch
        ? (
            noticeParent?.remove?.(noticeRow),
            noticeRow.set_visible(false)
        )
        : (
            noticeParent && noticeParent !== context.hotkeyListBox && noticeParent.remove?.(noticeRow),
            context.hotkeyListBox.pack_start(noticeRow, false, false, 0),
            noticeRow.set_visible(true)
        ));
}

function appendCenteredDimLabel(listBox, labelText) {
    const label = new Gtk.Label({
        label: labelText,
        halign: Gtk.Align.CENTER,
        margin_top: 20
    });
    label.get_style_context().add_class('dim-label');
    listBox.pack_start(label, false, false, 0);
}

export function applyHyprlandOverridePopupHotkeysSearch(targetPrototype) {
    targetPrototype.toggleSearchMode = function() {
        this.searchModeKey = !this.searchModeKey;
        this.resetHotkeySearchState(true);
        this.updateSearchKeysDisplay();
        this.updateSearchModeUI();
        this.updateClearSearchButton();
        this.filterHotkeys();
    };

    targetPrototype.updateSearchModeUI = function() {
        const modeConfig = this.searchModeKey ? SEARCH_MODE_CONFIG.key : SEARCH_MODE_CONFIG.text;
        this.searchModeBtn.set_image(Gtk.Image.new_from_icon_name(modeConfig.icon, Gtk.IconSize.BUTTON));
        this.searchModeBtn.set_tooltip_text(
            this.t(modeConfig.modeTooltipKey) || modeConfig.modeTooltipDefault
        );
        this.hotkeySearchEntry.set_placeholder_text(
            this.t(modeConfig.placeholderKey) || modeConfig.placeholderDefault
        );
        this.hotkeySearchEntry.set_tooltip_text(
            this.t(modeConfig.inputTooltipKey) || modeConfig.inputTooltipDefault
        );
        this.searchKeysBox[modeConfig.showKeys ? 'show' : 'hide']();
    };

    targetPrototype.resetHotkeySearchState = function(clearEntry = true) {
        clearEntry && this.hotkeySearchEntry?.set_text('');
        this.hotkeySearchFilter = [];
        this.hotkeyTextSearch = '';
        this.hotkeyTextSearchTerms = [];
    };

    targetPrototype.onSearchKeyPress = function(widget, event) {
        return !this.searchModeKey
            ? Gdk.EVENT_PROPAGATE
            : (() => {
                const keyname = Gdk.keyval_name(event.get_keyval()[1]);
                const now = Date.now();

                if (keyname === 'BackSpace') {
                    const elapsed = now - (this._lastBackspaceTime || 0);
                    this._lastBackspaceTime = now;
                    const removedRecent = elapsed < 500 && this.hotkeySearchFilter.length > 0;
                    return removedRecent
                        ? (
                            this.hotkeySearchFilter.pop(),
                            this.updateSearchKeysDisplay(),
                            this.updateClearSearchButton(),
                            this.filterHotkeys(),
                            this._lastBackspaceTime = 0,
                            true
                        )
                        : (this.pushSearchFilterKey('BACKSPACE'), true);
                }

                this._lastBackspaceTime = 0;
                const normalized = standardizeSearchKeyName(keyname);
                return normalized
                    ? (this.pushSearchFilterKey(normalized), Gdk.EVENT_STOP)
                    : Gdk.EVENT_PROPAGATE;
            })();
    };

    targetPrototype.pushSearchFilterKey = function(value) {
        const canPush = value && !this.hotkeySearchFilter.includes(value);
        canPush && (
            this.hotkeySearchFilter.push(value),
            this.updateSearchKeysDisplay(),
            this.updateClearSearchButton(),
            this.filterHotkeys()
        );
        return !!canPush;
    };

    targetPrototype.onHotkeySearchChanged = function() {
        const text = this.hotkeySearchEntry.get_text().trim();
        this.searchModeKey
            ? (
                this.hotkeySearchFilter = splitSearchText(text, /[,\s]+/, (part) => part.toUpperCase()),
                this.updateSearchKeysDisplay()
            )
            : (
                this.hotkeyTextSearchTerms = splitSearchText(text, /[\s+]+/, (part) => part.toLowerCase()),
                this.hotkeyTextSearch = text.toLowerCase()
            );
        this.updateClearSearchButton();
        this.filterHotkeys();
    };

    targetPrototype.updateSearchKeysDisplay = function() {
        this.searchKeysBox.get_children().forEach(c => c.destroy());

        this.hotkeySearchFilter.forEach((key, idx) => {
            idx > 0 && (() => {
                const plusLabel = new Gtk.Label({ label: '+' });
                plusLabel.get_style_context().add_class('dim-label');
                this.searchKeysBox.pack_start(plusLabel, false, false, 0);
            })();

            const keyLabel = new Gtk.Label({ label: key });
            keyLabel.get_style_context().add_class('search-key');
            const background = new Gdk.RGBA();
            background.parse(SEARCH_KEY_COLORS[idx % SEARCH_KEY_COLORS.length])
                && keyLabel.override_background_color(Gtk.StateFlags.NORMAL, background);
            const foreground = new Gdk.RGBA();
            foreground.parse('#ffffff') && keyLabel.override_color(Gtk.StateFlags.NORMAL, foreground);

            this.searchKeysBox.pack_start(keyLabel, false, false, 0);
        });

        this.searchKeysBox.show_all();
        this.updateClearSearchButton();
    };

    targetPrototype.updateClearSearchButton = function() {
        this.clearSearchBtn?.set_visible(
            (this.hotkeySearchEntry?.get_text?.() || '').trim().length > 0
            || (this.searchModeKey && (this.hotkeySearchFilter?.length || 0) > 0)
        );
    };

    targetPrototype.getGroupPriority = function(group) {
        let hasGlobalSource = false;
        let hasPerRiceSource = false;

        for (const item of group.hotkeys) {
            const displayState = determineHotkeyDisplayState(this, {
                hotkey: item.hotkey,
                override: item.override,
                source: item.source
            });
            hasGlobalSource ||= (displayState.isUseGlobal && displayState.hasGlobalOverride)
                || item.source === HotkeySource.GLOBAL;
            hasPerRiceSource ||= (displayState.perRiceOverride && displayState.perRiceOverride.action !== HotkeyAction.USE_GLOBAL)
                || item.source === HotkeySource.PER_RICE;
        }

        for (const item of group.addedHotkeys) {
            hasGlobalSource ||= item.source === 'global';
            hasPerRiceSource ||= item.source === 'per-rice';
        }

        return hasGlobalSource ? 0 : (hasPerRiceSource ? 1 : 2);
    };

    targetPrototype.sortGroupsBySource = function(groupEntries) {
        return groupEntries.sort((a, b) => {
            const priorityA = this.getGroupPriority(a[1]);
            const priorityB = this.getGroupPriority(b[1]);
            return priorityA !== priorityB ? priorityA - priorityB : a[0].localeCompare(b[0]);
        });
    };

    targetPrototype.filterHotkeys = function() {
        return (this.hotkeyListBox && this.allHotkeyGroups)
            ? (() => {
                const clearRenderedRows = () => {
                    this.hotkeyListBox.get_children().forEach((child) => {
                        !isProtectedHotkeyRow(child, this.menuNoticeRow, this._duplicatesWarningFrame)
                            && (
                                child === this._multiActionWarningFrame && (this._multiActionWarningFrame = null),
                                child.destroy()
                            );
                    });
                };
                clearRenderedRows();

                return this.allHotkeyGroups.size === 0
                    ? (
                        appendCenteredDimLabel(
                            this.hotkeyListBox,
                            this.t('NO_HOTKEYS_IN_THEME') || 'No keybindings found in this theme.'
                        ),
                        this.hotkeyListBox.show_all()
                    )
                    : (() => {
                        const { hasKeyFilter, hasTextFilter, hasSearch } = getHotkeySearchFlags(this);
                        applyMenuNoticeVisibility(this, hasSearch);
                        this.addHotkeyRow?.set_visible(!hasSearch);

                        const actionMatches = (actionText, searchText, searchTerms) => {
                            const action = String(actionText || '').toLowerCase();
                            return action.includes(searchText)
                                || (searchTerms.length > 0 && searchTerms.some((term) => action.includes(term)));
                        };
                        const matchesTextFilter = (group, searchText, searchTerms) => {
                            const normalizedKeys = [...group.modifiers, group.key].map((value) => String(value || '').toLowerCase()),
                                matchesKeys = searchTerms.length > 0
                                    && searchTerms.every((term) => normalizedKeys.some((key) => key.includes(term)));
                            return matchesKeys
                                || group.hotkeys.some((item) => actionMatches(toActionText(item.hotkey?.dispatcher, item.hotkey?.args), searchText, searchTerms))
                                || (group.addedHotkeys || []).some((item) => actionMatches(toActionText(item.override?.dispatcher, item.override?.args), searchText, searchTerms));
                        };
                        const matchesGroup = (group) => hasKeyFilter
                            ? this.hotkeySearchFilter.every((searchKey) =>
                                [...group.modifiers, group.key.toUpperCase()].some((gk) => gk.toUpperCase().includes(searchKey))
                            )
                            : (hasTextFilter ? matchesTextFilter(group, this.hotkeyTextSearch, this.hotkeyTextSearchTerms ?? []) : true);

                        let matchCount = 0;
                        for (const [, group] of this.sortGroupsBySource(Array.from(this.allHotkeyGroups.entries()))) {
                            matchesGroup(group) && (
                                matchCount += 1,
                                this.hotkeyListBox.pack_start(this.buildHotkeyGroupRow(group), false, false, 0)
                            );
                        }

                        matchCount === 0 && hasSearch && appendCenteredDimLabel(
                            this.hotkeyListBox,
                            this.t('NO_HOTKEYS_MATCH') || 'No hotkeys match the search.'
                        );
                        this.hotkeyListBox.show_all();
                    })();
            })()
            : undefined;
    };
}
