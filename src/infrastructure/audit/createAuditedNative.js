import { SupporterAuditLog } from './SupporterAuditLog.js';
import { tryOrFalse } from '../utils/ErrorUtils.js';

export function createAuditedNative(native, serviceName, auditLog = null) {
    const log = auditLog || SupporterAuditLog.getInstance();
    if (!log?.enabled || !native) return native;

    const methods = discoverMethods(native);
    if (methods.length === 0) return native;

    for (const name of methods) {
        const original = native[name];
        if (typeof original !== 'function') continue;

        native[`_audit_orig_${name}`] = original;
        native[name] = function (...args) {
            const start = Date.now();
            try {
                return original.apply(native, args);
            } finally {
                log.log(serviceName, name, args, Date.now() - start);
            }
        };
    }

    return native;
}

function discoverMethods(native) {
    const methods = [];
    const skip = new Set([
        'connect', 'disconnect', 'emit', 'connect_after',
        'notify', 'bind_property', 'ref', 'unref',
        'get_property', 'set_property', 'constructor'
    ]);

    let obj = native;
    const seen = new Set();
    for (let depth = 0; depth < 3 && obj; depth++) {
        for (const name of Object.getOwnPropertyNames(obj)) {
            if (seen.has(name) || skip.has(name)) continue;
            if (name.startsWith('_') || name.startsWith('vfunc_')) continue;
            seen.add(name);
            tryOrFalse('createAuditedNative.discoverMethods', () => typeof native[name] === 'function')
                && methods.push(name);
        }
        obj = Object.getPrototypeOf(obj);
    }
    return methods;
}
