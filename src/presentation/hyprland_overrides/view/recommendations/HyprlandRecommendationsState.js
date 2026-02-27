import GLib from 'gi://GLib';
import { tryOrDefault, tryOrNull, tryRun } from '../../../../infrastructure/utils/ErrorUtils.js';

const STATE_FILE_NAME = '.recommendation-states.json';
const UTF8_DECODER = new TextDecoder();

function getRecommendationStatePath(context) {
    const themePath = context.getCurrentThemePath?.();
    return themePath ? `${themePath}/${STATE_FILE_NAME}` : null;
}

function readRecommendationState(path) {
    const hasStateFile = path && GLib.file_test(path, GLib.FileTest.EXISTS);
    const [ok, contents] = hasStateFile
        ? tryOrDefault('getSavedRecommendations.readFile', () => GLib.file_get_contents(path), [false, null])
        : [false, null];
    return ok && contents
        ? tryOrNull('getSavedRecommendations.parseJson', () => JSON.parse(UTF8_DECODER.decode(contents))) || {}
        : {};
}

function writeRecommendationState(context, path, payload, scope, errorMessage) {
    const written = tryRun(scope, () => {
        GLib.file_set_contents(path, JSON.stringify(payload, null, 2));
    });
    !written && context.log?.(errorMessage);
}

export function applyHyprlandRecommendationsState(prototype) {
    prototype.getSavedRecommendations = function() {
        const filePath = getRecommendationStatePath(this);
        return filePath ? readRecommendationState(filePath) : {};
    };

    prototype.saveRecommendationState = function(recId, state) {
        const filePath = getRecommendationStatePath(this);
        if (!filePath) {
            return;
        }
        const savedRecs = this.getSavedRecommendations();
        savedRecs[recId] = state;
        writeRecommendationState(
            this,
            filePath,
            savedRecs,
            'saveRecommendationState.writeFile',
            'Error saving recommendation state'
        );
    };

    prototype.clearRecommendationState = function(recId) {
        const filePath = getRecommendationStatePath(this);
        if (!filePath) {
            return;
        }
        const savedRecs = this.getSavedRecommendations();
        delete savedRecs[recId];
        writeRecommendationState(
            this,
            filePath,
            savedRecs,
            'clearRecommendationState.writeFile',
            'Error clearing recommendation state'
        );
    };
}
