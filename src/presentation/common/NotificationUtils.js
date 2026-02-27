function normalizeText(value) {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

const NOTIFIER_METHOD_ORDER = ['info', 'success', 'show'];

export function dispatchNotification({notifier = null, source = 'Notification', message = '', details = ''} = {}) {
    const primary = normalizeText(message);
    const extra = normalizeText(details);
    const methodName = primary.length
        ? NOTIFIER_METHOD_ORDER.find((name) => typeof notifier?.[name] === 'function')
        : null;

    const dispatched = Boolean(methodName)
        && (notifier[methodName](primary, extra), true);

    primary.length && !dispatched && (() => {
        const payload = extra.length ? `${primary}: ${extra}` : primary;
        console.debug(`[${source}] ${payload}`);
    })();

    return dispatched;
}
