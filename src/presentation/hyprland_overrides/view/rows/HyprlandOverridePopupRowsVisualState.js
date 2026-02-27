export function applyHyprlandOverridePopupRowsVisualState(prototype) {
    prototype.updateOverrideLabelClass = function(label, hasPerRice, hasGlobal) {
        const ctx = label?.get_style_context?.();
        ctx && (() => {
            switch (true) {
            case hasPerRice:
                ctx.add_class('per-rice-override-label');
                ctx.remove_class('global-override-label');
                return;
            case hasGlobal:
                ctx.add_class('global-override-label');
                ctx.remove_class('per-rice-override-label');
                return;
            default:
                break;
            }
            ctx.remove_class('per-rice-override-label');
            ctx.remove_class('global-override-label');
        })();
    };

    prototype.updateParameterVisualState = function(paramPath, entryData) {
        entryData && (() => {
            const hasPerRice = this.currentOverrides[paramPath] !== undefined;
            const hasGlobal = this.globalOverrides[paramPath] !== undefined;

            entryData.nameLabel && this.updateOverrideLabelClass(entryData.nameLabel, hasPerRice, hasGlobal);
            entryData.globalBtn && (() => {
                entryData.globalBtn.set_sensitive(hasPerRice);
                const ctx = entryData.globalBtn.get_style_context?.();
                ctx && ctx[hasGlobal ? 'add_class' : 'remove_class']('has-global');
                entryData.globalBtn.set_tooltip_text(
                    hasGlobal
                        ? (this.t('USE_GLOBAL_OVERRIDE_TOOLTIP') || 'Use global override value')
                        : (this.t('CLEAR_PER_RICE_TOOLTIP') || 'Clear per-rice override')
                );
            })();
            entryData.digBtn && (() => {
                const initiator = this.globalOverrideInitiators?.[paramPath];
                const digActive = hasGlobal && initiator === this.currentTheme?.name;

                const ctx = entryData.digBtn.get_style_context?.();
                ctx && ctx[digActive ? 'add_class' : 'remove_class']('dig-active');
                entryData.digBtn.set_sensitive(!digActive);
            })();
        })();
    };
}
