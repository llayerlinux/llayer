import GLib from 'gi://GLib';
import { formatTotalSize, parseSizeToBytes, getTypeIcon } from './AdvancedTabDependencyIsolationDialogProgramsFormatters.js';

const TREE_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const PROGRAM_TYPE_FALLBACK = 'shared';
const UNKNOWN_LABEL = '\u2014';

function setTreeRow(programsTreeStore, iter, values) {
    programsTreeStore.set(iter, TREE_COLUMNS, values);
}

function appendMapArrayValue(map, key, value) {
    const items = map.get(key) || [];
    items.push(value);
    map.set(key, items);
}

function appendProgramTreeRow(programsTreeStore, programsData, parentIter, typeLabel, programItem) {
    const { program, version, rice, path, size } = programItem;
    const iter = programsTreeStore.append(parentIter);

    setTreeRow(programsTreeStore, iter, [
        false,
        typeLabel,
        program || UNKNOWN_LABEL,
        version || UNKNOWN_LABEL,
        rice || UNKNOWN_LABEL,
        path || '',
        size || UNKNOWN_LABEL
    ]);
    path && programsData.set(path, programItem);
    return iter;
}

function visitTreeStore(programsTreeStore, onIter) {
    function visit(iter) {
        do {
            let [hasChild, childIter] = programsTreeStore.iter_children(iter);
            if (onIter(iter) || (hasChild && visit(childIter))) return true;
        } while (programsTreeStore.iter_next(iter));
        return false;
    }

    let [hasRoot, rootIter] = programsTreeStore.get_iter_first();
    hasRoot && visit(rootIter);
}

function updateVersionInTreeStore(programsTreeStore, path, version) {
    visitTreeStore(programsTreeStore, (iter) => {
        const isTargetPath = programsTreeStore.get_value(iter, 5) === path;
        isTargetPath && programsTreeStore.set_value(iter, 3, version);
        return isTargetPath;
    });
}

function runIdleOperations(operations, onComplete, opsPerCycle = 1) {
    let opIndex = 0;
    const processNextChunk = () => {
        if (opIndex >= operations.length) {
            return (onComplete?.(), GLib.SOURCE_REMOVE);
        }

        for (let i = 0; i < opsPerCycle && opIndex < operations.length; i += 1, opIndex += 1) {
            operations[opIndex]();
        }

        return GLib.SOURCE_CONTINUE;
    };

    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, processNextChunk);
}

function setLoadingState(state, loading) {
    return loading
        ? (
            state.programsSpinnerBox.show_all(),
            state.programsSpinner.start(),
            state.refreshProgramsButton.set_sensitive(false),
            state.deleteAllButton.set_sensitive(false)
        )
        : (
            state.programsSpinner.stop(),
            state.programsSpinnerBox.hide(),
            state.refreshProgramsButton.set_sensitive(true)
        );
}

function queueChunkedOperations(operations, items, chunkSize, onChunk) {
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        operations.push(() => onChunk(chunk));
    }
}

function isNonEmptyProgramList(programs) {
    return Array.isArray(programs) && programs.length > 0;
}

function incrementProgramTypeCount(counts, type) {
    switch (type) {
    case 'shared':
    case 'per-program':
    case 'per-rice':
    case 'venv':
        counts[type] += 1;
        return;
    default:
        counts[PROGRAM_TYPE_FALLBACK] += 1;
    }
}

function createProgramTypeCounts(programs) {
    const counts = {shared: 0, 'per-program': 0, 'per-rice': 0, venv: 0};
    for (const program of programs) {
        incrementProgramTypeCount(counts, program?.type);
    }
    return counts;
}

function determineProgramType(type) {
    switch (type) {
    case 'per-program':
    case 'per-rice':
    case 'venv':
        return type;
    default:
        return PROGRAM_TYPE_FALLBACK;
    }
}

function groupProgramsByType(programs) {
    const grouped = {
        'shared': [],
        'per-program': [],
        'per-rice': [],
        'venv': []
    };
    for (const program of programs) {
        grouped[determineProgramType(program?.type)].push(program);
    }
    return grouped;
}

function formatStatsHeaderText(t, counts) {
    const statsStr = [
        counts.shared > 0 ? `\uD83D\uDCE6 ${counts.shared}` : '',
        counts['per-program'] > 0 ? `\uD83D\uDD27 ${counts['per-program']}` : '',
        counts['per-rice'] > 0 ? `\uD83C\uDF5A ${counts['per-rice']}` : '',
        counts.venv > 0 ? `\uD83D\uDC0D ${counts.venv}` : ''
    ].filter(Boolean).join('  ');
    return statsStr
        ? `${t('DEPENDENCY_ISOLATION_INSTALLED_PROGRAMS')} (${statsStr})`
        : t('DEPENDENCY_ISOLATION_INSTALLED_PROGRAMS');
}

