import { Events } from '../../app/eventBus.js';
import { tryOrNull } from '../../infrastructure/utils/ErrorUtils.js';

const TWEAKS_DEP_KEYS = ['tweaksStore', 'logger', 'notifier', 'commands'];

export class TweaksController {
    constructor(container, TweaksViewClass, TweaksClass) {
        this.container = container;
        this.TweaksViewClass = TweaksViewClass;
        this.TweaksClass = TweaksClass;

        const get = (key) => container.has(key) ? container.get(key) : null;
        [this.store, this.logger, this.notifier, this.commandBin] =
            TWEAKS_DEP_KEYS.map(get);
        this.bus = container.get('eventBus');

        this.bus.on(Events.TWEAKS_OPEN, () => this.open());
        this.bus.on(Events.TWEAKS_CLOSE, () => this.close());
        this.bus.on(Events.TWEAKS_LOAD_REQUESTED, () => this.loadFromHyprland());
        this.bus.on(Events.TWEAKS_APPLY_REQUESTED, () => this.applyToHyprland());
        this.bus.on(Events.TWEAKS_RESET_REQUESTED, () => this.reset());
        this.bus.on(Events.TWEAKS_LOCK_REQUESTED, (locked) => this.setLocked(locked));

        this.view = null;
        this.debounceTimer = null;
        this.lastApplyTime = 0;
        this.DEBOUNCE_DELAY = 300;
    }

    getExecAsync() {
        return (this.container?.has('execAsync') && this.commandBin?.HYPRCTL)
            ? this.container.get('execAsync')
            : null;
    }

    open() {
        this.view = new this.TweaksViewClass(this.container, this);
        return this.view.present();
    }

    close() {
        this.view?.close?.();
        this.view = null;
        this.debounceTimer && clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
    }

    async loadFromHyprland() {
        this.bus.emit(Events.TWEAKS_LOADING);
        const tweaks = this.TweaksClass.createDefault(), execAsync = this.getExecAsync(),
            output = execAsync && await execAsync([this.commandBin.HYPRCTL, 'getoption', '-j']);
        const config = output && tryOrNull('TweaksController.loadFromHyprland.parse', () => JSON.parse(output));
        config && this.mapHyprlandConfigToTweaks(tweaks, config);
        this.bus.emit(Events.TWEAKS_LOADED, tweaks);
        this.bus.emit(Events.TWEAKS_UNLOCKED);
        return tweaks;
    }

    mapHyprlandConfigToTweaks(tweaks, config) {
        const {general = {}, decoration = {}, animations = {}} = config ?? {};
        const readInt = (val, defaultValue) => Number.isNaN(parseInt(val, 10)) ? defaultValue : parseInt(val, 10);

        tweaks.gaps = general.gaps_in ? readInt(general.gaps_in, tweaks.gaps ?? 5) : tweaks.gaps ?? 5;
        tweaks.borderSize = general.border_size ? readInt(general.border_size, tweaks.borderSize ?? 2) : tweaks.borderSize ?? 2;
        tweaks.rounding = decoration.rounding ? readInt(decoration.rounding, tweaks.rounding ?? 10) : tweaks.rounding ?? 10;
        tweaks.blur = decoration.blur ? Boolean(decoration.blur.enabled) : tweaks.blur ?? false;
        tweaks.animations = animations.enabled !== undefined ? animations.enabled : (tweaks.animations ?? true);
    }

    async applyToHyprland() {
        return this.store.canModify
            ? (async () => {
                const commands = this.store.currentTweaks.toHyprlandCommands(),
                    execAsync = this.getExecAsync();
                execAsync && (await (async () => {
                    const results = [],
                        parsedCommands = commands
                            .map((cmd) => ({ cmd, parts: cmd.split(' ') }))
                            .filter(({parts}) => parts.length >= 2);

                    for (const {cmd, parts} of parsedCommands) {
                        const key = parts[0], value = parts.slice(1).join(' ');
                        results.push({success: true, command: cmd, result: await execAsync([this.commandBin.HYPRCTL, 'keyword', key, value])});
                    }

                    results.filter(r => !r.success).length > 0 && this.bus.emit(Events.TWEAKS_APPLY_PARTIAL, {
                        total: commands.length,
                        failed: results.filter(r => !r.success)
                    });
                })());

                this.bus.emit(Events.TWEAKS_APPLIED);
            })()
            : undefined;
    }

    applyWithDebounce(delayMs = null) {
        let delay = delayMs ?? this.DEBOUNCE_DELAY;
        this.debounceTimer && clearTimeout(this.debounceTimer);

        const timeSinceLastApply = Date.now() - this.lastApplyTime;
        timeSinceLastApply < this.DEBOUNCE_DELAY && (delay = Math.max(delay, this.DEBOUNCE_DELAY - timeSinceLastApply));

        this.debounceTimer = setTimeout(async () => {
            await this.applyToHyprland();
            this.lastApplyTime = Date.now();
            this.debounceTimer = null;
        }, delay);
    }

    setPatch(patch) {
        return this.store.canModify
            ? (() => {
                const tweaks = this.store.patch(patch);
                this.bus.emit(Events.TWEAKS_CHANGED, tweaks);
                this.applyWithDebounce();
                return tweaks;
            })()
            : undefined;
    }

    async reset() {
        const defaultTweaks = this.store.reset();
        this.bus.emit(Events.TWEAKS_CHANGED, defaultTweaks);

        await this.applyToHyprland();
    }

    setLocked(locked) {
        this.store.setLocked(locked);
        this.bus.emit(locked ? Events.TWEAKS_LOCKED : Events.TWEAKS_UNLOCKED);
    }

    changeTab(tabIndex) {
        this.store.setCurrentTab(tabIndex);
        this.bus.emit(Events.TWEAKS_TAB_CHANGED, tabIndex);
    }

    err(where, e) {
        const message = `${where} failed: ${e.message || e}`;
        this.logger?.error?.(`[TweaksController] ${message}`);
        this.notifier?.error?.(`Tweaks error: ${where.toLowerCase()}`);
    }
}
