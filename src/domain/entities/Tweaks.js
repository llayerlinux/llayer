import { TRUTHY_STRINGS } from '../../infrastructure/constants/BooleanValues.js';

const TweaksConstants = {
    DEFAULTS: {
        rounding: 10,
        blur: 5,
        blurEnabled: true,
        blurPasses: 1,
        blurOptimizations: true,
        gapsIn: 5,
        gapsOut: 20,
        animations: true,
        dimInactive: false,
        dimStrength: 0.5,
        activeOpacity: 1.0,
        inactiveOpacity: 1.0,
        fullscreenOpacity: 1.0,
        layout: 'dwindle',
        mouseSensitivity: 1.0,
        scrollFactor: 1.0,
        followMouse: true,
        forceNoAccel: false,
        naturalScroll: false,
        locked: false,
        loadInProgress: false,
        applyOverride: false
    }
};

export class Tweaks {
    constructor(props = {}) {
        const defaults = TweaksConstants.DEFAULTS;

        this.rounding = this.validateNumber(props.rounding, defaults.rounding, 0, 50);
        this.blur = this.validateNumber(props.blur, defaults.blur, 0, 15);
        this.blurEnabled = this.validateBoolean(props.blurEnabled, defaults.blurEnabled);
        this.blurPasses = this.validateNumber(props.blurPasses, defaults.blurPasses, 1, 10);
        this.blurOptimizations = this.validateBoolean(props.blurOptimizations, defaults.blurOptimizations);

        this.gapsIn = this.validateNumber(props.gapsIn, defaults.gapsIn, 0, 40);
        this.gapsOut = this.validateNumber(props.gapsOut, defaults.gapsOut, 0, 40);

        this.animations = this.validateBoolean(props.animations, defaults.animations);

        this.dimInactive = this.validateBoolean(props.dimInactive, defaults.dimInactive);
        this.dimStrength = this.validateNumber(props.dimStrength, defaults.dimStrength, 0, 1);
        this.activeOpacity = this.validateNumber(props.activeOpacity, defaults.activeOpacity, 0.1, 1.0);
        this.inactiveOpacity = this.validateNumber(props.inactiveOpacity, defaults.inactiveOpacity, 0.1, 1.0);
        this.fullscreenOpacity = this.validateNumber(props.fullscreenOpacity, defaults.fullscreenOpacity, 0.1, 1.0);

        this.layout = props.layout || defaults.layout;

        this.mouseSensitivity = this.validateNumber(props.mouseSensitivity, defaults.mouseSensitivity, 0.1, 3.0);
        this.scrollFactor = this.validateNumber(props.scrollFactor, defaults.scrollFactor, 0.1, 5.0);
        this.followMouse = this.validateBoolean(props.followMouse, defaults.followMouse);
        this.forceNoAccel = this.validateBoolean(props.forceNoAccel, defaults.forceNoAccel);
        this.naturalScroll = this.validateBoolean(props.naturalScroll, defaults.naturalScroll);

        this.locked = this.validateBoolean(props.locked, defaults.locked);
        this.loadInProgress = this.validateBoolean(props.loadInProgress, defaults.loadInProgress);
        this.applyOverride = this.validateBoolean(props.applyOverride, defaults.applyOverride);
    }

    static createDefault() {
        return new Tweaks({...TweaksConstants.DEFAULTS});
    }

    withPatch(patch) {
        const newProps = {...this.toObject(), ...patch};
        return new Tweaks(newProps);
    }

    toObject() {
        return {
            rounding: this.rounding,
            blur: this.blur,
            blurEnabled: this.blurEnabled,
            blurPasses: this.blurPasses,
            blurOptimizations: this.blurOptimizations,
            gapsIn: this.gapsIn,
            gapsOut: this.gapsOut,
            animations: this.animations,
            dimInactive: this.dimInactive,
            dimStrength: this.dimStrength,
            activeOpacity: this.activeOpacity,
            inactiveOpacity: this.inactiveOpacity,
            fullscreenOpacity: this.fullscreenOpacity,
            layout: this.layout,
            mouseSensitivity: this.mouseSensitivity,
            scrollFactor: this.scrollFactor,
            followMouse: this.followMouse,
            forceNoAccel: this.forceNoAccel,
            naturalScroll: this.naturalScroll,
            locked: this.locked,
            loadInProgress: this.loadInProgress,
            applyOverride: this.applyOverride
        };
    }

    toHyprlandCommands() {
        const toFlag = (value) => value ? '1' : '0';
        const commands = [
            `decoration:rounding ${this.rounding}`,
            `decoration:blur:size ${this.blur}`,
            `decoration:blur:enabled ${toFlag(this.blurEnabled)}`,
            `decoration:blur:passes ${this.blurPasses}`,
            `decoration:blur:new_optimizations ${toFlag(this.blurOptimizations)}`,
            `general:gaps_in ${this.gapsIn}`,
            `general:gaps_out ${this.gapsOut}`,
            `animations:enabled ${toFlag(this.animations)}`
        ];

        if (this.dimInactive) {
            commands.push(`decoration:dim_inactive ${toFlag(this.dimInactive)}`);
            commands.push(`decoration:dim_strength ${this.dimStrength}`);
        }

        commands.push(
            `decoration:active_opacity ${this.activeOpacity}`,
            `decoration:inactive_opacity ${this.inactiveOpacity}`,
            `decoration:fullscreen_opacity ${this.fullscreenOpacity}`,
            `general:layout ${this.layout}`,
            `input:sensitivity ${this.mouseSensitivity}`,
            `input:scroll_factor ${this.scrollFactor}`,
            `input:follow_mouse ${toFlag(this.followMouse)}`,
            `input:force_no_accel ${toFlag(this.forceNoAccel)}`,
            `input:natural_scroll ${toFlag(this.naturalScroll)}`
        );

        return commands;
    }

    validateNumber(value, defaultValue, min = -Infinity, max = Infinity) {
        const num = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(num)) {
            return defaultValue;
        }
        return Math.max(min, Math.min(max, num));
    }

    validateBoolean(value, defaultValue) {
        return typeof value === 'boolean'
            ? value
            : typeof value === 'string'
            ? TRUTHY_STRINGS.includes(value)
            : (typeof value === 'number' ? value === 1 : defaultValue);
    }

}
