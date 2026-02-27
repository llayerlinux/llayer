import { standardizeParamValue, runByRecommendationType } from './HyprlandRecommendationsUtils.js';

function createDefaultRecommendationStatus() {
    return { applied: false, appliedSelf: false, appliedChildren: true, previousValue: null, canRevert: false };
}

function hasMeaningfulValue(value) {
    return value !== undefined && value !== null && value !== '';
}

function hasSavedPreviousValue(saved) {
    return saved?.previousValue !== null && saved?.previousValue !== undefined;
}

function resolveRuleToCheck(item) {
    return item.primaryRule || item.ruleLine?.split?.('\n')?.[0] || item.ruleLine;
}

export function applyHyprlandRecommendationsStatus(prototype) {
    prototype.getOverrideChainValue = function(paramPath, fallback = '') {
        return [
            this.currentOverrides?.[paramPath],
            this.globalOverrides?.[paramPath],
            this.originalValues?.[paramPath]
        ].find((candidate) => hasMeaningfulValue(candidate)) ?? fallback;
    };

    prototype.getRecommendationStatus = function(rec, options = {}) {
        let visited = options.visited || new Set(),
            blocked = !rec || visited.has(rec.id);
        return blocked
            ? createDefaultRecommendationStatus()
            : (() => {
                visited.add(rec.id);

                let savedRecs = this.getSavedRecommendations(),
                    saved = savedRecs[rec.id];

        let appliedSelf = runByRecommendationType(rec, {
            'keybind': (item) => !!this.findRecommendationOverride?.(item) || !!this.findOriginalRecommendationHotkey?.(item),
            'dropdown': (item) => (this.currentOverrides?.[item.paramPath] ?? this.globalOverrides?.[item.paramPath]) === item.recommendedValue,
            'param': (item) => {
                let override = this.currentOverrides?.[item.paramPath],
                    globalOverride = this.globalOverrides?.[item.paramPath],
                    original = this.originalValues?.[item.paramPath];
                return override !== undefined || globalOverride !== undefined
                    || (original !== undefined && standardizeParamValue(original) === standardizeParamValue(item.defaultValue));
            },
            'rule': (item) => !!this.checkRuleExists?.(resolveRuleToCheck(item)),
            'workspaceRule': (item) => this.getEnabledWorkspaces(item).length > 0
        }, false);

        let dependents = Array.isArray(rec.dependents) ? rec.dependents : [],
            appliedChildren = dependents.every((depId) => {
                let dependent = this.getRecommendationById(depId);
                return !dependent || this.getRecommendationStatus(dependent, { visited }).applied;
            }),
            applied = appliedSelf && appliedChildren,
            canRevert = hasSavedPreviousValue(saved);

                return {
                    applied,
                    appliedSelf,
                    appliedChildren,
                    previousValue: saved?.previousValue,
                    canRevert
                };
            })();
    };

    prototype.getRecommendationCurrentValue = function(rec) {
        return runByRecommendationType(rec, {
            'keybind': (item) => ((source) => source
                    ? `${source.dispatcher || item.dispatcher || ''} ${source.args || ''}`.trim()
                    : ''
                )(this.findRecommendationOverride?.(item) || this.findOriginalRecommendationHotkey?.(item, { allowFallback: true })),
            'dropdown': (item) => this.getOverrideChainValue(item.paramPath, ''),
            'param': (item) => this.getOverrideChainValue(item.paramPath, item.defaultValue || ''),
            'rule': (item) => this.checkRuleExists?.(resolveRuleToCheck(item)) ? (resolveRuleToCheck(item) || '') : '',
            'workspaceRule': (item) => ((enabled) => enabled.length > 0 ? `ws: ${enabled.join(',')}` : '')(this.getEnabledWorkspaces(item))
        }, '');
    };

    prototype.getEnabledWorkspaces = function(rec) {
        return (rec.type === 'workspaceRule' && rec.ruleTemplate && rec.workspaces)
            ? rec.workspaces.filter((ws) => this.checkRuleExists?.(rec.ruleTemplate.replace('{ws}', ws)))
            : [];
    };
}
