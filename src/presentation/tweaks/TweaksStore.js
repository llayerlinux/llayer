import { Events } from '../../app/eventBus.js';

export class TweaksStore {
    constructor(container, TweaksClass) {
        this.TweaksClass = TweaksClass;
        const Tweaks = this.TweaksClass;
        const defaultTweaks = new Tweaks({
            rounding: 10,
            blur: 5,
            blurEnabled: true,
            gapsIn: 5,
            gapsOut: 20,
            blurPasses: 1,
            blurOptimizations: true,
            animations: true,
            locked: false,
            loadInProgress: false,
            applyOverride: false
        });

        this.state = {
            loading: false,
            tweaks: defaultTweaks,
            dirty: false,
            error: null,
            locked: false,
            loadInProgress: false,
            currentTab: 0
        };

        const bus = container.get('eventBus');

        bus.on(Events.TWEAKS_LOADING, () => {
            this.patchState({loading: true, error: null});
        });
        bus.on(Events.TWEAKS_LOADED, (t) => {
            this.setState({loading: false, tweaks: t, dirty: false, error: null, locked: false, loadInProgress: false});
        });
        bus.on(Events.TWEAKS_LOAD_ERROR, (e) => {
            this.patchState({loading: false, error: e});
        });

        bus.on(Events.TWEAKS_CHANGED, (t) => {
            this.patchState({tweaks: t, dirty: true});
        });
        bus.on(Events.TWEAKS_APPLIED, () => {
            this.patchState({dirty: false});
        });

        bus.on(Events.TWEAKS_LOCKED, () => {
            this.patchState({locked: true});
        });
        bus.on(Events.TWEAKS_UNLOCKED, () => {
            this.patchState({locked: false});
        });

        bus.on(Events.TWEAKS_TAB_CHANGED, (tabIndex) => {
            this.patchState({currentTab: tabIndex});
        });
    }

    setState(nextState) {
        this.state = nextState;
    }

    patchState(patch) {
        this.state = {...this.state, ...patch};
    }

    patch(patch) {
        return this.state.locked
            ? this.state.tweaks
            : (
                this.state = {
                    ...this.state,
                    tweaks: this.state.tweaks.withPatch(patch),
                    dirty: true
                },
                this.state.tweaks
            );
    }

    setLocked(locked) {
        this.patchState({locked});
    }

    setCurrentTab(tabIndex) {
        this.patchState({currentTab: tabIndex});
    }

    get snapshot() {
        return this.state;
    }

    get canModify() {
        return !this.state.locked && !this.state.loading && !this.state.loadInProgress;
    }

    get currentTweaks() {
        return this.state.tweaks;
    }

    reset() {
        const Tweaks = this.TweaksClass;
        const defaultTweaks = Tweaks.createDefault();
        this.patchState({tweaks: defaultTweaks, dirty: true, error: null});
        return this.state.tweaks;
    }
}
