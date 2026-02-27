export class Store {
    constructor(initialState = {}) {
        this.state = {...initialState};
        this.subscribers = new Map();
    }

    isObj(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    arraysEqual(a, b) {
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    objectsEqual(a, b) {
        const ak = Object.keys(a), bk = Object.keys(b);
        return ak.length === bk.length && ak.every(k => a[k] === b[k]);
    }

    shallowEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        const bothArrays = Array.isArray(a) && Array.isArray(b);
        const bothObjects = !bothArrays && typeof a === 'object' && typeof b === 'object';
        return bothArrays ? this.arraysEqual(a, b) : (bothObjects ? this.objectsEqual(a, b) : false);
    }

    setDependencies() {
    }

    standardizeSameRefValue(value) {
        return Array.isArray(value)
            ? value.slice()
            : (this.isObj(value) ? {...value} : null);
    }

    getState() {
        return {...this.state};
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        const oldValue = this.state[key];
        const sameRef = (oldValue === value);
        const next = sameRef ? this.standardizeSameRefValue(value) : value;
        if (sameRef && next === null) {
            return;
        }

        this.state[key] = next;

        this.notifySubscribers(key, next, oldValue);
    }

    update(updates) {
        const entries = (updates && typeof updates === 'object') ? Object.entries(updates) : [],
            changes = entries.reduce((acc, [key, value]) => {
            const oldValue = this.state[key],
                next = oldValue === value ? this.standardizeSameRefValue(value) : value;
            if ((oldValue === value && next === null) || this.shallowEqual(oldValue, next)) {
                return acc;
            }
            acc.push({key, value: next, oldValue});
            return acc;
        }, []);

        changes.length && (
            changes.forEach(({key, value}) => { this.state[key] = value; }),
            changes.forEach(({key, value, oldValue}) => this.notifySubscribers(key, value, oldValue))
        );
    }

    subscribe(key, callback, context = null) {
        this.subscribers.has(key) || this.subscribers.set(key, []);
        const subscription = {
            callback, context, id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        };
        this.subscribers.get(key).push(subscription);
        return () => this.unsubscribe(key, subscription.id);
    }

    unsubscribe(key, subscriptionId) {
        const list = this.subscribers.get(key);
        if (!list) return false;

        const idx = list.findIndex(sub => sub.id === subscriptionId);
        if (idx === -1) return false;
        list.splice(idx, 1);
        list.length === 0 && this.subscribers.delete(key);
        return true;
    }

    notifySubscribers(key, newValue, oldValue) {
        const targets = [...(this.subscribers.get(key) ?? []), ...(this.subscribers.get('*') ?? [])];
        for (const s of targets) {
            s.context ? s.callback.call(s.context, newValue, oldValue, key) : s.callback(newValue, oldValue, key);
        }
    }

    reset(newInitialState = null) {
        const oldState = {...this.state};
        this.state = newInitialState ? {...newInitialState} : {};

        for (const key of Object.keys(oldState)) {
            this.notifySubscribers(key, this.state[key], oldState[key]);
        }
    }

    computed(name, dependencyKeys, computeFn, context = null) {
        let recompute = () => {
            let deps = dependencyKeys.map(key => this.get(key)),
                newValue = context ? computeFn.call(context, ...deps) : computeFn(...deps);
            this.shallowEqual(this.state[name], newValue) || this.set(name, newValue);
        };
        let unsubs = dependencyKeys.map(key => this.subscribe(key, recompute));
        recompute();
        return () => {
            unsubs.forEach(u => u());
            delete this.state[name];
        };
    }

    action(name, actionFn, context = null) {
        this[name] = (...args) => {
            return context ? actionFn.call(context, this, ...args) : actionFn(this, ...args);
        };
    }

    destroy() {
        this.subscribers.clear();
        this.state = {};
    }
}
