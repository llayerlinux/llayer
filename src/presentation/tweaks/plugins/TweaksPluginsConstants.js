import {Commands} from '../../../infrastructure/constants/Commands.js';

export const COMMAND_BIN = Commands;

export const CUSTOM_PARAM_DESCRIPTION_DEFAULTS = [
    'Custom parameter',
    'Parámetro personalizado',
    'Benutzerdefinierter Parameter',
    'Paramètre personnalisé'
];

const parseIntOption = (match) => parseInt(match[1], 10);
const parseFloatOption = (match) => parseFloat(match[1]);
const parseStringOption = (match) => match[1];

export const PLUGIN_OPTION_PARSERS = [
    [/int:\s*(-?\d+)/, parseIntOption],
    [/float:\s*(-?[\d.]+)/, parseFloatOption],
    [/str:\s*"?([^"\n]*)"?/, parseStringOption]
];

export const REPO_URL_NEEDLES = ['http', 'github.com', 'gitlab.com'];

export const DEFAULT_HYPRLAND_PLUGINS_REPO = {
    url: 'https://github.com/hyprwm/hyprland-plugins',
    author: 'hyprwm',
    authorUrl: 'https://github.com/hyprwm',
    platform: 'GitHub'
};
