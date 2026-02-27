export class EventBindings {
    constructor(bus) {
        this.bus = bus;
        this.listenerIds = [];
        this.namedListeners = new Map();
    }

    on(event, handler, name = null) {
        const id = this.bus.on(event, handler);
        const entry = {event, id, handler};
        this.listenerIds.push(entry);
        name && this.namedListeners.set(name, entry);
        return id;
    }

    once(event, handler) {
        return this.bus.once(event, handler);
    }

    off(event, id) {
        this.bus.off(event, id);
        this.listenerIds = this.listenerIds.filter(e => !(e.event === event && e.id === id));
    }

    offByName(name) {
        const entry = this.namedListeners.get(name);
        entry && (
            this.off(entry.event, entry.id),
            this.namedListeners.delete(name)
        );
    }

    emit(event, ...args) {
        this.bus.emit(event, ...args);
    }

    cleanup() {
        this.listenerIds.forEach(({event, id}) => this.bus.off(event, id));

        this.listenerIds = [];
        this.namedListeners.clear();
    }

    get count() {
        return this.listenerIds.length;
    }

}
