import { standardizeRuleLine } from './HyprlandRecommendationsUtils.js';

function isWorkspaceRuleRecommendation(rec) {
    return rec?.type === 'workspaceRule' && rec?.ruleTemplate && rec?.workspaces;
}

function canonicalizeRule(context, line) {
    return context.canonicalizeRecommendationRuleLine?.(line) || standardizeRuleLine(line);
}

function pushRuleIfMissing(context, rules, line) {
    const canonicalRule = canonicalizeRule(context, line);
    canonicalRule
        && !rules.some((existing) => canonicalizeRule(context, existing) === canonicalRule)
        && rules.push(canonicalRule);
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
        const ruleLine = rec?.ruleLine || '';
        const checkRule = rec?.primaryRule || splitRuleLines(ruleLine)[0];
        if (!ruleLine || this.checkRuleExists?.(checkRule)) {
            return;
        }

        const rules = readRules(this);
        for (const line of splitRuleLines(ruleLine)) {
            pushRuleIfMissing(this, rules, line);
        }
        writeRules(this, rules);
    };

    prototype.revertRuleRecommendation = function(rec, previousValue) {
        const ruleLine = rec?.ruleLine || '';
        const checkRule = rec?.primaryRule || splitRuleLines(ruleLine)[0];
        if (!ruleLine || canonicalizeRule(this, previousValue) === canonicalizeRule(this, checkRule)) {
            return;
        }

        const linesToRemove = splitRuleLines(ruleLine).map((line) => canonicalizeRule(this, line));
        writeRules(this, readRules(this).filter(line =>
            !linesToRemove.includes(canonicalizeRule(this, line))
        ));
    };

    prototype.applyWorkspaceRuleRecommendation = function(rec) {
        const workspaceRules = getWorkspaceRules(rec);
        if (workspaceRules.length === 0) {
            return;
        }

        const rules = readRules(this);
        for (const rule of workspaceRules) {
            pushRuleIfMissing(this, rules, rule);
        }
        writeRules(this, rules);
    };

    prototype.revertWorkspaceRuleRecommendation = function(rec) {
        const workspaceRules = getWorkspaceRules(rec);
        if (workspaceRules.length === 0) {
            return;
        }

        const rulesToRemove = workspaceRules.map((line) => canonicalizeRule(this, line));
        writeRules(this, readRules(this).filter(line =>
            !rulesToRemove.includes(canonicalizeRule(this, line))
        ));
    };

    prototype.toggleWorkspaceRule = function(rec, ws, enable) {
        if (rec?.type !== 'workspaceRule' || !rec?.ruleTemplate) {
            return;
        }

        const rule = rec.ruleTemplate.replace('{ws}', ws);
        const rules = readRules(this);
        const canonicalRule = canonicalizeRule(this, rule);
        const existingIndex = rules.findIndex((currentRule) =>
            canonicalizeRule(this, currentRule) === canonicalRule
        );

        if (enable) {
            existingIndex === -1 && rules.push(canonicalRule);
        }

        if (!enable && existingIndex >= 0) {
            rules.splice(existingIndex, 1);
        }

        writeRules(this, rules);
    };
}
