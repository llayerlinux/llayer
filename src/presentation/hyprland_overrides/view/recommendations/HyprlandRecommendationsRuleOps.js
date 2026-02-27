import { standardizeRuleLine } from './HyprlandRecommendationsUtils.js';

function isWorkspaceRuleRecommendation(rec) {
    return rec?.type === 'workspaceRule' && rec?.ruleTemplate && rec?.workspaces;
}

function pushRuleIfMissing(rules, line) {
    !rules.some((existing) => standardizeRuleLine(existing) === standardizeRuleLine(line)) && rules.push(line);
}

function splitRuleLines(ruleLine = '') {
    return String(ruleLine)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function readRules(context) {
    return context.readRecommendationRules?.() ?? [];
}

function writeRules(context, rules) {
    context.writeRecommendationRules?.(rules);
}

function getWorkspaceRules(rec) {
    return isWorkspaceRuleRecommendation(rec)
        ? rec.workspaces.map((ws) => rec.ruleTemplate.replace('{ws}', ws))
        : [];
}

export function applyHyprlandRecommendationsRuleOps(prototype) {
    prototype.applyRuleRecommendation = function(rec) {
        const ruleLine = rec?.ruleLine || '',
            checkRule = rec?.primaryRule || splitRuleLines(ruleLine)[0];
        (ruleLine && !this.checkRuleExists?.(checkRule)) && (() => {
            const rules = readRules(this);
            for (const line of splitRuleLines(ruleLine)) {
                pushRuleIfMissing(rules, line);
            }
            writeRules(this, rules);
        })();
    };

    prototype.revertRuleRecommendation = function(rec, previousValue) {
        const ruleLine = rec?.ruleLine || '',
            checkRule = rec?.primaryRule || splitRuleLines(ruleLine)[0];
        (ruleLine && standardizeRuleLine(previousValue) !== standardizeRuleLine(checkRule)) && (() => {
            const linesToRemove = splitRuleLines(ruleLine).map((line) => standardizeRuleLine(line));
            writeRules(this, readRules(this).filter(line =>
                !linesToRemove.includes(standardizeRuleLine(line))
            ));
        })();
    };

    prototype.applyWorkspaceRuleRecommendation = function(rec) {
        const workspaceRules = getWorkspaceRules(rec);
        workspaceRules.length > 0 && (() => {
            const rules = readRules(this);
            for (const rule of workspaceRules) {
                pushRuleIfMissing(rules, rule);
            }
            writeRules(this, rules);
        })();
    };

    prototype.revertWorkspaceRuleRecommendation = function(rec) {
        const workspaceRules = getWorkspaceRules(rec);
        workspaceRules.length > 0 && (() => {
            const rulesToRemove = workspaceRules.map((line) => standardizeRuleLine(line));
            writeRules(this, readRules(this).filter(line =>
                !rulesToRemove.includes(standardizeRuleLine(line))
            ));
        })();
    };

    prototype.toggleWorkspaceRule = function(rec, ws, enable) {
        (rec?.type === 'workspaceRule' && rec?.ruleTemplate) && (() => {
            const rule = rec.ruleTemplate.replace('{ws}', ws),
                rules = readRules(this),
                hasRule = rules.some(r => standardizeRuleLine(r) === standardizeRuleLine(rule));

            (enable && !hasRule)
                ? rules.push(rule)
                : (() => {
                    const normalized = standardizeRuleLine(rule),
                        idx = rules.findIndex(r => standardizeRuleLine(r) === normalized);
                    idx >= 0 && rules.splice(idx, 1);
                })();

            writeRules(this, rules);
        })();
    };
}