export function populateProgramsList(state) {
    const { t, programsTreeStore, programsData, selectedItems, updateSelectionState } = state;

    programsTreeStore.clear();
    programsData.clear();
    selectedItems.clear();
    updateSelectionState();
    setLoadingState(state, true);
    state.selectedProgramLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROGRAM'));
    state.totalSizeLabel.set_text('');

    state.listIsolationProgramsAsync((programs) => {
        setLoadingState(state, false);

        const hasPrograms = isNonEmptyProgramList(programs);
        return hasPrograms
            ? (() => {
                const totalBytes = programs.reduce((sum, program) => sum + parseSizeToBytes(program.size), 0);
                state.totalSizeLabel.set_text(`(${(t('DEPENDENCY_ISOLATION_TOTAL_SIZE') || 'Total: {size}').replace('{size}', formatTotalSize(totalBytes))})`);
                state.deleteAllButton.set_sensitive(programs.length > 0);

                const counts = createProgramTypeCounts(programs);
                state.programsHeaderLabel.set_text(formatStatsHeaderText(t, counts));

                const onPopulateComplete = () => {
                    state.programsTreeView.expand_all();
                    state.selectedProgramLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROGRAM'));

                    state.loadVersionsAsync(
                        programs,
                        (path, version) => {
                            updateVersionInTreeStore(programsTreeStore, path, version);
                            const prog = programsData.get(path);
                            prog && (prog.version = version);
                        },
                        () => {}
                    );
                };

                (state.currentViewMode === 'by-program' ? populateByProgram : populateByType)(state, programs, onPopulateComplete);
            })()
            : (
                setTreeRow(programsTreeStore, programsTreeStore.append(null), [false, '', t('DEPENDENCY_ISOLATION_NO_PROGRAMS'), '', '', '', '']),
                state.selectedProgramLabel.set_text(t('DEPENDENCY_ISOLATION_SELECT_PROGRAM')),
                state.totalSizeLabel.set_text(''),
                state.deleteAllButton.set_sensitive(false)
            );
    });
}

export function populateByType(state, programs, onComplete) {
    const { t, programsTreeStore, programsData } = state;

    const byType = groupProgramsByType(programs),
        typeLabels = {
            'shared': `\uD83D\uDCE6 ${t('DEPENDENCY_ISOLATION_TYPE_HYBRID') || 'Hybrid'}`,
            'per-program': `\uD83D\uDD27 ${t('DEPENDENCY_ISOLATION_TYPE_PER_PROGRAM') || 'Per-Program'}`,
            'per-rice': `\uD83C\uDF5A ${t('DEPENDENCY_ISOLATION_TYPE_PER_RICE') || 'Per-Rice'}`,
            'venv': `\uD83D\uDC0D ${t('DEPENDENCY_ISOLATION_TYPE_VENV') || 'Python Venv'}`
        },
        perRiceByRice = new Map();

    byType['per-rice'].forEach((program) => {
        appendMapArrayValue(perRiceByRice, program.rice || 'unknown', program);
    });

    const operations = [],
        typeIterMap = new Map(),
        riceIterMap = new Map();

    for (const [type, items] of Object.entries(byType).filter(([, list]) => list.length > 0)) {

        operations.push(() => {
            const typeIter = programsTreeStore.append(null),
                typeCount = type === 'per-rice'
                    ? `(${perRiceByRice.size} ${t('DEPENDENCY_ISOLATION_RICES') || 'rices'})`
                    : `(${items.length})`;
            setTreeRow(programsTreeStore, typeIter, [false, typeLabels[type], typeCount, '', '', '', '']);
            typeIterMap.set(type, typeIter);
        });
    }

    for (const [riceName, ricePrograms] of perRiceByRice) {
        operations.push(() => {
            const typeIter = typeIterMap.get('per-rice');
            typeIter && (() => {
                const riceIter = programsTreeStore.append(typeIter);
                setTreeRow(programsTreeStore, riceIter, [
                    false, `  \uD83C\uDF5A ${riceName}`, `(${ricePrograms.length})`, '', '', '', ''
                ]);
                riceIterMap.set(riceName, riceIter);
            })();
        });
    }

    const CHUNK_SIZE = 10;

    for (const [riceName, ricePrograms] of perRiceByRice) {
        queueChunkedOperations(operations, ricePrograms, CHUNK_SIZE, (chunk) => {
            const riceIter = riceIterMap.get(riceName);
            riceIter && chunk.forEach((program) =>
                appendProgramTreeRow(programsTreeStore, programsData, riceIter, '    ', program)
            );
        });
    }

    for (const [type, items] of Object.entries(byType).filter(([kind, list]) => kind !== 'per-rice' && list.length > 0)) {

        queueChunkedOperations(operations, items, CHUNK_SIZE, (chunk) => {
            const typeIter = typeIterMap.get(type);
            typeIter && chunk.forEach((program) =>
                appendProgramTreeRow(programsTreeStore, programsData, typeIter, '  ', program)
            );
        });
    }

    runIdleOperations(operations, onComplete, 3);
}

export function populateByProgram(state, programs, onComplete) {
    const { programsTreeStore, programsData } = state;

    const byProgram = new Map();
    programs.forEach(p => appendMapArrayValue(byProgram, p.program || 'unknown', p));

    const sortedNames = Array.from(byProgram.keys()).sort((a, b) => a.localeCompare(b)),
        operations = [],
        progIterMap = new Map(),
        CHUNK_SIZE = 10;

    for (let i = 0; i < sortedNames.length; i += CHUNK_SIZE) {
        const nameChunk = sortedNames.slice(i, i + CHUNK_SIZE);

        operations.push(() => {
            for (const progName of nameChunk) {
                const installations = byProgram.get(progName);
                installations.length === 1
                    ? appendProgramTreeRow(
                        programsTreeStore,
                        programsData,
                        null,
                        getTypeIcon(installations[0].type),
                        installations[0]
                    )
                    : (() => {
                        const progIter = programsTreeStore.append(null);
                        const typeSummary = installations.map(p => getTypeIcon(p.type).split(' ')[0]).join(' ');
                        setTreeRow(programsTreeStore, progIter, [
                            false, typeSummary, progName, `(${installations.length})`, '', '', ''
                        ]);
                        progIterMap.set(progName, {iter: progIter, installations});
                    })();
            }
        });
    }

    operations.push(() => {
        for (const [, {iter: progIter, installations}] of progIterMap) {
            installations.forEach(prog => {
                appendProgramTreeRow(programsTreeStore, programsData, progIter, `  ${getTypeIcon(prog.type)}`, prog);
            });
        }
    });

    runIdleOperations(operations, onComplete);
}
