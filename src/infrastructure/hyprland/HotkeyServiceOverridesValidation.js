export function applyHotkeyServiceOverridesValidation(targetPrototype) {
    targetPrototype.validateHotkey = function(hotkeyData) {
        const errors = [];

        !hotkeyData.key && errors.push('Key is required');
        !hotkeyData.dispatcher && errors.push('Dispatcher is required');

        const validMods = ['SUPER', 'SHIFT', 'CTRL', 'CONTROL', 'ALT', 'MOD1', 'MOD2', 'MOD3', 'MOD4', 'MOD5'];
        for (const mod of (hotkeyData.modifiers ?? [])) {
            !validMods.includes(mod.toUpperCase()) && errors.push(`Unknown modifier: ${mod}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    };
}
