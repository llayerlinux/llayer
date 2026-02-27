import { applyThemeContextMenuViewPackagesRiceDepthDetection } from './ThemeContextMenuViewPackagesRiceDepthDetection.js';
import { applyThemeContextMenuViewPackagesRiceDepthDiagram } from './ThemeContextMenuViewPackagesRiceDepthDiagram.js';
import { applyThemeContextMenuViewPackagesRiceDepthLayers } from './ThemeContextMenuViewPackagesRiceDepthLayers.js';

export function applyThemeContextMenuViewPackagesRiceDepth(targetPrototype) {
    [
        applyThemeContextMenuViewPackagesRiceDepthDetection,
        applyThemeContextMenuViewPackagesRiceDepthDiagram,
        applyThemeContextMenuViewPackagesRiceDepthLayers
    ].forEach((applyMixin) => applyMixin(targetPrototype));
}
