const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export function suppressedError(context, error) {
    IS_DEV && error && (() => {
        const message = error instanceof Error ? error.message : String(error);
        console.debug(`[${context}] Suppressed: ${message}`);
    })();
}

export function tryOrDefault(context, operation, fallbackValue) {
    try {
        return operation();
    } catch (e) {
        suppressedError(context, e);
        return fallbackValue;
    }
}

export function tryOrNull(context, operation) {
    return tryOrDefault(context, operation, null);
}

export function tryOrFalse(context, operation) {
    return tryOrDefault(context, operation, false);
}

export function tryRun(context, operation) {
    try {
        operation();
        return true;
    } catch (e) {
        suppressedError(context, e);
        return false;
    }
}

export async function tryOrNullAsync(context, operation) {
    try {
        return await operation();
    } catch (e) {
        suppressedError(context, e);
        return null;
    }
}
