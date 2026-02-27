import GLib from 'gi://GLib';
import { sanitizeHotkeyOverrideMap } from '../../../../infrastructure/hyprland/HotkeyOverrideSanitizer.js';

export function applyHyprlandOverridePopupHotkeysDialogsSave(targetPrototype) {
    targetPrototype.savePerRiceHotkeyOverrides = function() {
        if (!(this.currentTheme && this.hotkeyService)) {
            return;
        }

        let themePath = this.getCurrentThemePath(),
            nextOverrides = sanitizeHotkeyOverrideMap(this.currentHotkeyOverrides).overrides;
        this.currentHotkeyOverrides = { ...nextOverrides };
        this.hotkeyService.savePerRiceOverrides(themePath, nextOverrides);
        this.setApplyPending?.(true);

        let settings = this.settingsManager?.getAll?.() ?? {},
            activeTheme = typeof settings.theme === 'string' ? settings.theme.trim() : '';
        (activeTheme && activeTheme === this.currentTheme?.name)
            && this.hotkeyService.applyOverridesNow?.(themePath, settings);
    };

    targetPrototype.saveGlobalHotkeyOverrides = function() {
        this.settingsManager && (
            this.globalHotkeyOverrides = {
                ...sanitizeHotkeyOverrideMap(this.globalHotkeyOverrides).overrides
            },
            this.settingsManager.writeGlobalHotkeys?.(this.globalHotkeyOverrides ?? {}, this.globalHotkeyInitiators ?? {}),
            this.globalHotkeyInitiators = {
                ...(this.settingsManager.readGlobalHotkeysState?.()?.initiators ?? {})
            },
            this.settingsManager.set?.('hotkeyOverrides', this.globalHotkeyOverrides ?? {}),
            this.setApplyPending?.(true),
            (() => {
                let settings = this.settingsManager.getAll?.() ?? {},
                    activeTheme = typeof settings.theme === 'string' ? settings.theme.trim() : '',
                    themePath = activeTheme ? `${GLib.get_home_dir()}/.config/themes/${activeTheme}` : null;
                themePath && this.hotkeyService?.applyOverridesNow?.(themePath, settings);
            })()
        );
    };
}
