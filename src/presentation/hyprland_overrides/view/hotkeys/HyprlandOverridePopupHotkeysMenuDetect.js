import { HotkeyAction } from '../../../../domain/valueObjects/HotkeyOverride.js';

const MENU_KEYWORDS = ['launcher', 'menu', 'powermenu', 'applauncher', 'appmenu', 'quicksettings', 'overview', 'drun'];
const DIRECT_LAUNCHERS = ['rofi', 'wofi', 'fuzzel', 'bemenu', 'tofi', 'walker', 'dmenu', 'wlogout'];
const MENU_SCORE_WEIGHTS = {
    launcher: 3,
    powermenu: 3,
    quicksettings: 2,
    drun: 2,
    menu: 1,
    rofi: 2,
    wofi: 2,
    fuzzel: 2,
    bemenu: 2,
    tofi: 2,
    walker: 2,
    dmenu: 2,
    wlogout: 2
};

function standardizeDispatcher(dispatcher) {
    return String(dispatcher || '').toLowerCase();
}

function getOverrideCommand(override) {
    return override?.args || '';
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}

function includesAny(text, values) {
    return values.some((value) => text.includes(value));
}

function collectAddedOverrideCandidates(entries, source, visitor) {
    entries
        .filter(([, override]) => override?.action === HotkeyAction.ADD)
        .forEach(([id, override]) => {
            const command = getOverrideCommand(override);
            visitor({
                dispatcher: override?.dispatcher,
                command,
                value: { hotkey: null, override, command, source, addedId: id }
            });
        });
}

export function applyHyprlandOverridePopupHotkeysMenuDetect(prototype) {
    prototype.isExecMenuCommand = function(dispatcher, command) {
        return standardizeDispatcher(dispatcher) === 'exec' && this.isMenuCommand(command);
    };

    prototype.findMenuHotkeysFromGroups = function(groups) {
        const groupEntries = [...(groups?.entries?.() ?? [])];
        return groupEntries.length > 0
            ? (() => {
                const results = [];
                const seen = new Set();
                const pushUnique = (type, key, item, command) => {
                    seen.has(key) || (seen.add(key), results.push({ type, command, ...item }));
                };

                const addHotkeyCandidate = (item) => {
                    const action = this.getCurrentActionForHotkey(item.hotkey, item.override, item.source);
                    const parsed = this.parseAction(action);
                    const command = (parsed && this.isExecMenuCommand(parsed.dispatcher, parsed.args))
                        ? parsed.args
                        : null;
                    command && pushUnique('hotkey', `hotkey:${item.hotkey?.id || ''}`, item, command);
                };

                const addOverrideCandidate = (item) => {
                    const command = getOverrideCommand(item.override);
                    this.isExecMenuCommand(item.override?.dispatcher, command)
                        && pushUnique('added', `added:${item.id || ''}`, item, command);
                };

                for (const [, group] of groupEntries) {
                    (group.hotkeys ?? []).forEach(addHotkeyCandidate);
                    (group.addedHotkeys ?? []).forEach(addOverrideCandidate);
                }

                return results;
            })()
            : [];
    };

    prototype.isMenuCommand = function(command) {
        return isNonEmptyString(command)
            ? (() => {
                const text = command.toLowerCase();
                const isWidgetEngineCommand = text.includes('ags ') || text.includes('eww ');
                const hasMenuKeyword = includesAny(text, MENU_KEYWORDS);
                return includesAny(text, DIRECT_LAUNCHERS)
                    || hasMenuKeyword
                    || /^\$[a-z0-9_-]*(menu|launcher)[a-z0-9_-]*$/.test(text)
                    || (isWidgetEngineCommand && hasMenuKeyword);
            })()
            : false;
    };

    prototype.getMenuScore = function(command) {
        return isNonEmptyString(command)
            ? (() => {
                const text = command.toLowerCase();
                return Object.entries(MENU_SCORE_WEIGHTS).reduce(
                    (score, [needle, weight]) => score + (text.includes(needle) ? weight : 0),
                    0
                );
            })()
            : 0;
    };

    prototype.findMenuHotkey = function(collection) {
        const hasCollection = Boolean(collection);
        return hasCollection
            ? (() => {

                let best = null;
                let bestScore = -1;
                const considerCandidate = (candidate) => {
                    (candidate && this.isExecMenuCommand(candidate.dispatcher, candidate.command)) && (() => {
                        const score = this.getMenuScore(candidate.command);
                        score > bestScore && (
                            bestScore = score,
                            best = candidate.value
                        );
                    })();
                };
                const considerAddedOverrides = (entries, source) =>
                    collectAddedOverrideCandidates(entries, source, considerCandidate);

                for (const hotkey of collection.getAllOriginalHotkeys().filter(Boolean)) {
                    const command = hotkey.args || '';
                    considerCandidate({
                        dispatcher: hotkey.dispatcher,
                        command,
                        value: { hotkey, command, source: 'original' }
                    });
                }

                considerAddedOverrides(Object.entries(this.currentHotkeyOverrides ?? {}), 'per-rice');

                collection?.global && considerAddedOverrides(collection.global, 'global');

                !best && (() => {
                    for (const hotkey of collection.getAllOriginalHotkeys().filter(Boolean)) {
                        const effective = collection.getEffectiveOverride(hotkey.id);
                        const command = effective?.args ?? hotkey.args ?? '';
                        considerCandidate({
                            dispatcher: effective?.dispatcher || hotkey.dispatcher,
                            command,
                            value: { hotkey, command, source: collection.getEffectiveSource(hotkey.id) || 'effective' }
                        });
                    }
                })();

                return best;
            })()
            : null;
    };

    prototype.formatOverrideAction = function(override) {
        return override ? `${override.dispatcher || ''} ${override.args || ''}`.trim() : '';
    };
}
