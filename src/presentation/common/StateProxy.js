export function createStateProxy(target, onChange, options = {}) {
    const {deep = false, onGet = null} = options;
    const notifyChange = (prop, oldValue, newValue, deleted = false, obj = target) => {
        onChange?.({prop, oldValue, newValue, deleted, target: obj});
    };

    const handler = {
        set(obj, prop, value) {
            const oldValue = obj[prop];
            const result = Reflect.set(obj, prop, value);

            oldValue !== value && notifyChange(prop, oldValue, value, false, obj);

            return result;
        },

        deleteProperty(obj, prop) {
            const hadProp = prop in obj;
            const oldValue = obj[prop];
            const result = Reflect.deleteProperty(obj, prop);

            hadProp && notifyChange(prop, oldValue, undefined, true, obj);

            return result;
        },

        get(obj, prop) {
            const value = Reflect.get(obj, prop);

            onGet?.({prop, value, target: obj});

            return (deep && value && typeof value === 'object' && !Array.isArray(value))
                ? createStateProxy(value, onChange, options)
                : value;
        }
    };

    return new Proxy(target, handler);
}

export function clonePlainObject(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }
    return JSON.parse(JSON.stringify(value));
}
