export class DIContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }

    getServiceDefinition(name) {
        return this.services.get(name) || null;
    }

    createSingleton(name, factory) {
        const instance = factory(this);
        this.singletons.set(name, instance);
        return instance;
    }

    singleton(name, factory) {
        this.services.set(name, {type: 'singleton', factory});
        return this;
    }

    transient(name, factory) {
        this.services.set(name, {type: 'transient', factory});
        return this;
    }

    value(name, value) {
        this.singletons.set(name, value);
        return this;
    }

    get(name) {
        let cached = this.singletons.get(name);
        let service = this.getServiceDefinition(name);
        let factory = service && typeof service.factory === 'function' ? service.factory : null;
        return cached !== undefined
            ? cached
            : (factory
                ? (service?.type === 'singleton'
                    ? (this.singletons.get(name) ?? this.createSingleton(name, factory))
                    : factory(this))
                : null);
    }

    has(name) {
        return this.services.has(name) || this.singletons.has(name);
    }
}
