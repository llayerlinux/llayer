export function firstNonEmptyTrimmed(values = []) {
    return values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .find((value) => value.length > 0) || null;
}

export function extractThemeIdRecursive(theme, parseIdFn) {
    if (!theme || typeof parseIdFn !== 'function') {
        return null;
    }

    let directMatch = [
        theme.id,
        theme?.metadata?.originalTheme?.id
    ]
        .map((candidate) => parseIdFn(candidate))
        .find((parsed) => parsed !== null);

    if (directMatch !== undefined) {
        return directMatch;
    }

    return theme.originalTheme ? extractThemeIdRecursive(theme.originalTheme, parseIdFn) : null;
}

export function extractThemeIdentifierFromCandidates(theme, parseIdFn, nameCandidates = []) {
    const id = extractThemeIdRecursive(theme, parseIdFn);
    return id ?? firstNonEmptyTrimmed(nameCandidates);
}

export function findFirstServerAddress(candidates = [], parseAddressFn) {
    if (typeof parseAddressFn !== 'function') {
        return null;
    }
    return candidates
        .map((candidate) => parseAddressFn(candidate))
        .find(Boolean) || null;
}

export function collectLowercaseThemeNames(values = []) {
    const names = [];
    const seen = new Set();

    values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .forEach((trimmed) => {
            trimmed.length > 0 && !seen.has(trimmed) && (seen.add(trimmed), names.push(trimmed));
        });

    return names;
}
