import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import {addPointerCursor} from '../../../common/ViewUtils.js';

export function applyOverrideTabLegacy(prototype) {

    prototype.getAllMigrationParams = function() {
        const legacyService = this.parameterService?.getLegacyMigrationService?.();
        if (!legacyService) return [];

        const themesDir = `${GLib.get_home_dir()}/.config/themes`;
        const legacyData = legacyService.getAllLegacyParams(themesDir) || { disabled: [], converted: [] };
        const futureData = legacyService.getAllFutureParams(themesDir) || { disabled: [], converted: [] };

        const params = [];

        for (const p of (legacyData.disabled || [])) {
            params.push({
                type: 'legacy',
                subtype: 'disabled',
                path: p.path,
                value: p.value,
                version: p.version,
                themes: p.themes || []
            });
        }

        for (const p of (legacyData.converted || [])) {
            params.push({
                type: 'legacy',
                subtype: 'converted',
                oldPath: p.oldPath,
                newPath: p.newPath,
                newValue: p.newValue,
                version: p.version,
                themes: p.themes || []
            });
        }

        for (const p of (futureData.disabled || [])) {
            params.push({
                type: 'future',
                subtype: 'disabled',
                path: p.path,
                value: p.value,
                minVersion: p.minVersion,
                themes: p.themes || []
            });
        }

        for (const p of (futureData.converted || [])) {
            params.push({
                type: 'future',
                subtype: 'converted',
                newPath: p.newPath,
                oldPath: p.oldPath,
                oldValue: p.oldValue,
                minVersion: p.minVersion,
                themes: p.themes || []
            });
        }

        return params;
    };

    prototype.buildMigrationSection = function(box) {
        const migrationParams = this.getAllMigrationParams();
        if (migrationParams.length === 0) return;

        this._migrationParams = migrationParams;

        const legacyService = this.parameterService?.getLegacyMigrationService?.();
        const userVersion = legacyService?.getCachedHyprlandVersion?.() || 'unknown';
        this._userVersion = userVersion;

        const notificationBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 12
        });
        notificationBox.get_style_context().add_class('migration-notification');

        const notificationText = this.t('MIGRATION_NOTIFICATION_TEXT') === 'MIGRATION_NOTIFICATION_TEXT'
            ? `Detected ${migrationParams.length} unsupported parameters for Hyprland v${userVersion} (auto-converted/disabled)`
            : this.t('MIGRATION_NOTIFICATION_TEXT').replace('{count}', migrationParams.length).replace('{version}', userVersion);

        const label = new Gtk.Label({
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0,
            use_markup: true
        });
        label.set_markup(`<span foreground="#f59e0b">${notificationText}</span>`);
        notificationBox.pack_start(label, false, false, 0);

        const settingsBtn = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            relief: Gtk.ReliefStyle.NONE
        });
        const settingsIcon = new Gtk.Image({
            icon_name: 'preferences-system-symbolic',
            icon_size: Gtk.IconSize.SMALL_TOOLBAR
        });
        settingsBtn.set_image(settingsIcon);
        settingsBtn.get_style_context().add_class('flat');
        settingsBtn.set_tooltip_text(this.t('MIGRATION_SETTINGS_TOOLTIP') === 'MIGRATION_SETTINGS_TOOLTIP'
            ? 'Manage migration settings'
            : this.t('MIGRATION_SETTINGS_TOOLTIP'));

        addPointerCursor(settingsBtn);
        settingsBtn.connect('clicked', () => {
            this.showMigrationPopup(settingsBtn);
        });

        notificationBox.pack_start(settingsBtn, false, false, 0);

        box.pack_start(notificationBox, false, false, 0);
    };

    prototype.showMigrationPopup = function(triggerBtn) {
        if (this._migrationPopup) {
            this._migrationPopup.destroy();
            this._migrationPopup = null;
        }

        const migrationParams = this._migrationParams || [];
        const userVersion = this._userVersion || 'unknown';

        const popup = new Gtk.Dialog({
            modal: true,
            decorated: false,
            resizable: false
        });
        popup.set_size_request(550, -1);
        popup.get_style_context().add_class('migration-popup');

        if (this.parentWindow) {
            popup.set_transient_for(this.parentWindow);
        }

        const actionArea = popup.get_action_area?.();
        if (actionArea) {
            actionArea.hide();
            actionArea.set_no_show_all(true);
        }

        const content = popup.get_content_area();
        content.set_spacing(8);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8
        });

        const titleText = this.t('MIGRATION_POPUP_TITLE') === 'MIGRATION_POPUP_TITLE'
            ? `Migration (${migrationParams.length})`
            : this.t('MIGRATION_POPUP_TITLE').replace('{count}', migrationParams.length);

        const title = new Gtk.Label({
            label: titleText,
            halign: Gtk.Align.START
        });
        title.get_style_context().add_class('title-4');
        header.pack_start(title, false, false, 0);

        const versionLabel = new Gtk.Label({
            label: `Hyprland v${userVersion}`,
            halign: Gtk.Align.START
        });
        versionLabel.get_style_context().add_class('dim-label');
        header.pack_start(versionLabel, false, false, 8);

        const closeBtn = new Gtk.Button({ label: '✕', relief: Gtk.ReliefStyle.NONE });
        closeBtn.get_style_context().add_class('flat');
        closeBtn.get_style_context().add_class('circular');
        addPointerCursor(closeBtn);
        closeBtn.connect('clicked', () => popup.destroy());
        header.pack_end(closeBtn, false, false, 0);

        content.pack_start(header, false, false, 0);

        const desc = new Gtk.Label({
            label: this.t('MIGRATION_POPUP_DESC') === 'MIGRATION_POPUP_DESC'
                ? 'L = Legacy (removed), F = Future (not yet supported). Toggle to enable/disable.'
                : this.t('MIGRATION_POPUP_DESC'),
            halign: Gtk.Align.START,
            wrap: true,
            xalign: 0
        });
        desc.get_style_context().add_class('dim-label');
        content.pack_start(desc, false, false, 0);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 400,
            max_content_height: 1200
        });

        const grid = new Gtk.Grid({
            column_spacing: 6,
            row_spacing: 6,
            column_homogeneous: false
        });

        let rowIndex = 0;
        for (const param of migrationParams) {
            this.buildMigrationGridRow(grid, param, rowIndex);
            rowIndex++;
        }

        scrolled.add(grid);
        content.pack_start(scrolled, true, true, 0);

        popup.show_all();

        popup.connect('key-press-event', (w, event) => {
            const [ok, keyval] = event.get_keyval();
            if (ok && keyval === 65307) {
                popup.destroy();
                return true;
            }
            return false;
        });

        popup.connect('destroy', () => {
            this._migrationPopup = null;
        });

        this._migrationPopup = popup;
    };

    prototype.buildMigrationGridRow = function(grid, param, rowIndex) {
        const isLegacy = param.type === 'legacy';
        const isConverted = param.subtype === 'converted';

        let displayPath, displayValue;
        if (isConverted) {
            displayPath = isLegacy ? param.oldPath : param.newPath;
            if (!isLegacy && param.isReverted) {
                displayValue = param.newValue || '';
            } else {
                displayValue = isLegacy ? (param.newValue || '') : (param.oldValue || '');
            }
        } else {
            displayPath = param.path;
            displayValue = param.value || '';
        }

        const isEnabled = this.isGlobalMigrationEnabled(param);

        const toggle = new Gtk.Switch({
            active: isEnabled,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START
        });
        toggle.set_tooltip_text(isEnabled ? 'Enabled' : 'Disabled');
        grid.attach(toggle, 0, rowIndex, 1, 1);

        const pathLabel = new Gtk.Label({
            label: displayPath,
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
            xalign: 0,
            ellipsize: 3
        });
        pathLabel.set_size_request(220, -1);
        if (!isEnabled) {
            pathLabel.get_style_context().add_class('dim-label');
        }
        grid.attach(pathLabel, 1, rowIndex, 1, 1);

        const badgeText = isLegacy ? `L${param.version}` : `F${param.minVersion}`;
        const badge = new Gtk.Label({
            label: badgeText,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });
        badge.set_size_request(55, -1);
        badge.get_style_context().add_class(isLegacy ? 'migration-badge-legacy' : 'migration-badge-future');
        badge.set_tooltip_text(isLegacy ? `Removed in v${param.version}` : `Requires ≥v${param.minVersion}`);
        grid.attach(badge, 2, rowIndex, 1, 1);

        const valueLabel = new Gtk.Label({
            label: displayValue || '-',
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
            ellipsize: 3
        });
        valueLabel.set_size_request(50, -1);
        valueLabel.get_style_context().add_class('dim-label');
        grid.attach(valueLabel, 3, rowIndex, 1, 1);

        const themesCount = param.themes?.length || 0;
        const themesLabel = new Gtk.Label({
            label: `${themesCount}`,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });
        themesLabel.set_size_request(25, -1);
        themesLabel.get_style_context().add_class('dim-label');
        if (themesCount > 0) {
            themesLabel.set_tooltip_text(param.themes.join(', '));
        }
        grid.attach(themesLabel, 4, rowIndex, 1, 1);

        const statusLabel = new Gtk.Label({
            label: isEnabled ? '' : '(auto)',
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER
        });
        statusLabel.get_style_context().add_class('dim-label');
        grid.attach(statusLabel, 5, rowIndex, 1, 1);

        toggle.connect('state-set', (widget, state) => {
            toggle.set_tooltip_text(state ? 'Enabled' : 'Disabled');
            statusLabel.set_label(state ? '' : '(auto)');
            if (state) {
                pathLabel.get_style_context().remove_class('dim-label');
            } else {
                pathLabel.get_style_context().add_class('dim-label');
            }
            this.handleGlobalMigrationToggle(param, state);
            return false;
        });
    };

    prototype.buildMigrationRow = function(param) {
        return new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
    };

    prototype.isGlobalMigrationEnabled = function(param) {
        const isLegacy = param.type === 'legacy';
        const isConverted = param.subtype === 'converted';
        const legacySettings = this.settings.legacySettings || {};

        if (isLegacy) {
            if (isConverted) {
                return (legacySettings.globalRevertedConversions || []).includes(param.oldPath);
            } else {
                return (legacySettings.globalEnabledLegacy || []).includes(param.path);
            }
        } else {
            if (isConverted) {
                return (legacySettings.globalRevertedFutureConversions || []).includes(param.newPath);
            } else {
                return (legacySettings.globalEnabledFuture || []).includes(param.path);
            }
        }
    };

    prototype.handleGlobalMigrationToggle = function(param, enabled) {
        const isLegacy = param.type === 'legacy';
        const isConverted = param.subtype === 'converted';

        if (isLegacy) {
            if (isConverted) {
                this.handleLegacyRevertToggle(param.oldPath, enabled);
            } else {
                this.handleLegacyEnableToggle(param.path, enabled);
            }
        } else {
            if (isConverted) {
                this.handleFutureRevertToggle(param.newPath, enabled);
            } else {
                this.handleFutureEnableToggle(param.path, enabled);
            }
        }
    };

    prototype.handleLegacyEnableToggle = function(paramPath, enabled) {
        const legacySettings = { ...(this.settings.legacySettings || {}) };
        const enabledList = [...(legacySettings.globalEnabledLegacy || [])];

        if (enabled) {
            if (!enabledList.includes(paramPath)) {
                enabledList.push(paramPath);
            }
        } else {
            const index = enabledList.indexOf(paramPath);
            if (index !== -1) {
                enabledList.splice(index, 1);
            }
        }

        legacySettings.globalEnabledLegacy = enabledList;
        this.settings.legacySettings = legacySettings;

        if (this.onOverridesChanged) {
            this.onOverridesChanged();
        }

        this.reapplyLegacySettings();
    };

    prototype.handleLegacyRevertToggle = function(oldPath, reverted) {
        const legacySettings = { ...(this.settings.legacySettings || {}) };
        const revertedList = [...(legacySettings.globalRevertedConversions || [])];

        if (reverted) {
            if (!revertedList.includes(oldPath)) {
                revertedList.push(oldPath);
            }
        } else {
            const index = revertedList.indexOf(oldPath);
            if (index !== -1) {
                revertedList.splice(index, 1);
            }
        }

        legacySettings.globalRevertedConversions = revertedList;
        this.settings.legacySettings = legacySettings;

        if (this.onOverridesChanged) {
            this.onOverridesChanged();
        }

        this.reapplyLegacySettings();
    };

    prototype.handleFutureEnableToggle = function(paramPath, enabled) {
        const legacySettings = { ...(this.settings.legacySettings || {}) };
        const enabledList = [...(legacySettings.globalEnabledFuture || [])];

        if (enabled) {
            if (!enabledList.includes(paramPath)) {
                enabledList.push(paramPath);
            }
        } else {
            const index = enabledList.indexOf(paramPath);
            if (index !== -1) {
                enabledList.splice(index, 1);
            }
        }

        legacySettings.globalEnabledFuture = enabledList;
        this.settings.legacySettings = legacySettings;

        if (this.onOverridesChanged) {
            this.onOverridesChanged();
        }

        this.reapplyLegacySettings();
    };

    prototype.handleFutureRevertToggle = function(newPath, reverted) {
        const legacySettings = { ...(this.settings.legacySettings || {}) };
        const revertedList = [...(legacySettings.globalRevertedFutureConversions || [])];

        if (reverted) {
            if (!revertedList.includes(newPath)) {
                revertedList.push(newPath);
            }
        } else {
            const index = revertedList.indexOf(newPath);
            if (index !== -1) {
                revertedList.splice(index, 1);
            }
        }

        legacySettings.globalRevertedFutureConversions = revertedList;
        this.settings.legacySettings = legacySettings;

        if (this.onOverridesChanged) {
            this.onOverridesChanged();
        }

        this.reapplyLegacySettings();
    };

    prototype.reapplyLegacySettings = function() {
        if (!this.parameterService) return;

        this.parameterService.reapplyOverridesToAllThemes(this.settings)
            .then(result => {
                if (result.errors?.length > 0) {
                    console.log('[OverrideTabLegacy] Errors reapplying:', result.errors);
                }
            })
            .catch(e => {
                console.log('[OverrideTabLegacy] Error reapplying legacy settings:', e.message);
            });
    };
}
