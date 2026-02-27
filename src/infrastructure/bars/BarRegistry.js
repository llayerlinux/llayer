export const BARS = [{
    id: 'agsv1', name: 'AGS v1', process: 'agsv1', startCmd: 'agsv1', killCmd: 'pkill agsv1', killSignal: null
}, {
    id: 'ags',
    name: 'AGS',
    process: 'ags',
    processPattern: '/run/user/$(id -u)/ags\\.js',
    startCmd: 'ags',
    killCmd: 'pkill -15 -f "/run/user/$(id -u)/ags\\.js"',
    killSignal: 15
}, {
    id: 'eww',
    name: 'EWW',
    process: 'eww',
    startCmd: 'eww daemon && eww open bar',
    killCmd: 'pkill eww',
    killSignal: null
}, {
    id: 'waybar', name: 'Waybar', process: 'waybar', startCmd: 'waybar', killCmd: 'pkill waybar', killSignal: null
}, {
    id: 'polybar', name: 'Polybar', process: 'polybar', startCmd: 'polybar', killCmd: 'pkill polybar', killSignal: null
}, {
    id: 'yambar', name: 'Yambar', process: 'yambar', startCmd: 'yambar', killCmd: 'pkill yambar', killSignal: null
}, {
    id: 'swaybar', name: 'Swaybar', process: 'swaybar', startCmd: 'swaybar', killCmd: 'pkill swaybar', killSignal: null
}, {
    id: 'barberry',
    name: 'Barberry',
    process: 'barberry',
    startCmd: 'barberry',
    killCmd: 'pkill barberry',
    killSignal: null
}, {
    id: 'quickshell',
    name: 'Quickshell',
    process: 'quickshell',
    startCmd: 'quickshell',
    killCmd: 'pkill quickshell',
    killSignal: null
}, {
    id: 'fabric',
    name: 'Fabric',
    process: 'fabric',
    startCmd: 'fabric',
    killCmd: 'pkill fabric',
    killSignal: null
}, {
    id: 'ignis',
    name: 'Ignis',
    process: 'goignis',
    processPattern: 'goignis|python.*ignis',
    startCmd: 'goignis init',
    killCmd: 'pkill -f "goignis|python.*ignis"',
    killSignal: 15
}, {
    id: 'hyprpanel',
    name: 'HyprPanel',
    process: 'hyprpanel',
    startCmd: 'hyprpanel',
    killCmd: 'pkill hyprpanel',
    killSignal: null
}, {
    id: 'nwg-dock-hyprland',
    name: 'Nwg Dock',
    process: 'nwg-dock-hyprland',
    startCmd: 'nwg-dock-hyprland',
    killCmd: 'pkill -f nwg-dock-hyprland',
    killSignal: null
}];

export const BarRegistry = {
    bars: BARS, customBars: [],

    setCustomBars(custom = []) {
        this.customBars = Array.isArray(custom) ? custom : [];
    },

    mergeBars(defaultBars, customBars) {
        const merged = [...defaultBars];
        for (const custom of customBars) {
            const existingIdx = merged.findIndex(b => b.id === custom.id);
            (existingIdx >= 0)
                ? (merged[existingIdx] = {...merged[existingIdx], ...custom})
                : merged.push(custom);
        }
        return merged;
    },

    getMergedBars() {
        return this.mergeBars(BARS, this.customBars);
    },

    getIds() {
        return this.getMergedBars().map(b => b.id);
    },

    getById(id) {
        return this.getMergedBars().find(b => b.id === id) || null;
    }, bashArray() {
        return `("${this.getMergedBars().map(b => b.id).join('" "')}")`;
    },

    bashList() {
        return this.getMergedBars().map(b => b.id).join(' ');
    },

    hasSpecialKill(id) {
        const bar = this.getById(id);
        return bar && bar.processPattern;
    },

    generateBashStartCases() {
        return this.getMergedBars()
            .filter(b => b.startCmd && b.startCmd !== b.id)
            .map(b => `        ${b.id}) echo "${b.startCmd}" ;;`)
            .join('\n');
    },

    getDefaultBars() {
        return BARS;
    },

    isDefaultBar(id) {
        return BARS.some(b => b.id === id);
    }
};
