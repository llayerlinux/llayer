function isHyprlandColorParam(param = {}) {
    return param.name.startsWith('col.')
        || param.name.includes('color')
        || param.fullPath.startsWith('general:col.')
        || param.fullPath.startsWith('decoration:col.')
        || param.fullPath.startsWith('group:col.');
}

function isHyprlandSliderParam(param = {}) {
    return (param.type === 'int' || param.type === 'float') && param.min != null;
}

function applyHyprlandParamPredicates(prototype) {
    prototype.isColorParam = function(param) {
        return isHyprlandColorParam(param);
    };

    prototype.isSliderParam = function(param) {
        return isHyprlandSliderParam(param);
    };
}

export {
    isHyprlandColorParam,
    isHyprlandSliderParam,
    applyHyprlandParamPredicates
};
