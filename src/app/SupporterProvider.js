export class SupporterProvider {
    constructor() {
        this.available = false;
        this.enabled = false;
        this.modules = {};
        this.toggleListeners = [];
    }

    setModules(modules) {
        this.modules = modules || {};
        this.available = true;
        this.enabled = true;
    }

    isActive() { return this.available && this.enabled; }

    toggle() {
        if (!this.available) return false;
        this.enabled = !this.enabled;
        this.toggleListeners.forEach((listener) => listener(this.enabled));
        return this.enabled;
    }

    onToggle(listener) { this.toggleListeners.push(listener); }

    get(name) { return this.isActive() ? this.modules[name] ?? null : null; }
    has(name) { return this.isActive() && name in this.modules; }
}
