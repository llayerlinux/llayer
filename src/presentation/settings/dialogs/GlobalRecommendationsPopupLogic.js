import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
function runByRecommendationType(rec, handlers = {}, fallback = null) {
    const handler = rec && handlers[rec.type];
    return typeof handler === 'function' ? handler(rec) : fallback;
}

function forEachDependent(rec, allRecommendations, callback) {
    (Array.isArray(rec?.dependents) ? rec.dependents : [])
        .map((depId) => allRecommendations.find((entry) => entry.id === depId))
        .filter(Boolean)
        .forEach((dep) => callback(dep));
}

class GlobalRecommendationsPopupLogic {
    isRecommendationApplied(rec) {
        return runByRecommendationType(rec, {
            'keybind': (item) => this.recommendationState[item.id] || Object.values(this.globalHotkeyOverrides).some((override) =>
                override?.isGlobal && override?.metadata && this.buildHotkeyTarget({
                    modifiers: override.metadata.modifiers,
                    key: override.metadata.key,
                    bindType: override.metadata.bindType
                }) === this.buildHotkeyTarget(item)
            ),
            'param': (item) => this.recommendationState[item.id] || this.globalOverrides[item.paramPath] !== undefined,
            'rule': (item) => !!this.recommendationState[item.id],
            'workspaceRule': (item) => this.getAppliedWorkspaces(item).size > 0
        }, false);
    }

    getAppliedWorkspaces(rec) {
        const stateKey = rec?.type === 'workspaceRule' ? `${rec.id}_workspaces` : null;
        const stored = stateKey ? this.recommendationState[stateKey] : null;
        return new Set(Array.isArray(stored) ? stored : []);
    }

    buildHotkeyTarget(rec) {
        const mods = (rec.modifiers ?? []).map(m => m.toUpperCase()).sort().join('+');
        const key = rec.key || '';
        const bindType = rec.bindType || 'bind';
        return `${bindType}:${mods}:${key}`;
    }

    applyRecommendation(rec, allRecommendations) {
        this.recommendationState[rec.id] = true;

        runByRecommendationType(rec, {
            'keybind': (item) => this.applyKeybindRecommendation(item),
            'param': (item) => this.applyParamRecommendation(item),
            'rule': (item) => this.applyRuleRecommendation(item),
            'workspaceRule': (item) => {
                for (const ws of item.workspaces) {
                    this.selectedWorkspaces.add(ws);
                }
                this.applyWorkspaceRules(item);
            }
        });

        forEachDependent(rec, allRecommendations, (dependent) => {
            this.applyRecommendation(dependent, allRecommendations);
        });

        this.saveGlobalOverrides();
    }

    revertRecommendation(rec, allRecommendations) {

        delete this.recommendationState[rec.id];

        runByRecommendationType(rec, {
            'keybind': (item) => this.revertKeybindRecommendation(item),
            'param': (item) => delete this.globalOverrides[item.paramPath],
            'rule': (item) => this.removeExtraLine(item.ruleLine),
            'workspaceRule': (item) => {
                const stateKey = `${item.id}_workspaces`;
                const storedWorkspaces = this.recommendationState[stateKey] ?? [];
                for (const ws of storedWorkspaces) {
                    const line = item.ruleTemplate.replace('{ws}', ws);
                    this.removeExtraLine(line);
                }
                delete this.recommendationState[stateKey];
                this.selectedWorkspaces.clear();
            }
        });

        forEachDependent(rec, allRecommendations, (dependent) => {
            this.revertRecommendation(dependent, allRecommendations);
        });

        this.saveGlobalOverrides();
    }

    applyKeybindRecommendation(rec) {
        const id = `rec_global_${rec.id}_${Date.now()}`;
        this.globalHotkeyOverrides[id] = {
            dispatcher: rec.dispatcher,
            args: rec.args || '',
            action: 'add',
            isRecommended: true,
            isGlobal: true,
            metadata: {
                modifiers: rec.modifiers,
                key: rec.key,
                bindType: rec.bindType
            },
            timestamp: Date.now()
        };
    }

    revertKeybindRecommendation(rec) {
        const target = this.buildHotkeyTarget(rec);
        Object.entries(this.globalHotkeyOverrides)
            .filter(([, override]) => override?.isGlobal && override?.metadata)
            .filter(([, override]) => this.buildHotkeyTarget({
                modifiers: override.metadata.modifiers,
                key: override.metadata.key,
                bindType: override.metadata.bindType
            }) === target)
            .forEach(([id]) => delete this.globalHotkeyOverrides[id]);
    }

    applyParamRecommendation(rec) {
        this.globalOverrides[rec.paramPath] = rec.defaultValue;
    }

    applyRuleRecommendation(rec) {

        this.addExtraLine(rec.ruleLine);
    }

    applyWorkspaceRules(rec) {
        let stateKey = `${rec.id}_workspaces`;

        for (let ws of rec.workspaces) {
            let line = rec.ruleTemplate.replace('{ws}', ws);
            this.removeExtraLine(line);
        }

        let hasSelectedWorkspaces = this.selectedWorkspaces.size > 0;
        hasSelectedWorkspaces && (
            this.recommendationState[stateKey] = Array.from(this.selectedWorkspaces),
            this.recommendationState[rec.id] = true,
            Array.from(this.selectedWorkspaces).forEach((ws) => {
                const line = rec.ruleTemplate.replace('{ws}', ws);
                this.addExtraLine(line);
            })
        );
        !hasSelectedWorkspaces && (delete this.recommendationState[stateKey], delete this.recommendationState[rec.id]);
        this.saveGlobalOverrides();
    }
}

export function applyGlobalRecommendationsPopupLogic(prototype) {
    copyPrototypeDescriptors(prototype, GlobalRecommendationsPopupLogic.prototype);
}
