import { SwayToHyprlandConverter } from './SwayToHyprlandConverter.js';
import { SwayConfigParser } from './SwayConfigParser.js';
import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';

export { SwayToHyprlandConverter, SwayConfigParser };

export const SUPPORTED_SOURCE_WMS = [
    { id: 'sway', name: 'Sway', aliases: ['i3', 'i3-gaps'] },
];

export function detectSourceWM(extractedPath) {
    return LastlayerSupporter.ConverterUtils.detect_source_wm(extractedPath) || null;
}

export function getConverter(sourceWM, options = {}) {
    if (sourceWM === 'sway' || sourceWM === 'i3' || sourceWM === 'i3-gaps') {
        return new SwayToHyprlandConverter(options);
    }
    return null;
}

export async function convertToHyprland(extractedPath, options = {}) {
    const json = LastlayerSupporter.ConverterUtils.convert_to_hyprland(
        extractedPath, JSON.stringify(options));
    return JSON.parse(json);
}
